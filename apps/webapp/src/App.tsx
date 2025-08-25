// apps/webapp/src/App.tsx
import React, { useEffect, useState } from "react";
import Home from "./routes/Home";
import Cart from "./routes/Cart";
import Profile from "./routes/Profile";
import Orders from "./routes/Orders";
import OrderDetail from "./routes/OrderDetail";
import Categories from "./routes/Categories";
import Products from "./routes/Products";

import ErrorBoundary from "./components/common/ErrorBoundary";

import { Routes, Route, useLocation, useNavigate, useParams } from "react-router-dom";
import { NavBar } from "./components/layout/NavBar";
import type { Tab } from "./components/layout/NavBar";

import HeaderBar from "./components/layout/HeaderBar";
import DrawerMenu from "./components/DrawerMenu";

import { ready } from "./lib/telegram";
import { refreshCartCount } from "./lib/store";

function tabForPath(pathname: string): Tab {
  if (pathname.startsWith("/cart")) return "cart";
  if (pathname.startsWith("/orders")) return "orders";
  if (pathname.startsWith("/profile")) return "profile";
  return "shop";
}
function pathForTab(t: Tab): string {
  if (t === "cart") return "/cart";
  if (t === "orders") return "/orders";
  if (t === "profile") return "/profile";
  return "/";
}

export default function App() {
  useEffect(() => {
    ready();
    refreshCartCount();
  }, []);

  const [menuOpen, setMenuOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const tab = tabForPath(location.pathname);
  const setTab = (t: Tab) => navigate(pathForTab(t));

  return (
    <div style={app}>
      <ErrorBoundary>
                <HeaderBar onOpenMenu={() => setMenuOpen(true)} title="TG Shop" />
      <DrawerMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <main style={{ paddingBottom: 72 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/c/:categoryId" element={<Products />} />

          <Route
            path="/orders"
            element={<Orders onOpen={(id) => navigate(`/orders/${id}`)} />}
          />
          <Route path="/orders/:id" element={<OrderDetailRoute />} />

          <Route path="/cart" element={<Cart />} />
          <Route path="/profile" element={<Profile />} />

          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      <NavBar tab={tab} setTab={setTab} />
      </ErrorBoundary>

    </div>
  );
}

function OrderDetailRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  return <OrderDetail id={id!} onBack={() => navigate(-1)} />;
}

const app: React.CSSProperties = {
  maxWidth: 860,
  margin: "0 auto",
  padding: 10,
  fontFamily:
    "system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif",
  background: "var(--tg-theme-bg-color, #fff)",
  color: "var(--tg-theme-text-color, #111)",
};
