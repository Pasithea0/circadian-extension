import React from "react"

import { saveCurrentTemperature } from "~/utils/storage"

interface TemperatureSliderProps {
  label: string
  timeValue: string
  onTimeChange: (value: string) => void
  temperatureValue: number
  onTemperatureChange: (value: number) => void
  sliderColor: string
  activePeriod: string
  period: string
  isSiteEnabled: boolean
}

export function TemperatureSlider({
  label,
  timeValue,
  onTimeChange,
  temperatureValue,
  onTemperatureChange,
  sliderColor,
  activePeriod,
  period,
  isSiteEnabled
}: TemperatureSliderProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 500,
          width: 70,
          color: "#DDD"
        }}>
        {label}:
      </label>
      <input
        type="time"
        value={timeValue}
        onChange={(e) => onTimeChange(e.target.value)}
        style={{
          padding: "4px 6px",
          border: "1px solid #2A2A2A",
          background: "#1E1E1E",
          color: "#EEE",
          colorScheme: "dark",
          borderRadius: 3,
          fontSize: 11
        }}
      />
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 6
        }}>
        <input
          type="range"
          min="1500"
          max="6500"
          value={temperatureValue}
          onChange={async (e) => {
            const v = parseInt(e.target.value, 10)
            onTemperatureChange(v)
            if (activePeriod === period && isSiteEnabled) {
              await saveCurrentTemperature(v)
              const { markInstantApplyOnce } = await import("~/utils/storage")
              await markInstantApplyOnce()
            }
          }}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 3,
            outline: "none",
            cursor: "pointer",
            accentColor: sliderColor
          }}
        />
        <span
          style={{
            fontSize: 10,
            color: "#AAA",
            width: 50,
            textAlign: "right"
          }}>
          {temperatureValue}K
        </span>
      </div>
    </div>
  )
}
