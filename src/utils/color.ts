/**
 * Convert Kelvin temperature to RGB color using Tanner Helland's algorithm
 * Based on the method from: http://www.tannerhelland.com/4435/convert-temperature-rgb-algorithm-code/
 * @param kelvin Temperature in Kelvin (1000-40000)
 * @returns RGB color as { r, g, b } (0-255)
 */
export function kelvinToRGB(kelvin: number): {
  r: number
  g: number
  b: number
} {
  // Clamp temperature to valid range
  const temp = Math.max(1000, Math.min(40000, kelvin))
  const normalizedTemp = temp / 100

  let r = 255
  let g = 255
  let b = 255

  // Red component
  if (normalizedTemp <= 66) {
    r = 255
  } else {
    r = 329.698727446 * Math.pow(normalizedTemp - 60, -0.1332047592)
    r = Math.max(0, Math.min(255, r))
  }

  // Green component
  if (normalizedTemp <= 66) {
    g = 99.4708025861 * Math.log(normalizedTemp) - 161.1195681661
    g = Math.max(0, Math.min(255, g))
  } else {
    g = 288.1221695283 * Math.pow(normalizedTemp - 60, -0.0755148492)
    g = Math.max(0, Math.min(255, g))
  }

  // Blue component
  if (normalizedTemp >= 66) {
    b = 255
  } else if (normalizedTemp <= 19) {
    b = 0
  } else {
    b = 138.5177312231 * Math.log(normalizedTemp - 10) - 305.0447927307
    b = Math.max(0, Math.min(255, b))
  }

  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b)
  }
}

/**
 * Convert RGB color to CSS filter values
 * This creates a color overlay effect
 * @param rgb RGB color object
 * @returns CSS filter string
 */
export function rgbToCSSFilter(rgb: {
  r: number
  g: number
  b: number
}): string {
  // Create a CSS filter that tints the page with the target color
  // We use a mix-blend-mode approach with a solid color overlay
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
}

/**
 * Convert temperature to CSS filter for color overlay
 * This creates a warm/cool filter effect
 * @param kelvin Temperature in Kelvin
 * @returns CSS color string for overlay
 */
export function kelvinToOverlayColor(kelvin: number): string {
  const rgb = kelvinToRGB(kelvin)
  // Opacity scales with distance from neutral daylight (6500K)
  // const neutral = 6500
  // const diff = Math.min(1, Math.abs(kelvin - neutral) / neutral)
  // const opacity = Math.max(0.18, Math.min(0.55, 0.2 + diff * 0.45))
  const opacity = 1
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
}
