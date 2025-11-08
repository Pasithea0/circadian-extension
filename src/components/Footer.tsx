import React from "react"

import { browserAPI } from "~/utils/browser"

export function Footer() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span
        style={{
          fontSize: 10,
          color: "#AAA",
          textDecoration: "none",
          display: "inline-block",
          transition: "color 0.2s"
        }}>
        v{browserAPI()?.runtime.getManifest().version}
      </span>
      <a
        href="https://github.com/Pasithea0/circadian-extension"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 10,
          color: "#AAA",
          textDecoration: "none",
          display: "inline-block",
          transition: "color 0.2s"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#DDD"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#AAA"
        }}>
        Github ↗
      </a>
    </div>
  )
}
