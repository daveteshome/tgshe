import { ENV } from '../../config/env';
export const isAdmin = () => (ctx: any, next: () => Promise<void>) => {
  const id = String(ctx.from?.id || '');
  if (!ENV.ADMIN_IDS.includes(id)) return; // silently ignore non-admin
  return next();
};
