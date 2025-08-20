// apps/webapp/src/lib/api/index.ts
import { getInitDataRaw } from "../telegram";

const API_BASE =  '/api';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers as HeadersInit);

  const raw = getInitDataRaw();
  console.log('API Call - InitData available:', !!raw, 'Path:', path);
  
  if (raw && !headers.has("Authorization")) {
    headers.set("Authorization", `tma ${raw}`);
    console.log('API Call - Authorization header set');
  } else if (!raw) {
    console.log('API Call - No initData available for Authorization');
  }

  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!headers.has("Content-Type") && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  console.log('API Call - Making request to:', `${API_BASE}${path}`);
  console.log('API Call - Headers:', Object.fromEntries(headers.entries()));

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });

    console.log('API Call - Response status:', res.status, res.statusText);
    
    if (!res.ok) {
      const text = await res.text();
      console.error('API Call - Error response:', text);
      throw new Error(text || `${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log('API Call - Success response:', data);
    return data;
  } catch (error) {
    console.error('API Call - Fetch error:', error);
    throw error;
  }
}