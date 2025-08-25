import { db } from "./db";

function resolveTenantBotToken(slug?: string, token?: string) {
  return (
    token ||
    (slug ? process.env[`BOT_TOKEN__${slug.toUpperCase()}`] : undefined) ||
    process.env.BOT_TOKEN
  );
}

export async function downloadFileByIdForTenant(fileId: string, tenantId: string) {
  const t = await db.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, botToken: true } });
  const botToken = resolveTenantBotToken(t?.slug ?? undefined, t?.botToken ?? undefined);
  if (!botToken) throw new Error("BOT_TOKEN not configured for this tenant");

  const f = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`).then(r => r.json());
  const path = f?.result?.file_path;
  if (!path) throw new Error("Telegram getFile failed");

  const resp = await fetch(`https://api.telegram.org/file/bot${botToken}/${path}`);
  if (!resp.ok) throw new Error(`Telegram file fetch ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());

  // naive mime guess; Telegram doesn’t send strong type here
  const ct = resp.headers.get("content-type") || "image/jpeg";
  return { bytes: buf, mime: ct };
}
