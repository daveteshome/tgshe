import React from "react";

export function TopBar({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div style={styles.topbar}>
      <div style={{ fontWeight: 700, fontSize: 18 }}>{title}</div>
      <div>{right}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  topbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 4px",
    position: "sticky",
    top: 0,
    background: "var(--tg-theme-bg-color, #fff)",
    zIndex: 10,
    borderBottom: "1px solid rgba(0,0,0,.06)",
  },
};