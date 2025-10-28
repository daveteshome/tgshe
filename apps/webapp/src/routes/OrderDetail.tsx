import React from "react";
import { TopBar } from "../components/layout/TopBar";

import { Loader } from "../components/common/Loader";
import { ErrorView } from "../components/common/ErrorView";
import { OrderSummary } from "../components/orders/OrderSummary";
import { getOrder } from "../lib/api/orders";
import { useAsync } from "../lib/hooks/useAsync";
import type { Order } from "../lib/types";

export default function OrderDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const q = useAsync<Order>(() => getOrder(id), [id]);

  return (
    <div>
      <TopBar title={`Order #${id.slice(0, 6)}`} right={<button style={btn} onClick={onBack}>Back</button>} />
      {q.loading ? <Loader /> : <ErrorView error={q.error} />}
      {q.data && <OrderSummary order={q.data} />}
    </div>
  );
}

const btn: React.CSSProperties = { border: "1px solid rgba(0,0,0,.15)", background: "transparent", padding: "8px 12px", borderRadius: 10 };
