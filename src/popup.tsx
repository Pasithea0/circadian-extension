import React, { useCallback, useEffect, useState } from "react"

import { Footer } from "~/components/Footer"
import { Header } from "~/components/Header"
import { PeriodSelector } from "~/components/PeriodSelector"
import { TemperatureSlider } from "~/components/TemperatureSlider"
import { kelvinToOverlayColor } from "~/utils/color"
import {
  clearForcedTemperature,
  isHostnameExcluded,
  loadSettings,
  saveCurrentTemperature,
  saveSettings,
  type CircadianSettings
} from "~/utils/storage"
import {
  convertFrom24Hour,
  convertTo24Hour,
  formatTimeDifference,
  formatUnixTimeOnly,
  getCurrentPeriod,
  getCurrentUnixTime,
  getNextDaytimeStart,
  getPeriodStartTime
} from "~/utils/time"
import { browserAPI } from "~utils/browser"

function IndexPopup() {
  const [isEnabled, setIsEnabled] = useState(true)
  const [currentHostname, setCurrentHostname] = useState<string>("")
  const [isSiteEnabled, setIsSiteEnabled] = useState(true)
  const [daytimeTemp, setDaytimeTemp] = useState(5500)
  const [sunsetTemp, setSunsetTemp] = useState(3300)
  const [bedtimeTemp, setBedtimeTemp] = useState(2700)
  const [currentTime, setCurrentTime] = useState<number | null>(null)
  const [currentTimeString, setCurrentTimeString] = useState<string>("")
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [activePeriod, setActivePeriod] = useState<
    "Daytime" | "Sunset" | "Bedtime"
  >("Daytime")

  // Time inputs in 24-hour format (for <input type="time">)
  const [daytimeTime24, setDaytimeTime24] = useState("06:00")
  const [sunsetTime24, setSunsetTime24] = useState("18:00")
  const [bedtimeTime24, setBedtimeTime24] = useState("22:00")

  // Derived time strings in 12-hour format (for storage and calculations)
  const daytimeStart = convertFrom24Hour(daytimeTime24) || "6:00 AM"
  const sunsetStart = convertFrom24Hour(sunsetTime24) || "6:00 PM"
  const bedtimeStart = convertFrom24Hour(bedtimeTime24) || "10:00 PM"

  // Load settings on mount
  useEffect(() => {
    loadSettings().then((settings) => {
      if (settings.enabled !== undefined) setIsEnabled(settings.enabled)
      if (settings.daytimeStart) {
        const time24 = convertTo24Hour(settings.daytimeStart)
        if (time24) setDaytimeTime24(time24)
      }
      if (settings.sunsetStart) {
        const time24 = convertTo24Hour(settings.sunsetStart)
        if (time24) setSunsetTime24(time24)
      }
      if (settings.bedtimeStart) {
        const time24 = convertTo24Hour(settings.bedtimeStart)
        if (time24) setBedtimeTime24(time24)
      }
      if (settings.daytimeTemp !== undefined)
        setDaytimeTemp(settings.daytimeTemp)
      if (settings.sunsetTemp !== undefined) setSunsetTemp(settings.sunsetTemp)
      if (settings.bedtimeTemp !== undefined)
        setBedtimeTemp(settings.bedtimeTemp)
    })
  }, [])

  // Get current hostname on mount
  useEffect(() => {
    const getCurrentHostname = async () => {
      try {
        const api = browserAPI()
        if (!api?.tabs) return

        const tabs = await api.tabs.query({ active: true, currentWindow: true })
        const activeTab = tabs[0]
        if (activeTab?.url) {
          const url = new URL(activeTab.url)
          const hostname = url.hostname
          setCurrentHostname(hostname)
          const excluded = await isHostnameExcluded(hostname)
          setIsSiteEnabled(!excluded)
        }
      } catch (error) {
        console.error("Failed to get current hostname:", error)
      }
    }

    getCurrentHostname()
  }, [])

  // Save settings whenever they change
  useEffect(() => {
    const settings: CircadianSettings = {
      enabled: isEnabled,
      daytimeStart,
      sunsetStart,
      bedtimeStart,
      daytimeTemp,
      sunsetTemp,
      bedtimeTemp
    }
    saveSettings(settings)
  }, [
    isEnabled,
    daytimeStart,
    sunsetStart,
    bedtimeStart,
    daytimeTemp,
    sunsetTemp,
    bedtimeTemp
  ])

  // Update current time and auto-select period
  useEffect(() => {
    const updateTime = () => {
      const unixTime = getCurrentUnixTime()
      setCurrentTime(unixTime)
      setCurrentTimeString(formatUnixTimeOnly(unixTime))

      const currentPeriod = getCurrentPeriod(
        unixTime,
        daytimeStart,
        sunsetStart,
        bedtimeStart
      )

      // If in preview mode and current period matches active, exit preview mode
      if (isPreviewMode && activePeriod === currentPeriod) {
        setIsPreviewMode(false)
      }

      if (!isPreviewMode) {
        // Auto-select current period if not in preview mode
        setActivePeriod(currentPeriod)
      }
    }

    // Initial update
    updateTime()

    // Update every second
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [isPreviewMode, activePeriod, daytimeStart, sunsetStart, bedtimeStart])

  // Get temperature for a period
  const getTemperatureForPeriod = useCallback(
    (period: "Daytime" | "Sunset" | "Bedtime"): number => {
      switch (period) {
        case "Daytime":
          return daytimeTemp
        case "Sunset":
          return sunsetTemp
        case "Bedtime":
          return bedtimeTemp
      }
    },
    [daytimeTemp, sunsetTemp, bedtimeTemp]
  )

  // Auto-exit preview mode after 10 seconds
  useEffect(() => {
    if (!isPreviewMode) return

    const timeout = setTimeout(async () => {
      // Get the current time and period
      const now = getCurrentUnixTime()
      const currentPeriod = getCurrentPeriod(
        now,
        daytimeStart,
        sunsetStart,
        bedtimeStart
      )

      // Exit preview mode and immediately update to the current period
      setIsPreviewMode(false)
      setActivePeriod(currentPeriod)
      // Clear any forced preview temperature and recalculate correct temperature
      await clearForcedTemperature()
      const correctTemp = getTemperatureForPeriod(currentPeriod)
      await saveCurrentTemperature(correctTemp)
      // Force all content scripts to update immediately
      if (browserAPI()?.tabs?.query) {
        const api = browserAPI()!
        const tabs = await api.tabs.query({})
        for (const tab of tabs) {
          if (tab.id) {
            try {
              await api.tabs.sendMessage(tab.id, {
                action: "updateFilter",
                mode: "preview"
              })
            } catch {
              // Ignore errors for tabs that don't have content scripts
            }
          }
        }
      }
    }, 5000) // 5 seconds

    return () => clearTimeout(timeout)
  }, [
    isPreviewMode,
    daytimeStart,
    sunsetStart,
    bedtimeStart,
    getTemperatureForPeriod
  ])

  // Calculate current temperature based on active period
  const currentTemperature = getTemperatureForPeriod(activePeriod)

  // Save current temperature whenever it changes
  useEffect(() => {
    if (isSiteEnabled && currentTemperature) {
      saveCurrentTemperature(currentTemperature)
    }
  }, [currentTemperature, isSiteEnabled])

  // Calculate status message
  const getStatusMessage = () => {
    if (!currentTime) return "Loading..."

    if (isPreviewMode) {
      // Preview mode - show preview message
      const temperature = getTemperatureForPeriod(activePeriod)
      return `Previewing ${activePeriod} (will reset automatically) - ${temperature}K`
    }

    // Auto mode - show current status
    const periodStart = getPeriodStartTime(
      currentTime,
      activePeriod,
      daytimeStart,
      sunsetStart,
      bedtimeStart
    )
    const minutesSinceStart = Math.floor(
      (currentTime - periodStart) / (1000 * 60)
    )
    const nextDaytime = getNextDaytimeStart(currentTime, daytimeStart)
    const minutesUntilNextDaytime = Math.floor(
      (nextDaytime - currentTime) / (1000 * 60)
    )

    const temperature = getTemperatureForPeriod(activePeriod)
    const startText = formatTimeDifference(-minutesSinceStart)
    const wakeText = formatTimeDifference(minutesUntilNextDaytime)

    return `${activePeriod}: ${startText}, Wake: ${wakeText} (${temperature}K)`
  }

  // Slider color helper: 0% (min) => red, 100% (max) => white
  const getSliderColor = (value: number): string => {
    const min = 1500
    const max = 6500
    const pct = Math.max(0, Math.min(1, (value - min) / (max - min)))
    const channel = Math.round(255 * pct) // green/blue channels
    return `rgb(255, ${channel}, ${channel})`
  }

  const daytimeSliderColor = getSliderColor(daytimeTemp)
  const sunsetSliderColor = getSliderColor(sunsetTemp)
  const bedtimeSliderColor = getSliderColor(bedtimeTemp)

  return (
    <div
      style={{
        width: 400,
        backgroundColor: "#121212",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        color: "#EEE"
      }}>
      {/* Global dark background + reset margin to remove white borders */}
      <style>{`
        html, body {
          margin: 0;
          background: #121212 !important;
          color: #EEE;
        }
        /* Make time picker icon visible on dark bg and orange-tinted */
        // input[type="time"]::-webkit-calendar-picker-indicator {
        //   filter: invert(85%) sepia(60%) saturate(600%) hue-rotate(355deg) brightness(105%);
        // }
      `}</style>
      {isSiteEnabled && currentTemperature ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            mixBlendMode: "multiply" as React.CSSProperties["mixBlendMode"],
            backgroundColor: kelvinToOverlayColor(currentTemperature),
            opacity: 0.5,
            zIndex: 0
          }}
        />
      ) : null}
      <Header
        currentHostname={currentHostname}
        isSiteEnabled={isSiteEnabled}
        setIsSiteEnabled={setIsSiteEnabled}
        currentTemperature={currentTemperature}
        currentTimeString={currentTimeString}
        setIsEnabled={setIsEnabled}
        setDaytimeTime24={setDaytimeTime24}
        setSunsetTime24={setSunsetTime24}
        setBedtimeTime24={setBedtimeTime24}
        setDaytimeTemp={setDaytimeTemp}
        setSunsetTemp={setSunsetTemp}
        setBedtimeTemp={setBedtimeTemp}
        setIsPreviewMode={setIsPreviewMode}
      />

      <PeriodSelector
        activePeriod={activePeriod}
        currentTime={currentTime}
        daytimeStart={daytimeStart}
        sunsetStart={sunsetStart}
        bedtimeStart={bedtimeStart}
        setIsPreviewMode={setIsPreviewMode}
        setActivePeriod={setActivePeriod}
        getTemperatureForPeriod={getTemperatureForPeriod}
      />

      <div style={{ fontSize: 11, color: "#AAA", marginBottom: 10 }}>
        {getStatusMessage()}
      </div>

      {/* Period Start Times and Temperatures */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 12
        }}>
        {/* Daytime */}
        <TemperatureSlider
          label="Daytime"
          timeValue={daytimeTime24}
          onTimeChange={setDaytimeTime24}
          temperatureValue={daytimeTemp}
          onTemperatureChange={setDaytimeTemp}
          sliderColor={daytimeSliderColor}
          activePeriod={activePeriod}
          period="Daytime"
          isSiteEnabled={isSiteEnabled}
        />

        {/* Sunset */}
        <TemperatureSlider
          label="Sunset"
          timeValue={sunsetTime24}
          onTimeChange={setSunsetTime24}
          temperatureValue={sunsetTemp}
          onTemperatureChange={setSunsetTemp}
          sliderColor={sunsetSliderColor}
          activePeriod={activePeriod}
          period="Sunset"
          isSiteEnabled={isSiteEnabled}
        />

        {/* Bedtime */}
        <TemperatureSlider
          label="Bedtime"
          timeValue={bedtimeTime24}
          onTimeChange={setBedtimeTime24}
          temperatureValue={bedtimeTemp}
          onTemperatureChange={setBedtimeTemp}
          sliderColor={bedtimeSliderColor}
          activePeriod={activePeriod}
          period="Bedtime"
          isSiteEnabled={isSiteEnabled}
        />
      </div>
      <Footer />
    </div>
  )
}

export default IndexPopup
