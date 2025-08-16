import { Markup } from 'telegraf';
import { CartService } from '../../../services/cart.service';
import { OrdersService } from '../../../services/orders.service';
import { money } from '../../../lib/money';

const PLACEHOLDER = 'https://placehold.co/800x500/png?text=Product';

export const registerCartHandlers = (bot: any) => {
  // Add to cart (product card button)
  bot.action(/CART_ADD_(.+)/, async (ctx: any) => {
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

    if (!cart || cart.items.length === 0) {
      return ctx.reply('🧺 Your cart is empty.');
    }

    const total = cart.items.reduce((s, it) => s + it.product.price * it.qty, 0);

    for (const it of cart.items) {
      const line = `${it.product.title} x${it.qty} — ${money(it.product.price * it.qty, it.product.currency)}`;
      const kb = Markup.inlineKeyboard([
        [Markup.button.callback('➖', `CART_DEC_${it.id}`), Markup.button.callback('➕', `CART_INC_${it.id}`)],
      ]);

      const url = it.product.photoUrl?.startsWith('http') ? it.product.photoUrl : PLACEHOLDER;
      try {
        await ctx.replyWithPhoto({ url }, { caption: line, reply_markup: kb.reply_markup });
      } catch {
        await ctx.reply(line, kb);
      }
    }

    const footer = Markup.inlineKeyboard([
      [Markup.button.callback('🧹 Clear', 'CART_CLEAR'), Markup.button.callback('✅ Checkout', 'CHECKOUT')],
    ]);
    await ctx.reply(`Total: ${money(total)}`, footer);
  });

  bot.action(/CART_INC_(.+)/, async (ctx: any) => {
    await ctx.answerCbQuery('Increased');
    await CartService.inc(ctx.match[1]);
    await ctx.reply('Updated. Tap “🧺 View Cart” again to refresh.');
  });

  bot.action(/CART_DEC_(.+)/, async (ctx: any) => {
    await ctx.answerCbQuery('Decreased');
    await CartService.dec(ctx.match[1]);
    await ctx.reply('Updated. Tap “🧺 View Cart” again to refresh.');
  });

  bot.action('CART_CLEAR', async (ctx: any) => {
    await ctx.answerCbQuery('Cleared');
    await CartService.clear(String(ctx.from.id));
    await ctx.reply('🧺 Cart cleared.');
  });
};

// Minimal checkout (no phone/address in this pass)
export const registerCheckoutHandler = (bot: any) => {
  bot.action('CHECKOUT', async (ctx: any) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from.id);
    try {
      const order = await OrdersService.checkoutFromCartWithDetails(userId);
      await ctx.reply(
        `✅ Order placed!\n` +
        `#${order.id.slice(0,6)}\n` +
        `Total: ${money(order.total, order.currency)}\n` +
        `Status: ${order.status}\n(See “📜 My Orders”.)`
      );
    } catch (e: any) {
      await ctx.reply(`❌ Checkout failed: ${e.message || 'unknown error'}`);
    }
  });
};
