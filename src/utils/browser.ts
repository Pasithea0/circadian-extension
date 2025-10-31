export type WebExtensionAPI = typeof chrome

export function browserAPI(): WebExtensionAPI | null {
  try {
    const g = globalThis as unknown as {
      browser?: WebExtensionAPI
      chrome?: WebExtensionAPI
    }
    const api = g.browser ?? g.chrome ?? null
    return api
  } catch {
    return null
  }
}

export function isRuntimeAvailable(): boolean {
  const api = browserAPI()
  try {
    return !!api && !!api.runtime && !!api.runtime.id
  } catch {
    return false
  }
}
