import { db } from "../lib/db";
import { publicImageUrl } from "../lib/r2";
import { ENV } from "../config/env"

/**
 * Try to convert an old Worker URL like:
 *   https://<worker>/img/images/<sha256>/orig[...]   →  https://<R2_PUBLIC_BASE>/images/<sha256>/orig.jpg
 */
function maybeConvertWorkerUrlToR2(url: string): string | null {
  try {
    const m = /\/images\/([0-9a-f]{64})\//i.exec(url);
    if (!m) return null;
    if (!ENV.R2_PUBLIC_BASE) {
      console.warn("[img] R2_PUBLIC_BASE missing; keeping legacy Worker URL");
      return null;
    }
    const sha = m[1];
    return publicImageUrl(sha, "jpg");
  } catch (e) {
    console.warn("[img] convert Worker→R2 failed; keeping legacy URL", { url, err: (e as Error).message });
    return null;
  }
}
/**
 * Best public web URL for the first image of a product.
 * - If `imageId` exists → R2 public URL
 * - Else if `tgFileId` → use your own proxy route (works without auth)
 * - Else if legacy `url` → return it (or convert Worker → R2 if we can)
 */
export async function firstImageWebUrl(productId: string): Promise<string | null> {
  const img = await db.productImage.findFirst({
    where: { productId },
    orderBy: { position: "asc" },
    select: { imageId: true, tgFileId: true, url: true },
  });

  if (!img) return null;

  if (img.imageId) {
    return publicImageUrl(img.imageId, "jpg");
  }

  if (img.tgFileId) {
    return `/api/products/${productId}/image`;
  }

  if (img.url) {
    // Convert legacy Worker URL if possible, otherwise return as-is
    const converted = maybeConvertWorkerUrlToR2(img.url);
    return converted || img.url;
  }

  return null;
}

/**
 * Telegram-only helper: turn first image ref into Telegraf's photo input.
 * Use this when sending product photos via bot (not needed on web).
 */
export async function resolveProductPhotoInput(productId: string) {
  const img = await db.productImage.findFirst({
    where: { productId },
    orderBy: { position: "asc" },
    select: { imageId: true, tgFileId: true, url: true },
  });
  if (!img) return null;

  if (img.tgFileId) return img.tgFileId;
  if (img.imageId) return { url: publicImageUrl(img.imageId, "jpg") };
  if (img.url && /^https?:\/\//i.test(img.url)) return { url: img.url };

  return null;
}
