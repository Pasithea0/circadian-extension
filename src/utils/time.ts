/**
 * Get the current Unix timestamp in milliseconds
 * @returns Unix timestamp in milliseconds (e.g., 1698765432000)
 */
export function getCurrentUnixTime(): number {
  return Date.now()
}

/**
 * Get the current Unix timestamp in seconds
 * @returns Unix timestamp in seconds (e.g., 1698765432)
 */
export function getCurrentUnixTimeSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * Format a Unix timestamp (in milliseconds) to a readable date string
 * @param timestamp Unix timestamp in milliseconds
 * @returns Formatted date string (e.g., "10/30/2023, 4:50:32 PM")
 */
export function formatUnixTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

/**
 * Format a Unix timestamp (in milliseconds) to a time string
 * @param timestamp Unix timestamp in milliseconds
 * @returns Formatted time string (e.g., "4:50:32 PM")
 */
export function formatUnixTimeOnly(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}

/**
 * Parse a time string (e.g., "6:00 AM", "6:30 PM") to minutes since midnight
 * @param timeString Time string in format "H:MM AM/PM" or "HH:MM AM/PM"
 * @returns Minutes since midnight (0-1439), or null if parsing fails
 */
export function parseTimeString(timeString: string): number | null {
  const trimmed = timeString.trim()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)

  if (!match) return null

  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const ampm = match[3].toUpperCase()

  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null

  // Convert to 24-hour format
  if (ampm === "AM") {
    if (hours === 12) hours = 0
  } else {
    // PM
    if (hours !== 12) hours += 12
  }

  return hours * 60 + minutes
}

/**
 * Parse a time string to hours, minutes, and AM/PM
 * @param timeString Time string in format "H:MM AM/PM" or "HH:MM AM/PM"
 * @returns Object with hours (1-12), minutes (0-59), and ampm ("AM" | "PM"), or null if parsing fails
 */
export function parseTimeToComponents(
  timeString: string
): { hours: number; minutes: number; ampm: "AM" | "PM" } | null {
  const trimmed = timeString.trim()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)

  if (!match) return null

  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const ampm = match[3].toUpperCase() as "AM" | "PM"

  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null

  return { hours, minutes, ampm }
}

/**
 * Format hours, minutes, and AM/PM to time string
 * @param hours Hours in 12-hour format (1-12)
 * @param minutes Minutes (0-59)
 * @param ampm "AM" or "PM"
 * @returns Time string in format "H:MM AM/PM"
 */
export function formatTimeFromComponents(
  hours: number,
  minutes: number,
  ampm: "AM" | "PM"
): string {
  const paddedMinutes = minutes.toString().padStart(2, "0")
  return `${hours}:${paddedMinutes} ${ampm}`
}

/**
 * Convert 12-hour format time string to 24-hour format for time input
 * @param timeString Time string in format "H:MM AM/PM" or "HH:MM AM/PM"
 * @returns Time string in 24-hour format "HH:MM" or null if parsing fails
 */
export function convertTo24Hour(timeString: string): string | null {
  const components = parseTimeToComponents(timeString)
  if (!components) return null

  let hours24 = components.hours
  if (components.ampm === "PM" && hours24 !== 12) {
    hours24 += 12
  } else if (components.ampm === "AM" && hours24 === 12) {
    hours24 = 0
  }

  const paddedHours = hours24.toString().padStart(2, "0")
  const paddedMinutes = components.minutes.toString().padStart(2, "0")
  return `${paddedHours}:${paddedMinutes}`
}

/**
 * Convert 24-hour format time string to 12-hour format
 * @param time24Hour Time string in format "HH:MM" (24-hour)
 * @returns Time string in format "H:MM AM/PM" or null if parsing fails
 */
export function convertFrom24Hour(time24Hour: string): string | null {
  const match = time24Hour.match(/^(\d{1,2}):(\d{2})$/i)
  if (!match) return null

  let hours24 = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)

  if (hours24 < 0 || hours24 > 23 || minutes < 0 || minutes > 59) return null

  let hours12 = hours24
  const ampm: "AM" | "PM" = hours24 >= 12 ? "PM" : "AM"

  if (hours24 === 0) {
    hours12 = 12
  } else if (hours24 > 12) {
    hours12 = hours24 - 12
  }

  const paddedMinutes = minutes.toString().padStart(2, "0")
  return `${hours12}:${paddedMinutes} ${ampm}`
}

/**
 * Calculate the current period based on time of day and user-defined start times
 * @param timestamp Unix timestamp in milliseconds
 * @param daytimeStart Time string for daytime start (e.g., "6:00 AM")
 * @param sunsetStart Time string for sunset start (e.g., "6:00 PM")
 * @param bedtimeStart Time string for bedtime start (e.g., "10:00 PM")
 * @returns "Daytime" | "Sunset" | "Bedtime"
 */
export function getCurrentPeriod(
  timestamp: number,
  daytimeStart: string = "6:00 AM",
  sunsetStart: string = "6:00 PM",
  bedtimeStart: string = "10:00 PM"
): "Daytime" | "Sunset" | "Bedtime" {
  const date = new Date(timestamp)
  const currentHour = date.getHours()
  const currentMinute = date.getMinutes()
  const currentTime = currentHour * 60 + currentMinute // minutes since midnight

  const daytimeTime = parseTimeString(daytimeStart) ?? 6 * 60 // Default 6 AM
  const sunsetTime = parseTimeString(sunsetStart) ?? 18 * 60 // Default 6 PM
  const bedtimeTime = parseTimeString(bedtimeStart) ?? 22 * 60 // Default 10 PM

  // Handle periods across midnight
  if (bedtimeTime < daytimeTime) {
    // Bedtime wraps around midnight (e.g., 10 PM to 6 AM)
    if (currentTime >= bedtimeTime || currentTime < daytimeTime) {
      return "Bedtime"
    } else if (currentTime >= daytimeTime && currentTime < sunsetTime) {
      return "Daytime"
    } else {
      return "Sunset"
    }
  } else {
    // Normal order: Daytime -> Sunset -> Bedtime
    if (currentTime >= daytimeTime && currentTime < sunsetTime) {
      return "Daytime"
    } else if (currentTime >= sunsetTime && currentTime < bedtimeTime) {
      return "Sunset"
    } else {
      return "Bedtime"
    }
  }
}

