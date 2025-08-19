import React from "react";
import { money } from "../../lib/format";

export function CartSummary({
  total,
  currency,
  onCheckout,
  children,
}: {
  total: number;
  currency: string;
  onCheckout: () => void;
  children?: React.ReactNode; // address form etc.
}) {
  return (
    <div style={panel}>
      <div style={rowBetween}>
        <strong>Total</strong>
        <strong>{money(total, currency)}</strong>
      </div>
      {children}
      <button style={primaryBtn} onClick={onCheckout}>Checkout</button>
    </div>
  );
}

const panel: React.CSSProperties = { border: "1px solid rgba(0,0,0,.08)", borderRadius: 12, padding: 12, marginTop: 12 };
const rowBetween: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 };
const primaryBtn: React.CSSProperties = { border: "none", background: "var(--tg-theme-button-color, #2481cc)", color: "var(--tg-theme-button-text-color, #fff)", padding: "10px 12px", borderRadius: 10, width: "100%", marginTop: 8 };
