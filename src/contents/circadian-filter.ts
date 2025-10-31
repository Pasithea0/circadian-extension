import type { PlasmoCSConfig } from "plasmo"

import { kelvinToOverlayColor } from "~/utils/color"
import {
  loadCurrentTemperature,
  loadForcedTemperature,
  loadSettings
} from "~/utils/storage"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

let lastTemperature: number | null = null
let currentDisplayTemperature: number | null = null
let animationFrame: number | null = null
let overlayEl: HTMLDivElement | null = null

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
  currentDisplayTemperature = temperature
}

/**
 * Update filter based on stored temperature and enabled state
 */
async function updateFilter(): Promise<void> {
  const settings = await loadSettings()

  // Only apply filter if extension is enabled
  if (!settings.enabled) {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
      animationFrame = null
    }
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
    // Preview: faster transition
    animateToTemperature(forced.temperature, 1000)
    return
  }

  const temperature = await loadCurrentTemperature()
  if (temperature != null) {
    // Normal period change: smoother transition
    animateToTemperature(temperature, 5000)
  }
}

// Initialize filter on page load
updateFilter()

// Listen for storage changes to update filter immediately
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === "local") {
    // Check if enabled state or temperature changed
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

// Also update periodically (every minute) to catch any missed updates
setInterval(() => {
  updateFilter()
}, 60000)

// Smooth transition between temperatures over 5 seconds
function animateToTemperature(target: number, duration: number = 5000): void {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }

  const startTemp = currentDisplayTemperature ?? lastTemperature ?? target
  const delta = target - startTemp
  if (Math.abs(delta) < 1) {
    setOverlayTemperature(target)
    lastTemperature = target
    return
  }

  const start = performance.now()

  const easeInOutCubic = (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

  const step = (now: number) => {
    const elapsed = now - start
    const progress = Math.min(1, elapsed / duration)
    const eased = easeInOutCubic(progress)
    const current = Math.round(startTemp + delta * eased)
    setOverlayTemperature(current)
    if (progress < 1) {
      animationFrame = requestAnimationFrame(step)
    } else {
      animationFrame = null
      lastTemperature = target
    }
  }

  ensureOverlay()
  animationFrame = requestAnimationFrame(step)
}
