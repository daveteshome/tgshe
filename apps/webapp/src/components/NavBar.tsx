// apps/webapp/src/components/NavBar.tsx
import React from 'react'
import { Link, useLocation } from 'react-router-dom'

export const NavBar: React.FC = () => {
  const loc = useLocation()
  const tab = (to:string, label:string) => (
    <Link to={to} style={{ textDecoration:'none', color: loc.pathname.startsWith(to) ? '#111' : '#666' }}>{label}</Link>
  )
  return (
    <nav style={{ position:'sticky', bottom:0, background:'#fff', padding:'10px 12px', borderTop:'1px solid #eee', display:'flex', gap:16, justifyContent:'space-around' }}>
      {tab('/', 'Home')}
      {tab('/c', 'Catalog')}
      {tab('/cart', 'Cart')}
      {tab('/orders', 'Orders')}
      {tab('/profile', 'Profile')}
    </nav>
  )
}