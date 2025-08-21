import { Router } from 'express';
import { resolveTenant } from '../middlewares/resolveTenant';
import { db } from '../lib/db';

const shop = Router();

// All routes under /shop/:slug/* will have tenant resolved
shop.use('/:slug', resolveTenant);

// Example: GET /shop/:slug/products — list active products for this tenant
shop.get('/:slug/products', async (req, res) => {
  const r = req as any;                              // <— avoid TS complaint
  const tenantId: string | undefined = r.tenantId ?? r.tenant?.id;
  if (!tenantId) return res.status(500).json({ error: 'tenant_not_resolved' });

  const products = await db.product.findMany({
    where: { tenantId, active: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json(products);
});

// Example: GET /shop/:slug — basic tenant info
shop.get('/:slug', async (req, res) => {
  const r = req as any;
  const tenant = r.tenant;
  if (!tenant) return res.status(500).json({ error: 'tenant_not_resolved' });
  res.json({ tenant });
});

export { shop };
