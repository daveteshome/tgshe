// apps/webapp/src/lib/api.ts
export const API_BASE = (import.meta as any).env.VITE_API_BASE || '/api'
export async function apiGet<T>(path:string){
  const initData = (window as any).Telegram?.WebApp?.initData || ''
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'x-telegram-init-data': initData } })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<T>
}