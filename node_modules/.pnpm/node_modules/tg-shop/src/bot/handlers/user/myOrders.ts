import { OrdersService } from '../../../services/orders.service';
import { money } from '../../../lib/money';

function num(v: any) {
  return v && typeof v === 'object' && 'toNumber' in v ? v.toNumber() : Number(v);
}

export const registerMyOrders = (bot: any) => {
  bot.action('MY_ORDERS', async (ctx: any) => {
    await ctx.answerCbQuery();
    const tgId = String(ctx.from.id);
    const orders = await OrdersService.listUserOrders(tgId, 5);
    if (!orders.length) return ctx.reply('You have no orders yet.');

    for (const o of orders) {
      const lines = o.items.map((it: any) =>
        `• ${it.titleSnapshot ?? 'Item'} x${it.quantity} — ${money(num(it.unitPrice) * it.quantity, String(o.currency))}`
      );
      await ctx.reply(
        `Order #${o.id.slice(0, 6)}\n` +
          `Status: ${o.status}\n` +
          `Total: ${money(num(o.total), String(o.currency))}\n\n` +
          `${lines.join('\n')}`
      );
    }
  });
};
