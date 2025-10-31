import type { PlasmoManifest } from "plasmo"

export default async function defineManifest(
  manifest: PlasmoManifest
): Promise<PlasmoManifest> {
  ;(manifest as any).browser_specific_settings = {
    gecko: {
      id: "{6f4f2a20-9f6c-4a87-9cf5-5d4e9a3c1b2e}",
      strict_min_version: "109.0"
    }
  }
  return manifest
}
