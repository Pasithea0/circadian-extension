import React, { useCallback, useEffect, useState } from "react"

import { kelvinToOverlayColor } from "~/utils/color"
import {
  addExcludedHostname,
  clearForcedTemperature,
  getDefaultSettings,
  isHostnameExcluded,
  loadSettings,
  removeExcludedHostname,
  saveCurrentTemperature,
  saveForcedTemperature,
  saveSettings,
  resetSettings as storageResetSettings,
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
      {/* Header */}
      <div style={{ marginBottom: 14, color: "#EEE" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg
              className="w-6 h-6 text-gray-800 dark:text-white"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="currentColor"
              viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                d="M17 4c.5523 0 1 .44772 1 1v2h2c.5523 0 1 .44771 1 1 0 .55228-.4477 1-1 1h-2v2c0 .5523-.4477 1-1 1s-1-.4477-1-1V9h-2c-.5523 0-1-.44772-1-1s.4477-1 1-1h2V5c0-.55228.4477-1 1-1Z"
                clipRule="evenodd"
              />
              <path d="M12.3224 4.68708c.2935-.31028.3575-.77266.1594-1.15098-.1981-.37832-.6146-.5891-1.0368-.52467-1.50847.2302-2.93175.83665-4.12869 1.76276-1.19717.92628-2.12732 2.1411-2.69465 3.52702-.56744 1.38618-.75115 2.89299-.53164 4.37079.2195 1.4776.83393 2.8711 1.77895 4.0436.9448 1.1722 2.18683 2.0826 3.60103 2.6449 1.414.5623 2.9539.7584 4.4683.57 1.5145-.1884 2.9549-.7551 4.1784-1.6475 1.2237-.8924 2.1892-2.0806 2.7972-3.4499.1723-.3879.0809-.8423-.2279-1.1335-.3089-.2911-.7679-.3556-1.145-.1608-.8631.4459-1.8291.6799-2.8118.6791h-.0018c-1.1598.0013-2.2925-.3234-3.2596-.931-.9667-.6074-1.7244-1.4697-2.1856-2.4779-.4611-1.00776-.6079-2.1209-.4243-3.20511.1835-1.08442.6905-2.09837 1.4645-2.91681Z" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Circadian</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection:
                currentHostname && currentHostname.length > 20
                  ? "column"
                  : "row",
              alignItems:
                currentHostname && currentHostname.length > 20
                  ? "stretch"
                  : "center",
              gap: 8
            }}>

            {/* Toggle row: enable checkbox and hostname */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                fontSize: 12,
                color: "#DDD",
                order: currentHostname && currentHostname.length > 20 ? 1 : 2,
                justifyContent: "flex-end"
              }}>
              <input
                type="checkbox"
                checked={isSiteEnabled}
                onChange={async (e) => {
                  const enabled = e.target.checked
                  setIsSiteEnabled(enabled)
                  if (enabled) {
                    await removeExcludedHostname(currentHostname)
                  } else {
                    await addExcludedHostname(currentHostname)
                  }
                }}
                style={{
                  cursor: "pointer",
                  width: 14,
                  height: 14,
                  accentColor: "#FFA500"
                }}
              />
              <span>{currentHostname || "Enable"}</span>
            </label>

            {/* Info row: temperature, time, reset button */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                order: currentHostname && currentHostname.length > 20 ? 2 : 1,
                justifyContent: "flex-end"
              }}>
              {isSiteEnabled && (
                <span style={{ fontSize: 11, color: "#AAA" }}>
                  {currentTemperature}K
                </span>
              )}
              {currentTimeString && (
                <span style={{ fontSize: 11, color: "#AAA" }}>
                  {currentTimeString}
                </span>
              )}
              <button
                type="button"
                onClick={async () => {
                  // Reset persisted settings
                  await storageResetSettings()
                  await clearForcedTemperature()

                  // Reset local state to defaults
                  const d = getDefaultSettings()
                  setIsEnabled(d.enabled)
                  setDaytimeTime24("06:00")
                  setSunsetTime24("18:00")
                  setBedtimeTime24("22:00")
                  setDaytimeTemp(d.daytimeTemp)
                  setSunsetTemp(d.sunsetTemp)
                  setBedtimeTemp(d.bedtimeTemp)

                  // Reset site-specific state - after reset, all sites should be enabled
                  setIsSiteEnabled(true)

                  // Exit preview
                  setIsPreviewMode(false)

                  // Save new settings to trigger background/content updates
                  const s: CircadianSettings = {
                    enabled: d.enabled,
                    daytimeStart: d.daytimeStart,
                    sunsetStart: d.sunsetStart,
                    bedtimeStart: d.bedtimeStart,
                    daytimeTemp: d.daytimeTemp,
                    sunsetTemp: d.sunsetTemp,
                    bedtimeTemp: d.bedtimeTemp
                  }
                  await saveSettings(s)
                  // Immediately compute and publish the current temperature so overlay updates now
                  const now = getCurrentUnixTime()
                  const period = getCurrentPeriod(
                    now,
                    d.daytimeStart,
                    d.sunsetStart,
                    d.bedtimeStart
                  )
                  const temp =
                    period === "Daytime"
                      ? d.daytimeTemp
                      : period === "Sunset"
                        ? d.sunsetTemp
                        : d.bedtimeTemp
                  await saveCurrentTemperature(temp)
                }}
                title="Reset settings"
                style={{
                  fontSize: 11,
                  color: "#DDD",
                  background: "#1E1E1E",
                  border: "1px solid #2A2A2A",
                  padding: "2px 6px",
                  borderRadius: 3,
                  cursor: "pointer"
                }}>
                Reset
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Period Selection */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            gap: 3,
            backgroundColor: "#1A1A1A",
            border: "1px solid #2A2A2A",
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
                onClick={async () => {
                  if (isCurrentPeriod) {
                    // Clicking current period - exit preview mode
                    setIsPreviewMode(false)
                    await clearForcedTemperature()
                    // Immediately recalculate and apply the correct current temperature
                    const now = getCurrentUnixTime()
                    const currentPeriod = getCurrentPeriod(
                      now,
                      daytimeStart,
                      sunsetStart,
                      bedtimeStart
                    )
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
                  } else {
                    // Clicking different period - enter preview mode
                    setIsPreviewMode(true)
                    setActivePeriod(period)
                    // Save a forced temperature for 10s so content and background apply immediately
                    const temp = getTemperatureForPeriod(period)
                    await saveForcedTemperature(temp, Date.now() + 10_000)
                  }
                }}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  border: "1px solid #2A2A2A",
                  borderRadius: 3,
                  backgroundColor: isSelected ? "#1F1F1F" : "transparent",
                  color: isSelected ? "#EEE" : "#AAA",
                  fontWeight: isSelected ? 600 : 400,
                  cursor: "pointer",
                  fontSize: 11,
                  boxShadow: isSelected ? "0 1px 2px rgba(0,0,0,0.4)" : "none"
                }}>
                {period}
              </button>
            )
          })}
        </div>

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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 500,
                width: 70,
                color: "#DDD"
              }}>
              Daytime:
            </label>
            <input
              type="time"
              value={daytimeTime24}
              onChange={(e) => setDaytimeTime24(e.target.value)}
              style={{
                padding: "4px 6px",
                border: "1px solid #2A2A2A",
                background: "#1E1E1E",
                color: "#EEE",
                colorScheme: "dark",
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
                min="1500"
                max="6500"
                value={daytimeTemp}
                onChange={async (e) => {
                  const v = parseInt(e.target.value, 10)
                  setDaytimeTemp(v)
                  // If adjusting active period, apply immediately without animation
                  if (activePeriod === "Daytime" && isSiteEnabled) {
                    await saveCurrentTemperature(v)
                    // Mark instant apply flag for content script
                    const { markInstantApplyOnce } = await import(
                      "~/utils/storage"
                    )
                    await markInstantApplyOnce()
                  }
                }}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 3,
                  outline: "none",
                  cursor: "pointer",
                  accentColor: daytimeSliderColor
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: "#AAA",
                  width: 50,
                  textAlign: "right"
                }}>
                {daytimeTemp}K
              </span>
            </div>
          </div>

          {/* Sunset */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 500,
                width: 70,
                color: "#DDD"
              }}>
              Sunset:
            </label>
            <input
              type="time"
              value={sunsetTime24}
              onChange={(e) => setSunsetTime24(e.target.value)}
              style={{
                padding: "4px 6px",
                border: "1px solid #2A2A2A",
                background: "#1E1E1E",
                color: "#EEE",
                colorScheme: "dark",
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
                min="1500"
                max="6500"
                value={sunsetTemp}
                onChange={async (e) => {
                  const v = parseInt(e.target.value, 10)
                  setSunsetTemp(v)
                  if (activePeriod === "Sunset" && isSiteEnabled) {
                    await saveCurrentTemperature(v)
                    const { markInstantApplyOnce } = await import(
                      "~/utils/storage"
                    )
                    await markInstantApplyOnce()
                  }
                }}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 3,
                  outline: "none",
                  cursor: "pointer",
                  accentColor: sunsetSliderColor
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: "#AAA",
                  width: 50,
                  textAlign: "right"
                }}>
                {sunsetTemp}K
              </span>
            </div>
          </div>

          {/* Bedtime */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 500,
                width: 70,
                color: "#DDD"
              }}>
              Bedtime:
            </label>
            <input
              type="time"
              value={bedtimeTime24}
              onChange={(e) => setBedtimeTime24(e.target.value)}
              style={{
                padding: "4px 6px",
                border: "1px solid #2A2A2A",
                background: "#1E1E1E",
                color: "#EEE",
                colorScheme: "dark",
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
                min="1500"
                max="6500"
                value={bedtimeTemp}
                onChange={async (e) => {
                  const v = parseInt(e.target.value, 10)
                  setBedtimeTemp(v)
                  if (activePeriod === "Bedtime" && isSiteEnabled) {
                    await saveCurrentTemperature(v)
                    const { markInstantApplyOnce } = await import(
                      "~/utils/storage"
                    )
                    await markInstantApplyOnce()
                  }
                }}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 3,
                  outline: "none",
                  cursor: "pointer",
                  accentColor: bedtimeSliderColor
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: "#AAA",
                  width: 50,
                  textAlign: "right"
                }}>
                {bedtimeTemp}K
              </span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 10,
            color: "#AAA",
            textDecoration: "none",
            display: "inline-block",
            transition: "color 0.2s"
          }}>
          v{browserAPI()?.runtime.getManifest().version}
        </span>
        <a
          href="https://github.com/Pasithea0/circadian-extension"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 10,
            color: "#AAA",
            textDecoration: "none",
            display: "inline-block",
            transition: "color 0.2s"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#DDD"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#AAA"
          }}>
          Github ↗
        </a>
      </div>
    </div>
  )
}

export default IndexPopup
