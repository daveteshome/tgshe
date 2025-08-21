import { db } from '../lib/db';
import { ENV } from '../config/env';

let cachedDefaultTenantId: string | null = null;

/** Returns the current/default tenant id (cached). */
export async function getTenantId(): Promise<string> {
  if (cachedDefaultTenantId) return cachedDefaultTenantId;
  const t = await db.tenant.findUnique({ where: { slug: ENV.DEFAULT_TENANT_SLUG } });
  if (!t) throw new Error(`Default tenant not found for slug=${ENV.DEFAULT_TENANT_SLUG}`);
  cachedDefaultTenantId = t.id;
  return t.id;
}