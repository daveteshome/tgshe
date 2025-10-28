import React from "react";
import { useParams, Link } from "react-router-dom";
import { money } from "../lib/format";
import { api } from "../lib/api"; // your existing helper
import { ProductCard } from "../components/product/ProductCard";

type ProductDTO = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  stock: number;
  photoUrl: string | null;
  apiImage: string;       // /api/products/:id/image
  categoryId: string | null;
};

export default function ProductPage() {
  const { id } = useParams();
  const [p, setP] = React.useState<ProductDTO | null>(null);
  const [related, setRelated] = React.useState<ProductDTO[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const prod = await api.get<ProductDTO>(`/products/${id}`);
        setP(prod);
        if (prod?.categoryId) {
          const rel = await api.get<ProductDTO[]>(`/products/${prod.id}/related?limit=8`);
          setRelated(rel.filter(r => r.id !== prod.id));
        } else {
          setRelated([]);
        }
      } catch (e: any) {
        setErr(e?.message || String(e));
      }
    })();
  }, [id]);

  if (err) return <div style={{ padding:12 }}>Error: {err}</div>;
  if (!p)   return <div style={{ padding:12 }}>Loading…</div>;

  const img = p.photoUrl || p.apiImage;
  console.log("[PRODUCT IMG]", p.id, "→", img);

  return (
    <div style={{ padding: 12, display:"grid", gap:12 }}>
      {/* Product detail */}
      <div style={{ display:"grid", gap:10 }}>
        <div style={{ aspectRatio: "1/1", background:"#f2f2f2", borderRadius:12, overflow:"hidden" }}>
          <img
            src={img}
            alt={p.title}
            style={{ width:"100%", height:"100%", objectFit:"cover" }}
            onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none'; }}
          />
        </div>
        <h1 style={{ margin:0 }}>{p.title}</h1>
        {p.description && <div style={{ opacity:.85 }}>{p.description}</div>}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <strong>{money(p.price, p.currency)}</strong>
          <span style={{ opacity:.7 }}>{p.stock ?? 0} in stock</span>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <Link to="/" style={linkBtn}>Back to products</Link>
        </div>
      </div>

      {/* More products */}
      {!!related.length && (
        <div>
          <div style={{ fontWeight:700, margin:"6px 0 10px" }}>More products</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {related.map(r => (
              <ProductCard key={r.id} p={r} onAdd={async()=>{ /* reuse your add */ }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  border:"1px solid rgba(0,0,0,.12)", padding:"8px 12px", borderRadius:10, textDecoration:"none", color:"inherit"
};
