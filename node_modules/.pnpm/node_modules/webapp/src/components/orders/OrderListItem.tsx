import React from "react";
import type { Order } from "../../lib/types";
import { money, dateTime } from "../../lib/format";
import { Badge } from "../common/Badge";

export function OrderListItem({ order, onClick }: { order: Order; onClick: () => void }) {
  return (
    <div style={row} onClick={onClick}>
      <div>
        <div style={{ fontWeight: 600 }}>#{order.id.slice(0, 6)}</div>
        <div style={{ opacity: 0.7 }}>{dateTime(order.createdAt)}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div>{money(order.total, order.currency)}</div>
        <Badge>{order.status}</Badge>
      </div>
    </div>
  );
}

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 0",
  borderBottom: "1px dashed rgba(0,0,0,.06)",
  cursor: "pointer",
};
