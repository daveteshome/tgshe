// src/bot/middlewares/ensureUser.ts
import { db } from '../../lib/db';

export const ensureUser = () => async (ctx: any, next: () => Promise<void>) => {
  if (!ctx.from) return next();
  const tgId = String(ctx.from.id);
  const name = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');
  const username = ctx.from.username || null;

  await db.user.upsert({
    where: { tgId },
    update: { name, username },
    create: { tgId, name, username },
  });

  return next();
};
