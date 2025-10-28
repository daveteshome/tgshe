import { Markup } from 'telegraf';
import { CartService } from '../../../services/cart.service';
import { OrdersService } from '../../../services/orders.service';
import { money } from '../../../lib/money';
import { getTenantId } from '../../../services/tenant.util';

const PLACEHOLDER = 'https://placehold.co/800x500/png?text=Product';

// helper: choose Telegram photo input
function photoInput(url?: string | null) {
  return url && /^https?:\/\//i.test(url) ? { url } : { url: PLACEHOLDER };
}

export const registerCartHandlers = (bot: any) => {
  // Add to cart (product card button)
  bot.action(/CART_ADD_(.+)/, async (ctx: any) => {
    console.log("[BOT added] tenantId=", await getTenantId(), "userId=", String(ctx.from.id));
    await ctx.answerCbQuery('Added to cart');
    const productId = ctx.match[1];
    const userId = String(ctx.from.id);
    await CartService.add(userId, productId, 1);
  });

  // View cart
  bot.action('CART_VIEW', async (ctx: any) => {
    
    await ctx.answerCbQuery();
    const userId = String(ctx.from.id);
    const cart = await CartService.list(userId);
    console.log("[BOT View] tenantId=", await getTenantId(), "userId=", String(ctx.from.id));


    if (!cart || cart.items.length === 0) {
      return ctx.reply('🧺 Your cart is empty.');
    }

    const total = cart.items.reduce((s, it) => s + it.price * it.qty, 0);

    for (const it of cart.items) {
      const line = `${it.title} x${it.qty} — ${money(it.price * it.qty, it.currency)}`;
      const kb = Markup.inlineKeyboard([
        [Markup.button.callback('➖', `CART_DEC_${it.id}`), Markup.button.callback('➕', `CART_INC_${it.id}`)],
      ]);
      const input = photoInput(it.imageUrl);

      try {
        await ctx.replyWithPhoto(input as any, { caption: line, reply_markup: kb.reply_markup });
      } catch {
        await ctx.reply(line, kb);
      }
    }

    const footer = Markup.inlineKeyboard([
      [Markup.button.callback('🧹 Clear', 'CART_CLEAR'), Markup.button.callback('✅ Checkout', 'CHECKOUT')],
    ]);
    await ctx.reply(`Total: ${money(total, cart.items[0]?.currency || 'ETB')}`, footer);
  });

  bot.action(/CART_INC_(.+)/, async (ctx: any) => {
    console.log("[CART] on Increment in cart ts,,,,,,,,,,,........... =");
    console.log("[BOT Inc] tenantId=", await getTenantId(), "userId=", String(ctx.from.id));
    await ctx.answerCbQuery('Increased');
    await CartService.inc(ctx.match[1]);
    await ctx.reply('Updated. Tap “🧺 View Cart” again to refresh.');
  });

  bot.action(/CART_DEC_(.+)/, async (ctx: any) => {
    console.log("[BOT dec] tenantId=", await getTenantId(), "userId=", String(ctx.from.id));
    await ctx.answerCbQuery('Decreased');
    await CartService.dec(ctx.match[1]);
    await ctx.reply('Updated. Tap “🧺 View Cart” again to refresh.');
  });

  bot.action('CART_CLEAR', async (ctx: any) => {
    console.log("[BOT clear] tenantId=", await getTenantId(), "userId=", String(ctx.from.id));
    await ctx.answerCbQuery('Cleared');
    await CartService.clear(String(ctx.from.id));
    await ctx.reply('🧺 Cart cleared.');
  });
};
