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

export function getDefaultSettings(): CircadianSettings {
  return {
    enabled: true,
    daytimeStart: "6:00 AM",
    sunsetStart: "6:00 PM",
    bedtimeStart: "10:00 PM",
    daytimeTemp: 6000,
    sunsetTemp: 4500,
    bedtimeTemp: 2600
  }
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
      daytimeTemp: result[STORAGE_KEYS.DAYTIME_TEMP] ?? 6000,
      sunsetTemp: result[STORAGE_KEYS.SUNSET_TEMP] ?? 4500,
      bedtimeTemp: result[STORAGE_KEYS.BEDTIME_TEMP] ?? 2600
    }
  } catch (error) {
    console.error("Failed to load settings:", error)
    // Return defaults
    return getDefaultSettings()
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

/**
 * Forced temperature (preview) support
 */
const FORCED_KEYS = {
  TEMP: "circadian_forced_temp",
  EXPIRES: "circadian_forced_temp_expires"
} as const

export async function saveForcedTemperature(
  temperature: number,
  expiresAt: number
): Promise<void> {
  try {
    await chrome.storage.local.set({
      [FORCED_KEYS.TEMP]: temperature,
      [FORCED_KEYS.EXPIRES]: expiresAt
    })
  } catch (error) {
    console.error("Failed to save forced temperature:", error)
  }
}

export async function loadForcedTemperature(): Promise<{
  temperature: number | null
  expiresAt: number | null
}> {
  try {
    const result = await chrome.storage.local.get([
      FORCED_KEYS.TEMP,
      FORCED_KEYS.EXPIRES
    ])
    return {
      temperature: result[FORCED_KEYS.TEMP] ?? null,
      expiresAt: result[FORCED_KEYS.EXPIRES] ?? null
    }
  } catch (error) {
    console.error("Failed to load forced temperature:", error)
    return { temperature: null, expiresAt: null }
  }
}

export async function clearForcedTemperature(): Promise<void> {
  try {
    await chrome.storage.local.remove([FORCED_KEYS.TEMP, FORCED_KEYS.EXPIRES])
  } catch (error) {
    console.error("Failed to clear forced temperature:", error)
  }
}

/**
 * Reset all settings to defaults and clear current/forced temperatures
 */
export async function resetSettings(): Promise<void> {
  const defaults = getDefaultSettings()
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.ENABLED]: defaults.enabled,
      [STORAGE_KEYS.DAYTIME_START]: defaults.daytimeStart,
      [STORAGE_KEYS.SUNSET_START]: defaults.sunsetStart,
      [STORAGE_KEYS.BEDTIME_START]: defaults.bedtimeStart,
      [STORAGE_KEYS.DAYTIME_TEMP]: defaults.daytimeTemp,
      [STORAGE_KEYS.SUNSET_TEMP]: defaults.sunsetTemp,
      [STORAGE_KEYS.BEDTIME_TEMP]: defaults.bedtimeTemp,
      [STORAGE_KEYS.CURRENT_TEMP]: null
    })
    await clearForcedTemperature()
  } catch (error) {
    console.error("Failed to reset settings:", error)
  }
}
