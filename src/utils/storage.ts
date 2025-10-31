/**
 * Storage keys for circadian extension settings
 */
const STORAGE_KEYS = {
  ENABLED: "circadian_enabled",
  DAYTIME_START: "circadian_daytime_start",
  SUNSET_START: "circadian_sunset_start",
  BEDTIME_START: "circadian_bedtime_start",
  DAYTIME_TEMP: "circadian_daytime_temp",
  SUNSET_TEMP: "circadian_sunset_temp",
  BEDTIME_TEMP: "circadian_bedtime_temp",
  CURRENT_TEMP: "circadian_current_temp"
} as const

/**
 * Settings interface
 */
export interface CircadianSettings {
  enabled: boolean
  daytimeStart: string
  sunsetStart: string
  bedtimeStart: string
  daytimeTemp: number
  sunsetTemp: number
  bedtimeTemp: number
}

/**
 * Save settings to browser storage
 */
export async function saveSettings(settings: CircadianSettings): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.ENABLED]: settings.enabled,
      [STORAGE_KEYS.DAYTIME_START]: settings.daytimeStart,
      [STORAGE_KEYS.SUNSET_START]: settings.sunsetStart,
      [STORAGE_KEYS.BEDTIME_START]: settings.bedtimeStart,
      [STORAGE_KEYS.DAYTIME_TEMP]: settings.daytimeTemp,
      [STORAGE_KEYS.SUNSET_TEMP]: settings.sunsetTemp,
      [STORAGE_KEYS.BEDTIME_TEMP]: settings.bedtimeTemp
    })
  } catch (error) {
    console.error("Failed to save settings:", error)
  }
}

/**
 * Load settings from browser storage
 */
export async function loadSettings(): Promise<Partial<CircadianSettings>> {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.ENABLED,
      STORAGE_KEYS.DAYTIME_START,
      STORAGE_KEYS.SUNSET_START,
      STORAGE_KEYS.BEDTIME_START,
      STORAGE_KEYS.DAYTIME_TEMP,
      STORAGE_KEYS.SUNSET_TEMP,
      STORAGE_KEYS.BEDTIME_TEMP
    ])

    return {
      enabled: result[STORAGE_KEYS.ENABLED] ?? true,
      daytimeStart: result[STORAGE_KEYS.DAYTIME_START] ?? "6:00 AM",
      sunsetStart: result[STORAGE_KEYS.SUNSET_START] ?? "6:00 PM",
      bedtimeStart: result[STORAGE_KEYS.BEDTIME_START] ?? "10:00 PM",
      daytimeTemp: result[STORAGE_KEYS.DAYTIME_TEMP] ?? 5500,
      sunsetTemp: result[STORAGE_KEYS.SUNSET_TEMP] ?? 3300,
      bedtimeTemp: result[STORAGE_KEYS.BEDTIME_TEMP] ?? 2700
    }
  } catch (error) {
    console.error("Failed to load settings:", error)
    // Return defaults
    return {
      enabled: true,
      daytimeStart: "6:00 AM",
      sunsetStart: "6:00 PM",
      bedtimeStart: "10:00 PM",
      daytimeTemp: 5500,
      sunsetTemp: 3300,
      bedtimeTemp: 2700
    }
  }
}

/**
 * Save current temperature to browser storage
 */
export async function saveCurrentTemperature(
  temperature: number
): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CURRENT_TEMP]: temperature
    })
  } catch (error) {
    console.error("Failed to save current temperature:", error)
  }
}

/**
 * Load current temperature from browser storage
 */
export async function loadCurrentTemperature(): Promise<number | null> {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.CURRENT_TEMP])
    return result[STORAGE_KEYS.CURRENT_TEMP] ?? null
  } catch (error) {
    console.error("Failed to load current temperature:", error)
    return null
  }
}
