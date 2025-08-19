import React from "react";
import type { Order } from "../../lib/types";
import { money } from "../../lib/format";

export function OrderSummary({ order }: { order: Order }) {
  return (
    <div style={panel}>
      <div style={rowBetween}><span>Status</span><strong>{order.status}</strong></div>

      {order.shippingAddress && (
        <div style={{ marginTop: 8 }}>
          <div style={{ opacity: 0.7 }}>Shipping address</div>
          <div>{order.shippingAddress}</div>
        </div>
      )}

      <div style={{ marginTop: 12, fontWeight: 600 }}>Items</div>
      {order.items.map((it) => (
        <div key={it.id} style={rowBetween}>
          <div>{it.title} × {it.qty}</div>
          <div>{money(it.price * it.qty, order.currency)}</div>
        </div>
      ))}

      <div style={{ marginTop: 12, ...rowBetween }}>
        <div>Total</div>
        <div style={{ fontWeight: 700 }}>{money(order.total, order.currency)}</div>
      </div>
    </div>
  );
}

const panel: React.CSSProperties = { border: "1px solid rgba(0,0,0,.08)", borderRadius: 12, padding: 12, marginTop: 12 };
const rowBetween: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 };
