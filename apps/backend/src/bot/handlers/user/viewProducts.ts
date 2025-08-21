import { Markup } from 'telegraf';
import { CatalogService } from '../../../services/catalog.service';
import { money } from '../../../lib/money';
import { db } from '../../../lib/db';

const PLACEHOLDER = 'https://placehold.co/800x500/png?text=Product';
const PER_PAGE = 3;

// Helper: choose the right photo input for Telegraf
function photoInput(p: { photoFileId?: string | null; photoUrl?: string | null }) {
  if (p.photoFileId) return p.photoFileId; // Telegram file_id (best)
  if (p.photoUrl && /^https?:\/\//i.test(p.photoUrl)) return { url: p.photoUrl }; // public URL
  return { url: PLACEHOLDER };
}

// When showing a product, prefer Telegram file_id, then URL, else text
async function sendProduct(ctx: any, p: any) {
  const caption =
    `*${p.title}*\n` +
    (p.description ? `${p.description}\n` : '') +
    `Price: ${money(p.price, p.currency)}\n` +
    `Stock: ${p.stock}`;

  const kb = Markup.inlineKeyboard([
    [
      Markup.button.callback('🛒 Add to Cart', `CART_ADD_${p.id}`),
      Markup.button.callback('⚡ Buy Now', `BUY_${p.id}`),
    ],
  ]);

  try {
    if (p.photoFileId) {
      await ctx.replyWithPhoto(p.photoFileId, { caption, parse_mode: 'Markdown', reply_markup: kb.reply_markup });
    } else if (p.photoUrl?.startsWith('http')) {
      await ctx.replyWithPhoto({ url: p.photoUrl }, { caption, parse_mode: 'Markdown', reply_markup: kb.reply_markup });
    } else {
      await ctx.reply(caption, { parse_mode: 'Markdown', reply_markup: kb.reply_markup });
    }
  } catch {
    await ctx.reply(caption, { parse_mode: 'Markdown', reply_markup: kb.reply_markup });
  }
}

function pagerKb(categoryId: string, page: number, pages: number) {
  const row: any[] = [];
  if (page > 1) row.push(Markup.button.callback('⬅️ Prev', `CAT_${categoryId}_P_${page - 1}`));
  row.push(Markup.button.callback(`Page ${page}/${pages}`, 'NOP'));
  if (page < pages) row.push(Markup.button.callback('Next ➡️', `CAT_${categoryId}_P_${page + 1}`));
  return Markup.inlineKeyboard([row, [Markup.button.callback('🔙 Categories', 'VIEW_PRODUCTS')]]);
}

export const registerViewProducts = (bot: any) => {
  // Entry: show categories
  bot.action('VIEW_PRODUCTS', async (ctx: any) => {
    await ctx.answerCbQuery();
    const cats = await CatalogService.listCategories();
    if (!cats.length) return ctx.reply('No categories yet.');

    const rows = cats.map((c: { id: string; name: string }) => [
      Markup.button.callback(c.name, `CAT_${c.id}_P_1`)
    ]);
    await ctx.reply('Choose a category:', Markup.inlineKeyboard(rows));
  });

  // Open a single product from inline button in DMs / chats
  bot.action(/VIEW_ITEM_(.+)/, async (ctx: any) => {
    await ctx.answerCbQuery();
    const productId = ctx.match[1];
    const p = await db.product.findUnique({ where: { id: productId } });
    if (!p) return ctx.reply('Item not found.');

    const caption =
      `*${p.title}*\n` +
      (p.description ? `${p.description}\n` : '') +
      `Price: ${money(
        // Product.price is Prisma.Decimal now
        typeof (p as any).price?.toNumber === 'function' ? (p as any).price.toNumber() : Number(p.price),
        String(p.currency)
      )}\n` +
      `Stock: ${p.stock}`;

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback('🛒 Add to Cart', `CART_ADD_${p.id}`),
        Markup.button.callback('⚡ Buy Now',     `BUY_${p.id}`),
      ],
      [Markup.button.callback('🧺 View Cart', 'CART_VIEW')],
    ]);

    try {
      const firstImg = (p as any).images?.[0]?.url as string | undefined;
      if (firstImg && firstImg.startsWith('http')) {
        await ctx.replyWithPhoto({ url: firstImg }, {
          caption,
          parse_mode: 'Markdown',
          reply_markup: kb.reply_markup
        });
      } else {
        await ctx.reply(caption, { parse_mode: 'Markdown', reply_markup: kb.reply_markup });
      }
    } catch {
      await ctx.reply(caption, { parse_mode: 'Markdown', reply_markup: kb.reply_markup });
    }
  });

  // Unified category handler: supports both "CAT_<id>" and "CAT_<id>_P_<page>"
bot.action(/^CAT_(.+)$/, async (ctx: any) => {
    await ctx.answerCbQuery();

    const raw = ctx.match[1]; // "<catId>" or "<catId>_P_<page>"
    const SPLIT = '_P_';
    let categoryId = raw;
    let page = 1;

    const idx = raw.lastIndexOf(SPLIT);
    if (idx > -1) {
      categoryId = raw.slice(0, idx);
      const pNum = parseInt(raw.slice(idx + SPLIT.length), 10);
      if (Number.isFinite(pNum) && pNum > 0) page = pNum;
    }

    // Best-effort: remove the tapped message (keeps chat tidy)
    try { await ctx.deleteMessage(); } catch {}

    const { items, pages, total } = await CatalogService.listProductsByCategoryPaged(categoryId, page, PER_PAGE);

    if (!total) {
      return ctx.reply('No products in this category yet.');
    }

    // Only send THIS page
    for (const p of items) {
      await sendProduct(ctx, p);
    }

    // Single pager footer
    await ctx.reply(`Showing ${items.length} of ${total}`, pagerKb(categoryId, page, pages));
  });

  // No-op label tap
  bot.action('NOP', async (ctx: any) => ctx.answerCbQuery());
};
