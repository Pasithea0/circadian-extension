import type { PlasmoCSConfig } from "plasmo"

import { browserAPI, isRuntimeAvailable } from "~/utils/browser"
import { kelvinToOverlayColor } from "~/utils/color"
import {
  consumeInstantApplyOnce,
  isHostnameExcluded,
  loadCurrentTemperature,
  loadForcedTemperature
} from "~/utils/storage"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

// use shared isRuntimeAvailable from utils/browser

let lastTemperature: number | null = null
let overlayEl: HTMLDivElement | null = null
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
    top: -50dvh;
    left: -50dvw;
    width: 200dvw;
    height: 200dvh;
    pointer-events: none;
    z-index: 2147483647;
    mix-blend-mode: multiply;
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
    el.style.transition = "background-color 30s ease-in-out"
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
 * Update filter based on stored temperature and hostname exclusion
 */
async function updateFilter(
  mode: "auto" | "preview" | "instant" = "auto"
): Promise<void> {
  // Skip if runtime unavailable (e.g., during dev reloads)
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
    return
  }

  const hostname = window.location.hostname
  const isExcluded = await isHostnameExcluded(hostname)

  // Only apply filter if hostname is not excluded
  if (isExcluded) {
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

    // Use forced mode if specified, otherwise use automatic logic
    if (mode !== "auto") {
      applyTemperature(temperature, mode)
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
        changes.circadian_excluded_hostnames ||
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

// Listen for messages from background script to force updates
try {
  const api = browserAPI()
  api?.runtime.onMessage.addListener(async (message) => {
    if (message.action === "updateFilter") {
      const mode = message.mode === "preview" ? "preview" : "auto"
      await updateFilter(mode)
    }
  })
} catch {
  // ignore message listener errors during dev reload
}

// Content script updates are now handled by background script triggers
