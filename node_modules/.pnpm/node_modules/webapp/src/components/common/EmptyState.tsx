import React from "react";
export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div style={{ opacity: 0.7 }}>{children}</div>;
}