import { Telegraf } from 'telegraf';
import { db } from '../../../lib/db';
import { ENV } from '../../../config/env';
import { Publisher } from '../../../lib/publisher';

const awaitingPhotoFor = new Map<string, string>(); // key: admin tgId, value: productId

function isAdmin(ctx: any) {
  const id = String(ctx.from?.id || '');
  return ENV.ADMIN_IDS.includes(id);
}

export function registerAdminProductPhoto(bot: Telegraf) {
  bot.command('product_photo', async (ctx: any) => {
    if (!isAdmin(ctx)) return;
    const args = (ctx.message?.text || '').trim().split(/\s+/);
    const productId = args[1];

    if (!productId) {
      return ctx.reply('Usage: /product_photo <PRODUCT_ID>');
    }

    const p = await db.product.findUnique({ where: { id: productId } });
    if (!p) return ctx.reply('Product not found');

    awaitingPhotoFor.set(String(ctx.from.id), productId);
    await ctx.reply(
      `Send me the *photo* for:\n*${p.title}*\n\n(Next photo you send will be saved)`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.on('photo', async (ctx: any, next: any) => {
    if (!isAdmin(ctx)) return next();

    const adminId = String(ctx.from.id);
    const productId = awaitingPhotoFor.get(adminId);
    if (!productId) return next();

    const photos = ctx.message?.photo;
    if (!photos || !photos.length) return next();

    const fileId = photos[photos.length - 1].file_id;
    awaitingPhotoFor.delete(adminId);

    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, tenantId: true, title: true },
    });
    if (!product) return ctx.reply('Product not found');

    await db.productImage.create({
      data: {
        tenantId: product.tenantId,
        productId: product.id,
        url: `tg:file_id:${fileId}`,
        position: 0,
      },
    });

    await ctx.reply('✅ Photo saved to product.');

    try {
      await Publisher.postProduct(bot, productId);
      await ctx.reply('📣 Posted to group.');
    } catch (e: any) {
      await ctx.reply(`⚠️ Could not post to group: ${e.message || 'unknown error'}`);
    }
  });
}
