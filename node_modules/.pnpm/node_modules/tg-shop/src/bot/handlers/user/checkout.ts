import { Markup } from 'telegraf';
import { db } from '../../../lib/db';
import { OrdersService } from '../../../services/orders.service';
import { money } from '../../../lib/money';
import { Publisher } from '../../../lib/publisher';
import { getTenantId } from '../../../services/tenant.util';

type Mode = 'cart' | 'buy_now';
type Step = 'idle' | 'need_phone' | 'need_city' | 'need_place' | 'need_ref' | 'confirm_address';

type CheckoutState = {
  mode: Mode;
  product?: { id: string; title: string; price: number; currency: string };
  step: Step;
  draft: { city?: string; place?: string; ref?: string };
};

const states = new Map<string, CheckoutState>();
const awaitingPhone = new Set<string>();

function tgIdOf(ctx: any): string {
  const id = ctx.from?.id;
  if (!id) throw new Error('No from.id');
  return String(id);
}

function ensure(state?: Partial<CheckoutState>): CheckoutState {
  return {
    mode: state?.mode ?? 'cart',
    step: state?.step ?? 'idle',
    draft: state?.draft ?? {},
    product: state?.product,
  };
}
function setState(id: string, patch: Partial<CheckoutState>) {
  const prev = states.get(id);
  const next = ensure({ ...prev, ...patch });
  states.set(id, next);
}
function getState(id: string) {
  const s = states.get(id);
  return s ? ensure(s) : undefined;
}
function clearState(id: string) {
  states.delete(id);
  awaitingPhone.delete(id);
}

function formatAddress(a?: {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
}) {
  const main = [a?.city, a?.line1].filter(Boolean).join(', ');
  const ref = a?.line2 ? `\nRef: ${a.line2}` : '';
  return (main || '—') + ref;
}

async function getDefaultAddress(userId: string) {
  const tenantId = await getTenantId();
  return db.address.findFirst({
    where: { tenantId, userId },
    orderBy: { updatedAt: 'desc' },
  });
}

async function askPhone(ctx: any, id: string) {
  awaitingPhone.add(id);
  return ctx.reply(
    '📞 Please share your phone number to continue.',
    Markup.keyboard([[Markup.button.contactRequest('📱 Share phone')], ['❌ Cancel']]).oneTime().resize()
  );
}

async function askCity(ctx: any) {
  return ctx.reply('🏙️ Which *city* should we deliver to?', { parse_mode: 'Markdown' });
}
async function askPlace(ctx: any) {
  return ctx.reply('📍 Which *area/place* (e.g., neighborhood)?', { parse_mode: 'Markdown' });
}
async function askRef(ctx: any) {
  return ctx.reply('🧭 Any *special reference* / landmark for directions?', { parse_mode: 'Markdown' });
}

async function showConfirm(ctx: any, addr: any, phone?: string | null) {
  return ctx.reply(
    `✅ Details found:\n\n*Phone:* ${phone || '—'}\n*Address:*\n${formatAddress(addr)}`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Use as is', 'CHK_USE_ADDR')],
        [Markup.button.callback('✏️ Edit address', 'CHK_EDIT_ADDR')],
      ])
    }
  );
}

async function proceedToAddressOrConfirm(ctx: any, id: string) {
  const user = await db.user.findUnique({ where: { tgId: id } });
  if (!user) return ctx.reply('Please /start first.');

  const addr = await getDefaultAddress(id);
  if (!addr) {
    setState(id, { step: 'need_city' });
    return askCity(ctx);
  }

  setState(id, { step: 'confirm_address' });
  return showConfirm(ctx, addr, user.phone);
}

