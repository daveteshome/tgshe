import React from "react";
import { api } from "../lib/api";

type CartItem = {
  id: string;
  title?: string;
  qty?: number;
  price?: number;
  currency?: string;
  photoUrl?: string | null;
};
type CartData = { items?: CartItem[]; total?: number; currency?: string };

export default function Cart() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");
  const [data, setData] = React.useState<CartData | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api<CartData>("/cart");
        if (!alive) return;
        setData(d || { items: [] });
        setError("");
      } catch (e: any) {
        const msg = normalizeError(String(e?.message || e));
        if (!alive) return;
        setError(msg);
        setData({ items: [] });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div style={{ padding: 16 }}>Loading cart…</div>;
  if (error)   return <div style={{ padding: 16, color: "#900" }}>{error}</div>;

  const items = data?.items ?? [];
  if (!items.length) return <div style={{ padding: 16 }}>Your cart is empty.</div>;

  const total = safeNumber(data?.total);
  const currency = data?.currency || items[0]?.currency || "";

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      {items.map((it) => (
        <article key={it.id} style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden", display: "grid", gridTemplateColumns: "72px 1fr" }}>
          <div style={{ width: 72, height: 72, background: "#fafafa", display: "grid", placeItems: "center" }}>
            {it.photoUrl ? (
              <img src={it.photoUrl} alt={it.title || "Item"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ color: "#999", fontSize: 12 }}>No image</span>
            )}
          </div>
          <div style={{ padding: 10 }}>
            <div style={{ fontWeight: 600 }}>{it.title || "Item"}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              {it.currency || currency} {formatMoney(safeNumber(it.price))}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Qty: {safeNumber(it.qty, 1)}</div>
          </div>
        </article>
      ))}

      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
        <strong>Total</strong>
        <strong>{currency} {formatMoney(total)}</strong>
      </div>
    </div>
  );
}

function normalizeError(msg: string) {
  const insideTG = !!(window as any)?.Telegram?.WebApp;
  if (/401|unauthorized|authorization|tma/i.test(msg)) {
    return insideTG
      ? "Could not verify your Telegram session. Try reopening the shop from the bot."
      : "Please open this shop inside Telegram to view your cart.";
  }
  if (/fetch failed|network/i.test(msg)) return "Network error while loading cart. Check your connection.";
  return msg || "Failed to load cart.";
}
function safeNumber(n: any, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}
function formatMoney(n: number) {
  return n.toFixed(2);
}
