// apps/webapp/src/components/DebugMobile.tsx
export default function DebugMobile() {
  return (
    <div>
      <h3>Mobile Debug</h3>
      <p>WebApp available: {!!(window as any).Telegram?.WebApp ? 'Yes' : 'No'}</p>
      <p>InitData: {(window as any).Telegram?.WebApp?.initData || 'None'}</p>
      <p>URL Search: {window.location.search}</p>
      <p>URL Hash: {window.location.hash}</p>
      <button onClick={() => window.location.reload()}>Reload</button>
    </div>
  );
}