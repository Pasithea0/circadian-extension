import React from "react"

import {
  addExcludedHostname,
  clearForcedTemperature,
  getDefaultSettings,
  removeExcludedHostname,
  saveCurrentTemperature,
  saveSettings,
  resetSettings as storageResetSettings,
  type CircadianSettings
} from "~/utils/storage"
import { getCurrentPeriod, getCurrentUnixTime } from "~/utils/time"

interface HeaderProps {
  currentHostname: string
  isSiteEnabled: boolean
  setIsSiteEnabled: (enabled: boolean) => void
  currentTemperature: number
  currentTimeString: string
  setIsEnabled: (enabled: boolean) => void
  setDaytimeTime24: (time: string) => void
  setSunsetTime24: (time: string) => void
  setBedtimeTime24: (time: string) => void
  setDaytimeTemp: (temp: number) => void
  setSunsetTemp: (temp: number) => void
  setBedtimeTemp: (temp: number) => void
  setIsPreviewMode: (preview: boolean) => void
}

export function Header({
  currentHostname,
  isSiteEnabled,
  setIsSiteEnabled,
  currentTemperature,
  currentTimeString,
  setIsEnabled,
  setDaytimeTime24,
  setSunsetTime24,
  setBedtimeTime24,
  setDaytimeTemp,
  setSunsetTemp,
  setBedtimeTemp,
  setIsPreviewMode
}: HeaderProps) {
  return (
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
              currentHostname && currentHostname.length > 20 ? "column" : "row",
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
  )
}
