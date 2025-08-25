// apps/webapp/src/components/DrawerMenu.tsx
import React from "react";
import { Link } from "react-router-dom";

type Props = { open: boolean; onClose: () => void };

export default function DrawerMenu({ open, onClose }: Props) {
  React.useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const Item = (p: React.PropsWithChildren<{ to: string }>) => (
    <Link to={p.to} onClick={onClose} style={itemStyle}>
      {p.children}
    </Link>
  );

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)",
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
          transition: "opacity .2s ease", zIndex: 49,
        }}
      />
      <aside
        role="dialog"
        aria-modal
        style={{
          position: "fixed", top: 0, left: 0, width: "86%", maxWidth: 340, height: "100dvh",
          background: "#fff", boxShadow: "2px 0 20px rgba(0,0,0,0.12)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform .22s ease", zIndex: 50, display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ padding: 16, borderBottom: "1px solid #eee", fontWeight: 700, fontSize: 18 }}>Menu</div>

        <nav style={{ padding: 8, display: "grid", gap: 4 }}>
          <Item to="/">🏠 Home</Item>
          <Item to="/categories">🗂️ Shop by Category</Item>
          <Item to="/orders">📦 My Orders</Item>
          <Item to="/cart">🛒 Cart</Item>
          <Item to="/profile">👤 Profile</Item>
        </nav>

        <div style={{ marginTop: "auto", padding: 12 }}>
          <button
            onClick={() => { /* TODO: logout */ onClose(); }}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #eee", background: "#f8fafc", fontWeight: 600 }}
          >
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}

const itemStyle: React.CSSProperties = {
  display: "block",
  padding: "12px 12px",
  borderRadius: 10,
  textDecoration: "none",
  color: "#111",
  border: "1px solid #f1f5f9",
  background: "#fff",
};
