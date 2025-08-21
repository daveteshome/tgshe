import type { Request } from "express";
import { Prisma } from "@prisma/client";

/**
 * Returns authenticated Telegram user id (string).
 * Prefers req.userId (set by telegramAuth). Falls back to legacy req.user?.tgId.
 * Uses a tiny cast to avoid compile errors if augmentation isn't picked up.
 */
export function requireAuth(req: Request): string {
  const r = req as any;
  const tgId: string | undefined = r.userId ?? r.user?.tgId;
  if (!tgId) {
    throw Object.assign(new Error("Unauthorized"), { status: 401, code: "UNAUTHORIZED" as const });
  }
  return String(tgId);
}

/**
 * Returns current tenant id (string).
 * Prefers req.tenantId (set by resolveTenant). Falls back to req.tenant?.id.
 */
export function requireTenant(req: Request): string {
  const r = req as any;
  const tenantId: string | undefined = r.tenantId ?? r.tenant?.id;
  if (!tenantId) {
    throw Object.assign(new Error("Tenant missing"), { status: 400, code: "TENANT_MISSING" as const });
  }
  return String(tenantId);
}

export function dec(v: string | number) {
  return new Prisma.Decimal(v);
}

/** Simple 6-char base36 shortcode from cuid-like id */
export function shortCode(id: string) {
  const clean = id.replace(/[^a-z0-9]/gi, "");
  const slice = clean.slice(-8);
  const n = parseInt(slice, 36) || Math.floor(Math.random() * 36 ** 6);
  return n.toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
}
