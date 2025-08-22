// apps/webapp/src/routes/Categories.tsx
import React from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api/index'

type Category = { id:string; title:string }

export default function Categories(){
  const [cats, setCats] = React.useState<Category[]|null>(null)
  const [err, setErr] = React.useState<string>('')

  React.useEffect(()=>{
    api<Category[]>('/categories')
      .then(setCats)
      .catch(e=> setErr(String(e?.message||'Failed to load categories')))
  },[])

  if (err) return <div style={{ padding:16, color:'#900' }}>{err}</div>
  if (!cats) return <div style={{ padding:16 }}>Loading categories…</div>

  return (
    <div style={{ padding:16, display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:12 }}>
      {cats.map(c => (
        <Link key={c.id} to={`/c/${c.id}`} style={{ padding:12, border:'1px solid #eee', borderRadius:12, textDecoration:'none', color:'#111' }}>
          {c.title}
        </Link>
      ))}
    </div>
  )
}