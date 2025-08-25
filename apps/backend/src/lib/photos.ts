// apps/backend/src/bot/lib/photos.ts
export function extractTelegramFileId(ref?: string | null): string | null {
  if (!ref) return null;
  const m = /^tg:file_id:(.+)$/i.exec(ref);
  return m ? m[1] : null;
}

export async function sendProductPhoto(ctx: any, ref: string | null, opts: any) {
  const fid = extractTelegramFileId(ref ?? "");
  if (fid) return ctx.replyWithPhoto(fid, opts);
  if (ref && /^https?:\/\//i.test(ref)) return ctx.replyWithPhoto({ url: ref }, opts);
  // no image: fallback to caption-only
  return ctx.reply(opts?.caption ?? " ", { parse_mode: opts?.parse_mode, reply_markup: opts?.reply_markup });
}
