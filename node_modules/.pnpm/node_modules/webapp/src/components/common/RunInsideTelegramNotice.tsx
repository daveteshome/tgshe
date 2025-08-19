import React from "react";

export default function RunInsideTelegramNotice({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div style={box}>
      <strong>Not running inside Telegram.</strong>
      <div style={{ marginTop: 4 }}>
        Open the bot and tap <em>“🛍️ Open Shop”</em> (web_app button). For Telegram Web, use the latest web app or Telegram Desktop/Mobile.
      </div>
    </div>
  );
}

const box: React.CSSProperties = {
  border: "1px solid rgba(255,0,0,.35)",
  color: "#a00",
  background: "rgba(255,0,0,.06)",
  padding: 10,
  borderRadius: 10,
  marginBottom: 8,
};
