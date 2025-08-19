import React from "react";
import type { CartItem } from "../../lib/types";
import { money } from "../../lib/format";
import { QuantityStepper } from "../common/QuantityStepper";

export function CartItemRow({
  item,
  onInc,
  onDec,
  onRemove,
}: {
  item: CartItem;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
}) {
  return (
    <div style={row}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{item.product.title}</div>
        <div style={{ opacity: 0.7 }}>{money(item.product.price, item.product.currency)}</div>
      </div>
      <QuantityStepper value={item.qty} onInc={onInc} onDec={onDec} />
      <button style={dangerBtn} onClick={onRemove}>Remove</button>
    </div>
  );
}

const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto auto",
  gap: 8,
  alignItems: "center",
  padding: "8px 0",
  borderBottom: "1px dashed rgba(0,0,0,.06)",
};
const dangerBtn: React.CSSProperties = { border: "1px solid rgba(255,0,0,.4)", color: "#b00", background: "transparent", padding: "6px 10px", borderRadius: 10 };
