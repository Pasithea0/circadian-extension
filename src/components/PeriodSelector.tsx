import React from "react"

import { browserAPI } from "~/utils/browser"
import {
  clearForcedTemperature,
  saveCurrentTemperature,
  saveForcedTemperature
} from "~/utils/storage"
import { getCurrentPeriod, getCurrentUnixTime } from "~/utils/time"

interface PeriodSelectorProps {
  activePeriod: "Daytime" | "Sunset" | "Bedtime"
  currentTime: number | null
  daytimeStart: string
  sunsetStart: string
  bedtimeStart: string
  setIsPreviewMode: (preview: boolean) => void
  setActivePeriod: (period: "Daytime" | "Sunset" | "Bedtime") => void
  getTemperatureForPeriod: (period: "Daytime" | "Sunset" | "Bedtime") => number
}

export function PeriodSelector({
  activePeriod,
  currentTime,
  daytimeStart,
  sunsetStart,
  bedtimeStart,
  setIsPreviewMode,
  setActivePeriod,
  getTemperatureForPeriod
}: PeriodSelectorProps) {
  return (
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
    </div>
  )
}
