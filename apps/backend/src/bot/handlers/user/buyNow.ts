import { Markup } from 'telegraf';
import { ProductsService } from '../../../services/products.service';
import { OrdersService } from '../../../services/orders.service';
import { money } from '../../../lib/money';

export const registerBuyNow = (bot: any) => {
  bot.action(/BUY_(.+)/, async (ctx: any) => {
    await ctx.answerCbQuery();
    const productId = ctx.match[1];
    const tgId = String(ctx.from.id);

    const product = await ProductsService.get(productId);
    if (!product || !product.isActive) {
      return ctx.reply('❌ Product not available.');
    }
    if (product.stock <= 0) {
      return ctx.reply('❌ Out of stock.');
    }

    // Create a single-item pending order
    const order = await OrdersService.createSingleItemPending(tgId, {
      id: product.id,
      title: product.title,
      price: product.price,
      currency: product.currency,
    });

    await ctx.reply(
      `✅ Order placed!\n` +
      `Order #${order.id.slice(0,6)}\n` +
      `Item: ${product.title} x1\n` +
      `Total: ${money(order.total, order.currency)}\n` +
      `Status: ${order.status}\n\n` +
      `You can see it in “📜 My Orders”.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🧺 View Cart', 'CART_VIEW')],
        [Markup.button.callback('📜 My Orders', 'MY_ORDERS')],
      ])
    );
  });
};

