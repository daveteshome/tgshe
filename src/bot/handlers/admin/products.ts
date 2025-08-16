import { Markup } from 'telegraf';
import { isAdmin } from '../../middlewares/isAdmin';
import { ProductsService } from '../../../services/products.service';
import { money } from '../../../lib/money';
import { toCents } from '../../../lib/parse';

type Wizard = {
  action: 'create' | 'edit';
  productId?: string;
  step: 'title' | 'price' | 'stock' | 'category' | 'photo';
  draft: { title?: string; price?: number; stock?: number; categoryId?: string; photoUrl?: string | null };
};
const wip = new Map<string, Wizard>(); // key: admin tgId

function kbProductsMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🧩 Products', 'A_PROD_LIST_1')],
    [Markup.button.callback('➕ New Product', 'A_PROD_NEW')],
  ]);
}

function kbProductsFooter(page: number, hasPrev: boolean, hasNext: boolean) {
  const navRow: any[] = [];
  if (hasPrev) navRow.push(Markup.button.callback('⬅️ Prev', `A_PROD_LIST_${page - 1}`));
  navRow.push(Markup.button.callback(`Page ${page}`, 'A_NOP'));
  if (hasNext) navRow.push(Markup.button.callback('Next ➡️', `A_PROD_LIST_${page + 1}`));
  return Markup.inlineKeyboard([
    navRow,
    [Markup.button.callback('➕ New Product', 'A_PROD_NEW')], // 👈 always visible
  ]);
}

function kbPager(page: number, hasPrev: boolean, hasNext: boolean) {
  const row: any[] = [];
  if (hasPrev) row.push(Markup.button.callback('⬅️ Prev', `A_PROD_LIST_${page - 1}`));
  row.push(Markup.button.callback(`Page ${page}`, `A_NOP`));
  if (hasNext) row.push(Markup.button.callback('Next ➡️', `A_PROD_LIST_${page + 1}`));
  return Markup.inlineKeyboard([row]);
}

function kbProductRow(p: any) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(p.isActive ? '🔴 Disable' : '🟢 Enable', `A_PROD_TOGGLE_${p.id}`),
      Markup.button.callback('✏️ Edit', `A_PROD_EDIT_${p.id}`),
      Markup.button.callback('🗑 Delete', `A_PROD_DEL_${p.id}`),
    ],
  ]);
}

