// apps/backend/src/lib/r2.ts
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import crypto from "node:crypto";
import { imageSize } from "image-size";
import { db } from "./db";
import { ENV } from "../config/env";

// ------- S3 client for R2 -------
export const R2_BUCKET = ENV.R2_BUCKET;
export const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ENV.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ENV.R2_ACCESS_KEY_ID,
    secretAccessKey: ENV.R2_SECRET_ACCESS_KEY,
  },
});

function normalizeMime(m: string | null | undefined): string {
  if (!m) return "image/jpeg";
  const lower = m.toLowerCase();
  if (lower.includes("png")) return "image/png";
  if (lower.includes("webp")) return "image/webp";
  if (lower.includes("jpeg") || lower.includes("jpg")) return "image/jpeg";
  return "image/jpeg";
}

function extFromMimeOrType(mime: string, detectedType?: string): "jpg" | "png" | "webp" {
  const t = (detectedType || "").toLowerCase();
  if (t === "png") return "png";
  if (t === "webp") return "webp";
  if (t === "jpg" || t === "jpeg") return "jpg";

  const lower = mime.toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("webp")) return "webp";
  return "jpg";
}

/**
 * Upload bytes to R2 and ensure an Image row exists for FK integrity.
 * Satisfies required Prisma fields in your schema: id, tenantId, mime, sha256, bucketKeyBase, width, height.
 * (Notice: NO `ext` field here, because your schema doesn't have it.)
 */
export async function upsertImageFromBytes(
  bytes: Buffer | Uint8Array,
  mime: string | null | undefined,
  tenantId: string
) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

  // Read dimensions (best-effort)
  let width = 0;
  let height = 0;
  let detectedType: string | undefined;
  try {
    const dim = imageSize(buf);
    width = (dim.width ?? 0) as number;
    height = (dim.height ?? 0) as number;
    detectedType = dim.type;
  } catch (e) {
    console.warn("[r2:upsertImage] could not detect dimensions", (e as Error)?.message);
  }

  const mimeNorm = normalizeMime(mime);
  const ext = extFromMimeOrType(mimeNorm, detectedType); // used ONLY for object key naming
  const bucketKeyBase = `images/${sha256}`;
  const key = `${bucketKeyBase}/orig.${ext}`;

  // 1) Upload to R2
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buf,
      ContentType: mimeNorm,
      CacheControl: "public, max-age=31536000, immutable",
      ContentDisposition: "inline", // show in browser, don't force download
    })
  );

  // 2) Upsert Image row WITHOUT `ext` (since your schema doesn't have it).
  //    Width is required by your schema (and height likely is too).
  await db.image.upsert({
    where: { id: sha256 },
    update: {
      tenantId,
      mime: mimeNorm as any,
      sha256,
      bucketKeyBase,
      width,
      height,
    } as any,
    create: {
      id: sha256,
      tenantId,
      mime: mimeNorm as any,
      sha256,
      bucketKeyBase,
      width,
      height,
    } as any,
  });

  console.log("[r2:upsertImage] uploaded", { id: sha256, key, mime: mimeNorm, width, height, tenantId });
  return { id: sha256, key, mime: mimeNorm, width, height };
}

// Public URL builder (dev or CDN). We default to jpg path; if you stored png/webp,
// you can pass that explicitly where you call this.
export function publicImageUrl(imageId: string, ext: "jpg" | "png" | "webp" = "jpg"): string {
  const base = (ENV.R2_PUBLIC_BASE || "").replace(/\/+$/, "");
  return `${base}/images/${imageId}/orig.${ext}`;
}

// Optional: verify metadata exists (handy for debugging)
export async function headObject(key: string) {
  return s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
