// apps/webapp/src/components/TopBar.tsx
import React from 'react'
export const TopBar: React.FC<{ title:string }>=({ title })=>{
  return (
    <div style={{ position:'sticky', top:0, background:'#fff', padding:'8px 12px', borderBottom:'1px solid #eee', zIndex:5 }}>
      <h3 style={{ margin:0 }}>{title}</h3>
    </div>
  )
}