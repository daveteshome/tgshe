import { Markup } from 'telegraf';
import { OrdersService } from '../../../services/orders.service';
import { money } from '../../../lib/money';
import { isAdmin } from '../../middlewares/isAdmin';
import { db } from '../../../lib/db';
import { Publisher } from '../../../lib/publisher';
import { formatUserLabel } from '../../format/user';
import { OrderStatus } from '@prisma/client';

function adminButtonsFor(status: OrderStatus | string, orderId: string) {
  const btn = (to: string) => Markup.button.callback(to, `A_SET_${orderId}_${to}`);

  switch (status) {
    case 'pending':
      return Markup.inlineKeyboard([
        [btn('paid'), btn('shipped')],
        [btn('cancelled')],
      ]);
    case 'paid':
      return Markup.inlineKeyboard([[btn('shipped'), btn('cancelled')]]);
    case 'shipped':
      return Markup.inlineKeyboard([[btn('completed'), btn('cancelled')]]);
    default:
      return Markup.inlineKeyboard([]); // completed/cancelled -> no actions
  }
}

export const registerAdminOrders = (bot: any) => {
  bot.command('admin', isAdmin(), async (ctx: any) => {
    await ctx.reply(
      '🛠 Admin Panel',
      Markup.inlineKeyboard([
        [Markup.button.callback('🕗 Pending', 'A_ORDERS_pending')],
        [Markup.button.callback('✅ Paid', 'A_ORDERS_paid')],
        [Markup.button.callback('📦 Shipped', 'A_ORDERS_shipped')],
        [Markup.button.callback('📬 Completed', 'A_ORDERS_completed')],
        [Markup.button.callback('📚 All (recent)', 'A_ORDERS_all')],
        [Markup.button.callback('🧩 Products', 'A_PROD_LIST_1')],
        [Markup.button.callback('➕ New Product', 'A_PROD_NEW')],
      ])
    );
  });

  bot.action(/A_ORDERS_(pending|paid|shipped|completed)/, isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    const status = ctx.match[1] as OrderStatus;
    const orders = await OrdersService.listByStatus(status, 10);
    if (!orders.length) return ctx.reply(`No ${status} orders.`);

    const toNum = (v: any) => (v && typeof v === 'object' && 'toNumber' in v ? v.toNumber() : Number(v));

    for (const o of orders) {
      const userL = o.user ? formatUserLabel(o.user) : o.userId;
      const lines = o.items.map((it: any) => `• ${it.titleSnapshot ?? 'Item'} x${it.quantity}`).join('\n');
      await ctx.reply(
        `#${o.id.slice(0, 6)} | ${userL}\n` +
          `Status: ${o.status}\n` +
          `Total: ${money(toNum(o.total), String(o.currency))}\n\n` +
          `${lines}`,
        {
          ...adminButtonsFor(o.status, o.id),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }
      );
    }
  });

  bot.action('A_ORDERS_all', isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    const orders = await OrdersService.listByStatus(undefined as any, 10);
    if (!orders?.length) return ctx.reply('No recent orders.');

    const toNum = (v: any) => (v && typeof v === 'object' && 'toNumber' in v ? v.toNumber() : Number(v));

    for (const o of orders) {
      const userL = o.user ? formatUserLabel(o.user) : o.userId;
      const lines = o.items.map((it: any) => `• ${it.titleSnapshot ?? 'Item'} x${it.quantity}`).join('\n');
      await ctx.reply(
        `#${o.id.slice(0, 6)} | ${userL}\nStatus: ${o.status}\nTotal: ${money(toNum(o.total), String(o.currency))}\n${lines}`,
        {
          ...adminButtonsFor(o.status, o.id),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }
      );
    }
  });

  bot.action(/A_SET_([a-z0-9]+)_(pending|paid|shipped|completed|cancelled)/, isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    const [, id, next] = ctx.match as [string, string, OrderStatus];

    const before = await db.order.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!before) return ctx.reply('Order not found');

    try {
      await OrdersService.setStatus(id, next as OrderStatus);
      await ctx.reply(`✅ Order ${id.slice(0, 6)} → ${next}`);

      try {
        await ctx.telegram.sendMessage(
          before.userId,
          `📦 Your order #${id.slice(0, 6)} is now *${next}*.`,
          { parse_mode: 'Markdown' }
        );
      } catch {}

      try {
        await Publisher.notifyOrderStatus(ctx.bot ?? ctx, id, before.status, next);
      } catch {}
    } catch (e: any) {
      await ctx.reply(`❌ ${e.message || 'Failed to update status'}`);
    }
  });
};
