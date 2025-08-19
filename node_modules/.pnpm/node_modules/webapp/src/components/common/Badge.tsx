import React from "react";
export function Badge({ children }: { children: React.ReactNode }) {
  return <span style={{ display: "inline-block", background: "rgba(0,0,0,.06)", padding: "2px 8px", borderRadius: 999, fontSize: 12 }}>{children}</span>;
}