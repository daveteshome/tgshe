import React from "react";

export function QuantityStepper({ value, onDec, onInc }: { value: number; onDec: () => void; onInc: () => void }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button style={chip} onClick={onDec}>-</button>
      <span>{value}</span>
      <button style={chip} onClick={onInc}>+</button>
    </div>
  );
}

const chip: React.CSSProperties = { border: "1px solid rgba(0,0,0,.15)", borderRadius: 8, background: "transparent", padding: "2px 8px" };