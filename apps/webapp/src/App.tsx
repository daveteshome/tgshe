//app.tsx

import React, { useEffect, useState } from "react";
import Home from "./routes/Home";
import Cart from "./routes/Cart";
import Profile from "./routes/Profile";
import Orders from "./routes/Orders";
import OrderDetail from "./routes/OrderDetail";
import { NavBar } from "./components/layout/NavBar";
import type { Tab } from "./components/layout/NavBar";
import { ready } from "./lib/telegram";
import { refreshCartCount } from "./lib/store";

export default function App() {
  useEffect(() => {
    ready();
    refreshCartCount();
  }, []);

  const [tab, setTab] = useState<Tab>("shop");
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  return (
    <div style={app}>
      <main style={{ paddingBottom: 72 }}>
        {openOrderId ? (
          <OrderDetail id={openOrderId} onBack={() => setOpenOrderId(null)} />
        ) : tab === "shop" ? (
          <Home />
        ) : tab === "cart" ? (
          <Cart />
        ) : tab === "orders" ? (
          <Orders onOpen={setOpenOrderId} />
        ) : (
          <Profile />
        )}
      </main>
      <NavBar tab={tab} setTab={setTab} />
    </div>
  );
}

const app: React.CSSProperties = {
  maxWidth: 860,
  margin: "0 auto",
  padding: 10,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif",
  background: "var(--tg-theme-bg-color, #fff)",
  color: "var(--tg-theme-text-color, #111)",
};
