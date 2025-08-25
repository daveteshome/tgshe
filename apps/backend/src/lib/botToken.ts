import { db } from "./db";

// apps/backend/src/lib/botToken.ts
const cache = new Map<string, { token: string; exp: number }>();
const TTL_MS = 5 * 60 * 1000;

export async function getBotTokenForTenant(tenantId: string): Promise<string> {
  const now = Date.now();
  const hit = cache.get(tenantId);
  if (hit && hit.exp > now) return hit.token;

  const t = await db.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, botToken: true }});
  const token =
    t?.botToken
    ?? (t?.slug ? process.env[`BOT_TOKEN__${t.slug.toUpperCase()}`] : undefined)
    ?? process.env.BOT_TOKEN;

  if (!token) throw Object.assign(new Error("BOT_TOKEN not configured"), { status: 500 });

  cache.set(tenantId, { token, exp: now + TTL_MS });
  return token;
}
