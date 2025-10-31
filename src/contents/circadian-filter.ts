import type { PlasmoCSConfig } from "plasmo"

import { browserAPI, isRuntimeAvailable } from "~/utils/browser"
import { kelvinToOverlayColor } from "~/utils/color"
import {
  consumeInstantApplyOnce,
  loadCurrentTemperature,
  loadForcedTemperature,
  loadSettings
} from "~/utils/storage"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

// use shared isRuntimeAvailable from utils/browser

let lastTemperature: number | null = null
let overlayEl: HTMLDivElement | null = null
let intervalId: number | null = null
let lastAutoAppliedAt = 0

/**
 * Create or update the circadian filter overlay
 */
function ensureOverlay(): HTMLDivElement {
  if (overlayEl && document.body.contains(overlayEl)) {
    return overlayEl
  }
  overlayEl = document.createElement("div")
  overlayEl.id = "circadian-filter-overlay"
  overlayEl.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2147483647;
    mix-blend-mode: color;
    transition: none;
  `
  document.body.appendChild(overlayEl)
  return overlayEl
}

function removeOverlay(): void {
  if (overlayEl && overlayEl.parentElement) {
    overlayEl.parentElement.removeChild(overlayEl)
  }
  overlayEl = null
}

function setOverlayTemperature(temperature: number): void {
  const el = ensureOverlay()
  el.style.backgroundColor = kelvinToOverlayColor(temperature)
}

function applyTemperature(
  temperature: number,
  mode: "auto" | "preview" | "instant"
): void {
  const el = ensureOverlay()
  // Choose transition based on mode
  if (mode === "auto") {
    el.style.transition = "background-color 1.5s ease-in-out"
    lastAutoAppliedAt = Date.now()
  } else if (mode === "preview") {
    el.style.transition = "background-color 0.2s ease"
  } else {
    // instant
    el.style.transition = "none"
  }
  setOverlayTemperature(temperature)
  lastTemperature = temperature
}

/**
 * Update filter based on stored temperature and enabled state
 */
async function updateFilter(): Promise<void> {
  // Skip if runtime unavailable (e.g., during dev reloads)
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
    return
  }
  const settings = await loadSettings()

  // Only apply filter if extension is enabled
  if (!settings.enabled) {
    lastTemperature = null
    removeOverlay()
    return
  }

  // Prefer forced (preview) temperature if present and valid
  const forced = await loadForcedTemperature()
  const now = Date.now()
  if (
    forced.temperature != null &&
    forced.expiresAt &&
    forced.expiresAt > now
  ) {
    // Preview: short transition
    applyTemperature(forced.temperature, "preview")
    return
  }

  const temperature = await loadCurrentTemperature()
  if (temperature != null) {
    const instant = await consumeInstantApplyOnce()
    if (instant) {
      applyTemperature(temperature, "instant")
      return
    }
    // Automatic time-based change: avoid spamming transitions when manually messing around with it
    const nowTs = Date.now()
    const timeSince = nowTs - lastAutoAppliedAt
    const delta =
      lastTemperature == null
        ? Infinity
        : Math.abs(temperature - lastTemperature)
    if (timeSince > 3000 || delta >= 25) {
      applyTemperature(temperature, "auto")
    } else if (lastTemperature == null) {
      applyTemperature(temperature, "instant")
    }
  }
}

// Initialize filter on page load
updateFilter()

// Listen for storage changes to update filter immediately
try {
  const api = browserAPI()
  api?.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === "local") {
      if (!isRuntimeAvailable()) return
      if (
        changes.circadian_enabled ||
        changes.circadian_current_temp ||
        changes.circadian_forced_temp ||
        changes.circadian_forced_temp_expires
      ) {
        await updateFilter()
      }
    }
  })
} catch {
  // ignore listener errors during dev reload
}

// Also update periodically (every minute) to catch any missed updates
intervalId = setInterval(() => {
  if (!isRuntimeAvailable()) return
  updateFilter()
}, 60000) as unknown as number

// Cleanup on unload to prevent callbacks after context invalidation
function cleanup(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}
window.addEventListener("beforeunload", cleanup)
