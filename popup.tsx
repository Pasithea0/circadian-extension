import React from "react"

function IndexPopup() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: 16,
        width: 300,
      }}>
      <h2>Circadian Extension</h2>
      <p>Optimize your sleep and productivity with circadian rhythms</p>

      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => {
            // TODO: Implement circadian rhythm features
            console.log("Circadian extension activated!")
          }}
          style={{
            padding: "8px 16px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}>
          Get Started
        </button>
      </div>
    </div>
  )
}

export default IndexPopup
