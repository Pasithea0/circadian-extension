import {
  clearForcedTemperature,
  loadForcedTemperature,
  loadSettings,
  saveCurrentTemperature
} from "~/utils/storage"
import { getCurrentPeriod, getCurrentUnixTime } from "~/utils/time"

let forcedExpiryTimer: number | null = null

/**
 * Get temperature for a period from settings
 */
function getTemperatureForPeriod(
  period: "Daytime" | "Sunset" | "Bedtime",
  settings: {
    daytimeTemp: number
    sunsetTemp: number
    bedtimeTemp: number
  }
): number {
  switch (period) {
    case "Daytime":
      return settings.daytimeTemp
    case "Sunset":
      return settings.sunsetTemp
    case "Bedtime":
      return settings.bedtimeTemp
  }
}

/**
 * Update the current temperature based on time and settings
 */
async function updateTemperature(): Promise<void> {
  try {
    // Check for forced (preview) temperature first
    const forced = await loadForcedTemperature()
    const now = Date.now()
    if (
      forced.temperature != null &&
      forced.expiresAt &&
      forced.expiresAt > now
    ) {
      await saveCurrentTemperature(forced.temperature)
      // schedule a refresh at expiry
      if (forcedExpiryTimer) {
        clearTimeout(forcedExpiryTimer)
      }
      forcedExpiryTimer = setTimeout(
        () => {
          updateTemperature()
        },
        Math.max(0, forced.expiresAt - now + 20)
      ) as unknown as number
      return
    }
    // Clear expired forced temp and any pending timer
    if (forced.expiresAt && forced.expiresAt <= now) {
      if (forcedExpiryTimer) {
        clearTimeout(forcedExpiryTimer)
        forcedExpiryTimer = null
      }
      await clearForcedTemperature()
    }

    // Load settings
    const settings = await loadSettings()

    // Check if extension is enabled
    if (!settings.enabled) {
      return
    }

    // Get current time and calculate period
    const currentTime = getCurrentUnixTime()
    const currentPeriod = getCurrentPeriod(
      currentTime,
      settings.daytimeStart || "6:00 AM",
      settings.sunsetStart || "6:00 PM",
      settings.bedtimeStart || "10:00 PM"
    )

    // Calculate temperature for current period
    const temperature = getTemperatureForPeriod(currentPeriod, {
      daytimeTemp: settings.daytimeTemp ?? 5500,
      sunsetTemp: settings.sunsetTemp ?? 3300,
      bedtimeTemp: settings.bedtimeTemp ?? 2700
    })

    // Save current temperature
    await saveCurrentTemperature(temperature)
  } catch (error) {
    console.error("Failed to update temperature:", error)
  }
}

// Update temperature immediately on startup
updateTemperature()

// Update temperature every minute
setInterval(() => {
  updateTemperature()
}, 60000) // 60 seconds

// Also listen for storage changes to update immediately when settings change
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    // Update temperature when settings change
    updateTemperature()
  }
})
