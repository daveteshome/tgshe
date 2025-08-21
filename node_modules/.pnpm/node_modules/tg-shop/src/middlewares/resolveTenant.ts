import type { Request, Response, NextFunction } from 'express';
import { db } from '../lib/db';
import { ENV } from '../config/env';

/**
 * Resolve tenant by :slug (if present) or ENV.DEFAULT_TENANT_SLUG.
 * Attaches req.tenant and req.tenantId.
 * Uses a tiny cast to avoid dev-time type issues if augmentation isn't loaded.
 */
export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const slugFromRoute = (req.params as any)?.slug as string | undefined;
    const slug = slugFromRoute || ENV.DEFAULT_TENANT_SLUG || 'demo';

    const tenant = await db.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: 'tenant_not_found', slug });

    const r = req as any;      // <— safe runtime write
    r.tenant = tenant;
    r.tenantId = tenant.id;

    next();
  } catch (err) {
    next(err);
  }
}