export const registerAdminProducts = (bot: any) => {
  // Menu entry (add this button to /admin if you like)
  bot.action('A_PROD_MENU', isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    await ctx.reply('Products admin:', kbProductsMenu());
  });

  // List paged
  bot.action(/A_PROD_LIST_(\d+)/, isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    const page = Math.max(1, parseInt(ctx.match[1], 10));
    const perPage = 5;
    const [items, total] = await Promise.all([
      ProductsService.list({ page, perPage }),
      ProductsService.count({}),
    ]);

    if (!items.length) {
      // Even when empty, show New Product button
        await ctx.reply('No products yet.', Markup.inlineKeyboard([
            [Markup.button.callback('➕ New Product', 'A_PROD_NEW')],
        ]));
        return;
    }
    for (const p of items) {
    const line = `${p.title} • ${money(p.price, p.currency)} • Stock: ${p.stock} • ${p.isActive ? 'Active' : 'Inactive'}${p.category ? ` • ${p.category.name}` : ''}`;
    await ctx.reply(line, kbProductRow(p));
    }

    const pages = Math.ceil(total / perPage);
    await ctx.reply(
    `Total: ${total}`,
    kbProductsFooter(page, page > 1, page < pages) // 👈 footer with New Product
    );
  });

  // Toggle active
  bot.action(/A_PROD_TOGGLE_(.+)/, isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    const id = ctx.match[1];
    const p = await ProductsService.get(id);
    if (!p) return ctx.reply('Product not found.');
    await ProductsService.setActive(id, !p.isActive);
    await ctx.reply(`Toggled: ${p.title} → ${!p.isActive ? 'Active' : 'Inactive'}`);
  });

  // Delete
  bot.action(/A_PROD_DEL_(.+)/, isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    const id = ctx.match[1];
    const p = await ProductsService.get(id);
    if (!p) return ctx.reply('Not found.');
    await ProductsService.delete(id);
    await ctx.reply(`🗑 Deleted: ${p.title}`);
  });

  // Start Create
  bot.action('A_PROD_NEW', isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    const tgId = String(ctx.from.id);
    wip.set(tgId, { action: 'create', step: 'title', draft: {} });
    await ctx.reply('Enter product title:', { reply_markup: { force_reply: true, selective: true } });
  });

  // Start Edit
  bot.action(/A_PROD_EDIT_(.+)/, isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    const id = ctx.match[1];
    const p = await ProductsService.get(id);
    if (!p) return ctx.reply('Not found.');
    const tgId = String(ctx.from.id);
    wip.set(tgId, { action: 'edit', productId: id, step: 'title', draft: { title: p.title, price: p.price, stock: p.stock, categoryId: p.categoryId || undefined, photoUrl: p.photoUrl || null } });
    await ctx.reply(`Editing "${p.title}". Send new *title* or send "-" to keep it.`, { parse_mode: 'Markdown', reply_markup: { force_reply: true, selective: true } });
  });

  // Handle replies (title → price → stock → category → photo)
  bot.on('text', isAdmin(), async (ctx: any) => {
    const tgId = String(ctx.from.id);
    const state = wip.get(tgId);
    if (!state || !ctx.message?.reply_to_message) return;

    const text = String(ctx.message.text || '').trim();
    const keep = text === '-';

    try {
      if (state.step === 'title') {
        if (!keep) state.draft.title = text;
        state.step = 'price';
        await ctx.reply('Enter price (e.g., 12.99) or "-" to keep:', { reply_markup: { force_reply: true, selective: true } });
        return;
      }
      if (state.step === 'price') {
        if (!keep) state.draft.price = toCents(text);
        state.step = 'stock';
        await ctx.reply('Enter stock (integer) or "-" to keep:', { reply_markup: { force_reply: true, selective: true } });
        return;
      }
      if (state.step === 'stock') {
        if (!keep) {
          const n = parseInt(text, 10);
          if (!(n >= 0)) throw new Error('Invalid stock');
          state.draft.stock = n;
        }
        state.step = 'category';

        const cats = await ProductsService.listCategories();
        if (!cats.length) {
          await ctx.reply('No categories yet. Send a category name to create, or "-" to keep none.', { reply_markup: { force_reply: true, selective: true } });
        } else {
          const rows = cats.map((c: any) => [Markup.button.callback(c.name, `A_PROD_PICKCAT_${c.id}`)]);
          await ctx.reply('Pick a category or reply a new name:', Markup.inlineKeyboard(rows));
          await ctx.reply('…or type a new category name (or "-" to keep current).', { reply_markup: { force_reply: true, selective: true } });
        }
        return;
      }
      if (state.step === 'category') {
        if (!keep && text && text !== '-') {
          const cat = await ProductsService.upsertCategoryByName(text);
          state.draft.categoryId = cat.id;
        }
        state.step = 'photo';
        await ctx.reply('Send photo URL (http…) or "-" to skip/keep:', { reply_markup: { force_reply: true, selective: true } });
        return;
      }
      if (state.step === 'photo') {
        if (!keep && text && text !== '-') state.draft.photoUrl = text;

        // Commit
        if (state.action === 'create') {
          const created = await ProductsService.create({
            title: state.draft.title!,
            price: state.draft.price!,
            stock: state.draft.stock ?? 0,
            photoUrl: state.draft.photoUrl || null,
            categoryId: state.draft.categoryId,
          });
          await ctx.reply(`✅ Created: ${created.title} — ${money(created.price, 'USD')} — stock ${created.stock}`);
        } else if (state.action === 'edit' && state.productId) {
          const patch: any = {};
          if (state.draft.title !== undefined) patch.title = state.draft.title;
          if (state.draft.price !== undefined) patch.price = state.draft.price;
          if (state.draft.stock !== undefined) patch.stock = state.draft.stock;
          if (state.draft.categoryId !== undefined) patch.categoryId = state.draft.categoryId;
          if (state.draft.photoUrl !== undefined) patch.photoUrl = state.draft.photoUrl;
          const updated = await ProductsService.update(state.productId, patch);
          await ctx.reply(`✏️ Updated: ${updated.title} — ${money(updated.price, updated.currency)} — stock ${updated.stock}`);
        }

        wip.delete(tgId);
        await ctx.reply('Done. Open 🧩 Products again:', kbProductsMenu());
      }
    } catch (e: any) {
      await ctx.reply(`❌ ${e.message || 'Invalid input'}. Try again or send "-" to keep current value.`, { reply_markup: { force_reply: true, selective: true } });
    }
  });

  // Inline pick existing category
  bot.action(/A_PROD_PICKCAT_(.+)/, isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery('Category selected');
    const tgId = String(ctx.from.id);
    const state = wip.get(tgId);
    if (!state) return;
    state.draft.categoryId = ctx.match[1];
  });

  // No-op (pager label)
  bot.action('A_NOP', isAdmin(), async (ctx: any) => ctx.answerCbQuery());
};
