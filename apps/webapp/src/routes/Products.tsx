// apps/webapp/src/routes/Products.tsx
import React from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api/index'

type Product = { id:string; title:string; price:any; currency?:string; stock?:any; photoUrl?:string|null }
type PageResult = { items?: Product[]; total?: any; pages?: any; page?: any; perPage?: any }

export default function Products(){
  const { categoryId } = useParams()
  const [sp, setSp] = useSearchParams()
  const page = toNumber(sp.get('page') || 1, 1)

  const [data, setData] = React.useState<PageResult|null>(null)
  const [err, setErr] = React.useState('')

  React.useEffect(()=>{
    if (!categoryId) return
    setData(null)
    api<PageResult>(`/products?category=${encodeURIComponent(categoryId)}&page=${page}&perPage=12`)
      .then(setData)
      .catch(e=> setErr(String(e?.message||'Failed to load products')))
  },[categoryId, page])

  if (err) return <div style={{ padding:16, color:'#900' }}>{err}</div>
  if (!data) return <div style={{ padding:16 }}>Loading products…</div>

  const items = Array.isArray(data.items) ? data.items : []
  const pages = Math.max(1, toNumber(data.pages, 1))

  const prev = () => setSp({ page: String(Math.max(1, page-1)) })
  const next = () => setSp({ page: String(Math.min(pages, page+1)) })

  return (
    <div style={{ padding:16 }}>
  <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:12 }}>
    {items.map(p => {
      const price = money(p.price);
      const stock = toNumber(p.stock, 0);
      const inStock = stock > 0;
      const src = p.photoUrl || "";

      return (
        <article key={p.id} style={{ border:'1px solid #eee', borderRadius:12, overflow:'hidden' }}>
          <div style={{ aspectRatio:'1 / 1', background:'#fafafa', display:'grid', placeItems:'center' }}>
            {src ? (
              <img
                src={src}
                alt={p.title}
                style={{ width:'100%', height:'100%', objectFit:'cover' }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <span style={{ color:'#999' }}>No image</span>
            )}
          </div>
          <div style={{ padding:10 }}>
            <div style={{ fontWeight:600 }}>{p.title}</div>
            <div style={{ fontSize:13, opacity:0.8 }}>{p.currency ?? ''} {price}</div>
            <div style={{ fontSize:12, color: inStock ? '#067' : '#a00' }}>
              {inStock ? 'In stock' : 'Out of stock'}
            </div>
          </div>
        </article>
      )
    })}
  </div>

  <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:16 }}>
    <button disabled={page<=1} onClick={prev} style={{ padding:'8px 12px', borderRadius:10, border:'1px solid #ddd' }}>Prev</button>
    <span style={{ alignSelf:'center' }}>Page {page} / {pages}</span>
    <button disabled={page>=pages} onClick={next} style={{ padding:'8px 12px', borderRadius:10, border:'1px solid #ddd' }}>Next</button>
  </div>
</div>

  )
}

/* ---------- helpers ---------- */
function toNumber(v:any, fallback=0){
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : fallback
}
function money(v:any){
  const n = toNumber(v, 0)
  return n.toFixed(2)
}
