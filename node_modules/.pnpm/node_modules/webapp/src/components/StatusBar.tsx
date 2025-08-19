// apps/webapp/src/components/StatusBar.tsx
import React from 'react'
export const StatusBar: React.FC<{ status:'idle'|'ok'|'error'; message?:string; user?:string }>
= ({ status, message, user }) => {
  const bg = status==='ok' ? '#e6ffed' : status==='error' ? '#ffe6e6' : '#f2f2f2'
  const color = status==='ok' ? '#046d2e' : status==='error' ? '#7a0000' : '#333'
  return (
    <div style={{ background:bg, color, padding:'10px 12px', borderRadius:12, margin:'12px' }}>
      <strong>{status==='ok'?'Connected':status==='error'?'Error':'Starting…'}</strong>
      {user ? <span style={{ marginLeft:8 }}>· {user}</span> : null}
      {message ? <div style={{ fontSize:12, opacity:0.9 }}>{message}</div> : null}
    </div>
  )
}