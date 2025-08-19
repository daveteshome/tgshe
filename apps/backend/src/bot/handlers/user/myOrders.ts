import { OrdersService } from '../../../services/orders.service';
import { money } from '../../../lib/money';

export const registerMyOrders = (bot: any) => {
  bot.action('MY_ORDERS', async (ctx: any) => {
    await ctx.answerCbQuery();
    const tgId = String(ctx.from.id);
    const orders = await OrdersService.listUserOrders(tgId, 5);
    if (!orders.length) return ctx.reply('You have no orders yet.');

    for (const o of orders) {
      const lines = o.items.map(it => `• ${it.title} x${it.qty} — ${money(it.price * it.qty, o.currency)}`);
      await ctx.reply(`Order #${o.id.slice(0, 6)}\nStatus: ${o.status}\nTotal: ${money(o.total, o.currency)}\n\n${lines.join('\n')}`);
    }
  });
};
