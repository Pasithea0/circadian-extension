import React, { useEffect, useState } from "react"

import {
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

function IndexPopup() {
  const [isEnabled, setIsEnabled] = useState(true)
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

  // Auto-exit preview mode after 10 seconds
  useEffect(() => {
    if (!isPreviewMode) return

    const timeout = setTimeout(() => {
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
    }, 5000) // 5 seconds

    return () => clearTimeout(timeout)
  }, [isPreviewMode, daytimeStart, sunsetStart, bedtimeStart])

  // Get temperature for a period
  const getTemperatureForPeriod = (
    period: "Daytime" | "Sunset" | "Bedtime"
  ): number => {
    switch (period) {
      case "Daytime":
        return daytimeTemp
      case "Sunset":
        return sunsetTemp
      case "Bedtime":
        return bedtimeTemp
    }
  }

  // Calculate current temperature based on active period
  const currentTemperature = getTemperatureForPeriod(activePeriod)

  // Save current temperature whenever it changes
  useEffect(() => {
    if (isEnabled && currentTemperature) {
      saveCurrentTemperature(currentTemperature)
    }
  }, [currentTemperature, isEnabled])

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

  return (
    <div
      style={{
        width: 500,
        backgroundColor: "#F5F5F5",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: 14,
        display: "flex",
        flexDirection: "column"
      }}>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14
              }}>
              ☀️
            </div>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Circadian</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isEnabled && (
              <span style={{ fontSize: 11, color: "#666" }}>
                {currentTemperature}K
              </span>
            )}
            {currentTimeString && (
              <span style={{ fontSize: 11, color: "#666" }}>
                {currentTimeString}
              </span>
            )}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                fontSize: 12
              }}>
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                style={{ cursor: "pointer", width: 14, height: 14 }}
              />
              <span>Enable</span>
            </label>
          </div>
        </div>
      </div>

      {/* Period Selection */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            gap: 3,
            backgroundColor: "#E0E0E0",
            borderRadius: 5,
            padding: 3,
            marginBottom: 8
          }}>
          {(["Daytime", "Sunset", "Bedtime"] as const).map((period) => {
            const isSelected = activePeriod === period
            const isCurrentPeriod = currentTime
              ? getCurrentPeriod(
                  currentTime,
                  daytimeStart,
                  sunsetStart,
                  bedtimeStart
                ) === period
              : false

            return (
              <button
                key={period}
                onClick={() => {
                  if (isCurrentPeriod) {
                    // Clicking current period - exit preview mode
                    setIsPreviewMode(false)
                  } else {
                    // Clicking different period - enter preview mode
                    setIsPreviewMode(true)
                    setActivePeriod(period)
                  }
                }}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  border: "none",
                  borderRadius: 3,
                  backgroundColor: isSelected ? "white" : "transparent",
                  color: isSelected ? "#333" : "#666",
                  fontWeight: isSelected ? 600 : 400,
                  cursor: "pointer",
                  fontSize: 11,
                  boxShadow: isSelected ? "0 1px 2px rgba(0,0,0,0.1)" : "none"
                }}>
                {period}
              </button>
            )
          })}
        </div>

        <div style={{ fontSize: 11, color: "#666", marginBottom: 10 }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 500, width: 70 }}>
              Daytime:
            </label>
            <input
              type="time"
              value={daytimeTime24}
              onChange={(e) => setDaytimeTime24(e.target.value)}
              style={{
                padding: "4px 6px",
                border: "1px solid #CCC",
                borderRadius: 3,
                fontSize: 11
              }}
            />
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 6
              }}>
              <input
                type="range"
                min="2000"
                max="8000"
                value={daytimeTemp}
                onChange={(e) => setDaytimeTemp(parseInt(e.target.value, 10))}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 3,
                  outline: "none",
                  cursor: "pointer"
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: "#666",
                  width: 50,
                  textAlign: "right"
                }}>
                {daytimeTemp}K
              </span>
            </div>
          </div>

          {/* Sunset */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 500, width: 70 }}>
              Sunset:
            </label>
            <input
              type="time"
              value={sunsetTime24}
              onChange={(e) => setSunsetTime24(e.target.value)}
              style={{
                padding: "4px 6px",
                border: "1px solid #CCC",
                borderRadius: 3,
                fontSize: 11
              }}
            />
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 6
              }}>
              <input
                type="range"
                min="2000"
                max="8000"
                value={sunsetTemp}
                onChange={(e) => setSunsetTemp(parseInt(e.target.value, 10))}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 3,
                  outline: "none",
                  cursor: "pointer"
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: "#666",
                  width: 50,
                  textAlign: "right"
                }}>
                {sunsetTemp}K
              </span>
            </div>
          </div>

          {/* Bedtime */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 500, width: 70 }}>
              Bedtime:
            </label>
            <input
              type="time"
              value={bedtimeTime24}
              onChange={(e) => setBedtimeTime24(e.target.value)}
              style={{
                padding: "4px 6px",
                border: "1px solid #CCC",
                borderRadius: 3,
                fontSize: 11
              }}
            />
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 6
              }}>
              <input
                type="range"
                min="2000"
                max="8000"
                value={bedtimeTemp}
                onChange={(e) => setBedtimeTemp(parseInt(e.target.value, 10))}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 3,
                  outline: "none",
                  cursor: "pointer"
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: "#666",
                  width: 50,
                  textAlign: "right"
                }}>
                {bedtimeTemp}K
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IndexPopup