export function registerCheckoutFlow(bot: any, adminIds: string[] = []) {
  bot.action('CHECKOUT', async (ctx: any) => {
    await ctx.answerCbQuery();
    const id = tgIdOf(ctx);
    setState(id, { mode: 'cart', step: 'idle', draft: {} });

    const user = await db.user.findUnique({ where: { tgId: id } });
    if (!user) return ctx.reply('Please /start first.');

    if (!user.phone) {
      setState(id, { step: 'need_phone' });
      return askPhone(ctx, id);
    }
    return proceedToAddressOrConfirm(ctx, id);
  });

  bot.action(/BUY_(.+)/, async (ctx: any) => {
    await ctx.answerCbQuery();
    const id = tgIdOf(ctx);
    const productId = ctx.match[1];

    const p = await db.product.findUnique({ where: { id: productId } });
    if (!p || !p.active) return ctx.reply('This product is unavailable.');

    const priceNum =
      typeof (p as any).price?.toNumber === 'function' ? (p as any).price.toNumber() : Number(p.price);

    setState(id, {
      mode: 'buy_now',
      product: { id: p.id, title: p.title, price: priceNum, currency: String(p.currency) },
      step: 'idle',
      draft: {},
    });

    const user = await db.user.findUnique({ where: { tgId: id } });

    if (!user?.phone) {
      setState(id, { step: 'need_phone' });
      return askPhone(ctx, id);
    }
    return proceedToAddressOrConfirm(ctx, id);
  });

  bot.on('contact', async (ctx: any) => {
    const id = tgIdOf(ctx);
    if (!awaitingPhone.has(id)) return;

    const phone = ctx.message?.contact?.phone_number;
    if (!phone) return;

    const contactUserId = String(ctx.message?.contact?.user_id || '');
    if (contactUserId && contactUserId !== id) {
      return ctx.reply('Please share *your* contact using the button.', { parse_mode: 'Markdown' });
    }

    awaitingPhone.delete(id);
    await db.user.update({ where: { tgId: id }, data: { phone } });

    try { await ctx.reply('✅ Phone saved!', Markup.removeKeyboard()); } catch {}

    return proceedToAddressOrConfirm(ctx, id);
  });

  bot.on('text', async (ctx: any, next: any) => {
    const id = tgIdOf(ctx);
    const st = getState(id);
    if (!st) return next();

    const text = String(ctx.message.text || '').trim();
    if (!text) return next();

    const tenantId = await getTenantId();

    if (st.step === 'need_city') {
      setState(id, { draft: { ...st.draft, city: text }, step: 'need_place' });
      return askPlace(ctx);
    }

    if (st.step === 'need_place') {
      setState(id, { draft: { ...st.draft, place: text }, step: 'need_ref' });
      return askRef(ctx);
    }

    if (st.step === 'need_ref') {
      const draft = { ...st.draft, ref: text };

      await db.address.upsert({
        where: { tenantId_userId_label: { tenantId, userId: id, label: 'Checkout' } },
        update: {
          // IMPORTANT: do not set nulls for required fields; use undefined to skip
          line1: draft.place ?? undefined,
          line2: draft.ref ?? undefined, // nullable → ok to set null via { set: null } if you ever need to
          city: draft.city ?? undefined,
          country: 'ET',
          isDefault: true,
        },
        create: {
          tenantId,
          userId: id,
          label: 'Checkout',
          line1: draft.place ?? '',
          line2: draft.ref ?? null,
          city: draft.city ?? '',
          region: null,
          country: 'ET',
          isDefault: true,
        },
      });

      setState(id, { draft, step: 'confirm_address' });
      const addr = await getDefaultAddress(id);

      return ctx.reply(
        `📦 Address saved:\n*${formatAddress(addr!)}*`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Use this address', 'CHK_USE_ADDR')],
            [Markup.button.callback('✏️ Edit address', 'CHK_EDIT_ADDR')],
          ])
        }
      );
    }

    return next();
  });

  bot.action('CHK_USE_ADDR', async (ctx: any) => {
    await ctx.answerCbQuery();
    const id = tgIdOf(ctx);
    const user = await db.user.findUnique({ where: { tgId: id } });
    if (!user) return ctx.reply('Please /start first.');

    const addr = await getDefaultAddress(id);
    const shippingAddress = formatAddress(addr || undefined);

    const toNum = (v: any) => (v && typeof v === 'object' && 'toNumber' in v ? v.toNumber() : Number(v));

    try {
      const st = getState(id);
      if (!st) return ctx.reply('Session expired. Please try again.');

      let order;
      if (st.mode === 'buy_now') {
        if (!st.product) return ctx.reply('Product missing. Please try again.');
        order = await OrdersService.createSingleItemPending(id, st.product, { shippingAddress });
      } else {
        order = await OrdersService.checkoutFromCartWithDetails(id, { shippingAddress });
      }

      try { await Publisher.notifyOrderNew(ctx.bot ?? ctx, order.id); } catch {}

      clearState(id);

      await ctx.editMessageText(
        `✅ Order placed!\n` +
          `#${order.id.slice(0, 6)}\n` +
          `Total: ${money(toNum(order.total), String(order.currency))}\n` +
          `Status: ${order.status}\n` +
          `Phone: ${user.phone || '—'}\n` +
          `Address:\n${shippingAddress}`,
        { parse_mode: 'Markdown' }
      );

      for (const admin of adminIds) {
        try {
          await ctx.telegram.sendMessage(
            admin,
            `🆕 Order #${order.id.slice(0, 6)} from tg:${id}\nTotal: ${money(toNum(order.total), String(order.currency))}\nStatus: ${order.status}`
          );
        } catch {}
      }
    } catch (e: any) {
      await ctx.answerCbQuery(`❌ ${e.message || 'Failed'}`, { show_alert: true });
    }
  });

  bot.action('CHK_EDIT_ADDR', async (ctx: any) => {
    await ctx.answerCbQuery();
    const id = tgIdOf(ctx);
    setState(id, { step: 'need_city', draft: {} });
    return ctx.editMessageText('✏️ Let’s update your address.\nWhat *city*?', { parse_mode: 'Markdown' });
  });
}
