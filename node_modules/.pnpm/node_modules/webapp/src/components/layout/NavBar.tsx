import React from "react";
import { useCartCount } from "../../lib/store";

export type Tab = "shop" | "cart" | "orders" | "profile";

export function NavBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const cartCount = useCartCount();

  return (
    <nav style={styles.bottomNav}>
      <button style={tab === "shop" ? styles.tabActive : styles.tab} onClick={() => setTab("shop")}>Shop</button>
      <button style={tab === "cart" ? styles.tabActive : styles.tab} onClick={() => setTab("cart")}>
        Cart {cartCount ? <span style={styles.badge}>{cartCount}</span> : null}
      </button>
      <button style={tab === "orders" ? styles.tabActive : styles.tab} onClick={() => setTab("orders")}>Orders</button>
      <button style={tab === "profile" ? styles.tabActive : styles.tab} onClick={() => setTab("profile")}>Profile</button>
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 6,
    padding: 8,
    background: "var(--tg-theme-bg-color, #fff)",
    borderTop: "1px solid rgba(0,0,0,.08)",
  },
  tab: { border: "1px solid rgba(0,0,0,.12)", background: "transparent", padding: "8px 10px", borderRadius: 10 },
  tabActive: { border: "1px solid rgba(0,0,0,.2)", background: "rgba(0,0,0,.06)", padding: "8px 10px", borderRadius: 10, fontWeight: 700 },
  badge: {
    marginLeft: 6,
    display: "inline-block",
    background: "rgba(0,0,0,.1)",
    padding: "1px 6px",
    borderRadius: 999,
    fontSize: 12,
  },
};