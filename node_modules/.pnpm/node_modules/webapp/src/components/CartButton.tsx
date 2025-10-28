// apps/webapp/src/components/CartButton.tsx
import React from "react";
import { useCartCount } from "../lib/store";

export function CartButton({ onClick }: { onClick?: () => void }) {
  const n = useCartCount();             // 🔁 auto-updates on setCartCount(...)
  return (
    <button onClick={onClick} style={btn}>
      <span style={{ fontSize: 18 }}>🛒</span>
      {n > 0 && <span style={badge}>{n}</span>}
    </button>
  );
}

const btn: React.CSSProperties = {
  position: "relative",
  border: "none",
  background: "transparent",
  padding: 6,
  cursor: "pointer",
};

const badge: React.CSSProperties = {
  position: "absolute",
  top: -2,
  right: -2,
  minWidth: 18,
  height: 18,
  borderRadius: 9,
  fontSize: 12,
  lineHeight: "18px",
  textAlign: "center",
  padding: "0 4px",
  background: "#e33",
  color: "#fff",
};