/**
 * Format duration in minutes to a human-readable string
 * @param minutes Duration in minutes
 * @returns Formatted string (e.g., "25 minutes", "1 hour", "2 hours")
 */
export function formatDuration(minutes: number): string {
  const absMinutes = Math.abs(minutes)

  if (absMinutes < 60) {
    return `${Math.round(absMinutes)} ${Math.round(absMinutes) === 1 ? "minute" : "minutes"}`
  }

  const hours = absMinutes / 60
  const roundedHours = Math.round(hours)
  return `${roundedHours} ${roundedHours === 1 ? "hour" : "hours"}`
}

/**
 * Format time difference with "ago" or "from now"
 * @param minutes Time difference in minutes (negative = past, positive = future)
 * @returns Formatted string (e.g., "25 minutes ago", "12 hours from now")
 */
export function formatTimeDifference(minutes: number): string {
  const formatted = formatDuration(minutes)
  if (minutes < 0) {
    return `${formatted} ago`
  } else {
    return `${formatted} from now`
  }
}

/**
 * Calculate when the current period started
 * @param currentTimestamp Current Unix timestamp in milliseconds
 * @param period Current period
 * @param daytimeStart Time string for daytime start (e.g., "6:00 AM")
 * @param sunsetStart Time string for sunset start (e.g., "6:00 PM")
 * @param bedtimeStart Time string for bedtime start (e.g., "10:00 PM")
 * @returns Unix timestamp when the period started
 */
export function getPeriodStartTime(
  currentTimestamp: number,
  period: "Daytime" | "Sunset" | "Bedtime",
  daytimeStart: string = "6:00 AM",
  sunsetStart: string = "6:00 PM",
  bedtimeStart: string = "10:00 PM"
): number {
  const date = new Date(currentTimestamp)
  const currentHour = date.getHours()
  const currentMinute = date.getMinutes()
  const currentTime = currentHour * 60 + currentMinute

  let periodStartMinutes = 0

  if (period === "Daytime") {
    periodStartMinutes = parseTimeString(daytimeStart) ?? 6 * 60
  } else if (period === "Sunset") {
    periodStartMinutes = parseTimeString(sunsetStart) ?? 18 * 60
  } else {
    // Bedtime
    periodStartMinutes = parseTimeString(bedtimeStart) ?? 22 * 60
  }

  const periodStartHour = Math.floor(periodStartMinutes / 60)
  const periodStartMin = periodStartMinutes % 60

  const periodStart = new Date(date)
  periodStart.setHours(periodStartHour, periodStartMin, 0, 0)

  // Handle bedtime wrapping around midnight
  if (period === "Bedtime") {
    const bedtimeTime = parseTimeString(bedtimeStart) ?? 22 * 60
    const daytimeTime = parseTimeString(daytimeStart) ?? 6 * 60

    // If bedtime wraps around midnight and current time is before daytime
    if (bedtimeTime > daytimeTime && currentTime < daytimeTime) {
      // Period started yesterday
      periodStart.setDate(periodStart.getDate() - 1)
    }
  }

  // If period start is in the future (shouldn't happen, but handle it)
  if (periodStart.getTime() > currentTimestamp) {
    // Must have wrapped around - go back one day
    periodStart.setDate(periodStart.getDate() - 1)
  }

  return periodStart.getTime()
}

/**
 * Calculate when the next daytime period will be
 * @param currentTimestamp Current Unix timestamp in milliseconds
 * @param daytimeStart Time string for daytime start (e.g., "6:00 AM")
 * @returns Unix timestamp when next daytime period starts
 */
export function getNextDaytimeStart(
  currentTimestamp: number,
  daytimeStart: string = "6:00 AM"
): number {
  const date = new Date(currentTimestamp)
  const currentHour = date.getHours()
  const currentMinute = date.getMinutes()
  const currentTime = currentHour * 60 + currentMinute

  const daytimeMinutes = parseTimeString(daytimeStart) ?? 6 * 60
  const daytimeHour = Math.floor(daytimeMinutes / 60)
  const daytimeMin = daytimeMinutes % 60

  const nextDaytime = new Date(date)
  nextDaytime.setHours(daytimeHour, daytimeMin, 0, 0)

  // If it's already past daytime start today, next daytime is tomorrow
  if (currentTime >= daytimeMinutes) {
    nextDaytime.setDate(nextDaytime.getDate() + 1)
  }

  return nextDaytime.getTime()
}

/**
 * Get temperature for a given period (placeholder - will be replaced with proper calculations)
 * @param period Period type
 * @returns Color temperature in Kelvin
 */
export function getPeriodTemperature(
  period: "Daytime" | "Sunset" | "Bedtime"
): number {
  // Placeholder temperatures
  switch (period) {
    case "Daytime":
      return 5500 // Cool daylight
    case "Sunset":
      return 3300 // Warm sunset
    case "Bedtime":
      return 2700 // Very warm bedtime
    default:
      return 4000
  }
}
