import React from "react";
import { TopBar } from "../components/layout/TopBar";
import { Loader } from "../components/common/Loader";
import { ErrorView } from "../components/common/ErrorView";
import { OrderListItem } from "../components/orders/OrderListItem";
import { useAsync } from "../lib/hooks/useAsync";
import { listOrders } from "../lib/api/orders";
import type { Order } from "../lib/types";

export default function Orders({ onOpen }: { onOpen: (id: string) => void }) {
  const q = useAsync<Order[]>(() => listOrders(20), []);
  return (
    <div>
      <TopBar title="My Orders" />
      {q.loading ? <Loader /> : <ErrorView error={q.error} />}
      <div>
        {(q.data || []).map((o) => (
          <OrderListItem key={o.id} order={o} onClick={() => onOpen(o.id)} />
        ))}
        {(q.data || []).length === 0 && <div style={{ opacity: 0.7 }}>No orders yet.</div>}
      </div>
    </div>
  );
}
