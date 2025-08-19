import { Markup } from 'telegraf';
import { isAdmin } from '../../middlewares/isAdmin';
import { ProductsService } from '../../../services/products.service';
import { money } from '../../../lib/money';
import { toCents } from '../../../lib/parse';
import { db } from '../../../lib/db';
import { Publisher } from '../../../lib/publisher'

type Wizard = {
  action: 'create' | 'edit';
  productId?: string;
  step: 'title' | 'price' | 'stock' | 'category' | 'description' | 'photo' | 'review';
  draft: {
    title?: string;
    price?: number;
    stock?: number;
    categoryId?: string;
    description?: string | null;
    photoUrl?: string | null;
   photoFileId?: string | null;
  };
};
const wip = new Map<string, Wizard>(); // key: admin tgId

function kbProductsMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🧩 Products', 'A_PROD_LIST_1')],
    [Markup.button.callback('➕ New Product', 'A_PROD_NEW')],
  ]);
}

function formatMoneyCents(cents: number | undefined, currency = 'USD') {
  if (typeof cents !== 'number') return '—';
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

async function showProductReview(ctx: any, draft: Wizard['draft']) {
  let categoryLine = 'Category: —';
  if (draft.categoryId) {
    try {
      const cat = await db.category.findUnique({ where: { id: draft.categoryId } });
      categoryLine = `Category: ${cat?.name ?? draft.categoryId}`;
    } catch {
      categoryLine = `Category: ${draft.categoryId}`;
    }
  }

  const lines = [
    `*Review Product*`,
    `Title: ${draft.title ?? '—'}`,
    `Price: ${formatMoneyCents(draft.price)}`,
    `Stock: ${draft.stock ?? '—'}`,
    categoryLine,
  ];
  if (draft.description) lines.push(``, draft.description);

  const kb = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Save', 'A_PROD_SAVE')],
    [Markup.button.callback('📣 Save & Post to group', 'A_PROD_SAVE_POST')],
    [Markup.button.callback('↩️ Change Photo', 'A_PROD_BACK_PHOTO')],
    [Markup.button.callback('✏️ Change Description', 'A_PROD_BACK_DESC')],
    [Markup.button.callback('❌ Cancel', 'A_PROD_CANCEL')],
  ]);

  // If a Telegram photo exists, show a preview
  if (draft.photoFileId) {
    try {
      await ctx.replyWithPhoto(draft.photoFileId, {
        caption: lines.join('\n'),
        parse_mode: 'Markdown',
        reply_markup: kb.reply_markup,
      });
      return;
    } catch {}
  }

  // Fallback to text-only review
  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown', reply_markup: kb.reply_markup });
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
    wip.set(tgId, { action: 'edit', productId: id, step: 'title', draft: { title: p.title, price: p.price, stock: p.stock, categoryId: p.categoryId || undefined, description: p.description ?? null, photoUrl: p.photoUrl ?? null } });
    await ctx.reply(`Editing "${p.title}". Send new *title* or send "-" to keep it.`, { parse_mode: 'Markdown', reply_markup: { force_reply: true, selective: true } });
  });

  // Handle replies (title → price → stock → category → photo)
  bot.on('text', isAdmin(), async (ctx: any) => {
    const tgId = String(ctx.from.id);
    const state = wip.get(tgId);
    if (!state) return;
    const requireReply = !['photo'].includes(state.step);
    if (requireReply && !ctx.message?.reply_to_message) return;

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
        wip.set(tgId, state);

        const cats = await ProductsService.listCategories();
        if (!cats.length) {
          // No categories yet → prompt to create one or skip
          await ctx.reply(
            'No categories yet. Create a new one or skip:',
            Markup.inlineKeyboard([
              [Markup.button.callback('➕ New category', 'A_PROD_NEW_CAT'), Markup.button.callback('Skip', 'A_PROD_SKIP_CAT')],
            ])
          );
          return;
        }

        const rows = cats.map((c: any) => [Markup.button.callback(`📁 ${c.name}`, `A_CATPICK_${c.id}`)]);
        // Add controls row
        rows.push([Markup.button.callback('➕ New category', 'A_PROD_NEW_CAT'), Markup.button.callback('Skip', 'A_PROD_SKIP_CAT')]);

        await ctx.reply('Pick a category:', Markup.inlineKeyboard(rows));
        return;
      }


      if (state.step === 'category') {
        // If already set via inline button, just advance
        if (state.draft.categoryId) {
          state.step = 'description';
          wip.set(tgId, state);
          await ctx.reply('Send *description* (optional). Send "-" to skip/keep.', {
            parse_mode: 'Markdown',
            reply_markup: { force_reply: true, selective: true },
          });
          return;
        }

        // If admin typed a new category name (from A_PROD_NEW_CAT flow)
        if (!keep && text) {
          const cat = await ProductsService.upsertCategoryByName(text);
          state.draft.categoryId = cat.id;
        }
        // If they sent "-" or nothing, leave category unset

        state.step = 'description';
        wip.set(tgId, state);
        await ctx.reply('Send *description* (optional). Send "-" to skip/keep.', {
          parse_mode: 'Markdown',
          reply_markup: { force_reply: true, selective: true },
        });
        return;
}


      if (state.step === 'description') {
        if (!keep) {
          state.draft.description = (text === '-' ? null : text);
        }
        state.step = 'photo';
        await ctx.reply('Now send a *photo upload* (preferred) or a photo *URL*.\nSend "-" to skip/keep.', {
          parse_mode: 'Markdown',
          reply_markup: { force_reply: true, selective: true }
        });
        return;
      }
      if (state.step === 'photo') {
        if (!keep && text && text !== '-') {
          // admin typed a URL (override any uploaded photo)
          state.draft.photoUrl = text;
          state.draft.photoFileId = null;
        }

        // ✅ move to review and show the card (no DB writes here)
        state.step = 'review';
        wip.set(tgId, state);
        await showProductReview(ctx, state.draft);
        return;
      }

    } catch (e: any) {
      await ctx.reply(`❌ ${e.message || 'Invalid input'}. Try again or send "-" to keep current value.`, { reply_markup: { force_reply: true, selective: true } });
    }
  });

  // Pick existing category → advance
  // bot.action(/A_PROD_PICKCAT_(.+)/, isAdmin(), async (ctx: any) => {
  //   await ctx.answerCbQuery('Category selected');
  //   const tgId = String(ctx.from.id);
  //   const state = wip.get(tgId);
  //   if (!state) return;

  //   state.draft.categoryId = ctx.match[1];
  //   state.step = 'description';
  //   wip.set(tgId, state);

  //   // Remove the picker to avoid stray taps
  //   try { await ctx.deleteMessage(); } catch {}

  //   await ctx.reply('✅ Category set.\n\nSend *description* (optional). Send "-" to skip/keep.', {
  //     parse_mode: 'Markdown',
  //     reply_markup: { force_reply: true, selective: true },
  //   });
  // });

  bot.action(/^A_CATPICK_([A-Za-z0-9_-]+)$/, isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery('Category selected');
    const tgId = String(ctx.from.id);
    const state = wip.get(tgId);
    if (!state) return;

    state.draft.categoryId = ctx.match[1];
    state.step = 'description';
    wip.set(tgId, state);

    // Remove the picker to avoid stray taps firing other handlers
    try { await ctx.deleteMessage(); } catch {}

    await ctx.reply('✅ Category set.\n\nSend *description* (optional). Send "-" to skip/keep.', {
      parse_mode: 'Markdown',
      reply_markup: { force_reply: true, selective: true },
    });
  });

  // Create a new category by name (force-reply), then advance
bot.action('A_PROD_NEW_CAT', isAdmin(), async (ctx: any) => {
  await ctx.answerCbQuery();
  const tgId = String(ctx.from.id);
  const state = wip.get(tgId);
  if (!state) return;

  // mark we expect a typed name in the same 'category' step
  state.step = 'category';
  wip.set(tgId, state);

  // Clean up the picker message (optional)
  try { await ctx.deleteMessage(); } catch {}

  await ctx.reply('Send *new category name* (or "-" to keep none):', {
    parse_mode: 'Markdown',
    reply_markup: { force_reply: true, selective: true },
  });
});

// Skip category → advance
bot.action('A_PROD_SKIP_CAT', isAdmin(), async (ctx: any) => {
  await ctx.answerCbQuery('Skipped');
  const tgId = String(ctx.from.id);
  const state = wip.get(tgId);
  if (!state) return;

  state.draft.categoryId = undefined;
  state.step = 'description';
  wip.set(tgId, state);

  try { await ctx.deleteMessage(); } catch {}

  await ctx.reply('Send *description* (optional). Send "-" to skip/keep.', {
    parse_mode: 'Markdown',
    reply_markup: { force_reply: true, selective: true },
  });
});

  // No-op (pager label)
  bot.action('A_NOP', isAdmin(), async (ctx: any) => ctx.answerCbQuery());

// Accept a real Telegram photo upload during the 'photo' step of the admin wizard
bot.on('photo', isAdmin(), async (ctx: any, next: any) => {
  const tgId = String(ctx.from.id);
  const state = wip.get(tgId);

  if (!state || state.step !== 'photo') return next();

  const photos = ctx.message?.photo;
  if (!photos?.length) return next();

  const fileId = photos[photos.length - 1].file_id;

  state.draft.photoFileId = fileId;
  state.draft.photoUrl = null;

  // ✅ move to review and show the card
  state.step = 'review';
  wip.set(tgId, state);

  await showProductReview(ctx, state.draft);
});

// Save → commit create/update using current draft
bot.action('A_PROD_SAVE', isAdmin(), async (ctx: any) => {
  await ctx.answerCbQuery();
  const tgId = String(ctx.from.id);
  const state = wip.get(tgId);
  if (!state || state.step !== 'review') return;

  try {
    if (state.action === 'create') {
      const created = await ProductsService.create({
        title: state.draft.title!,
        price: state.draft.price!,
        stock: state.draft.stock ?? 0,
        description: state.draft.description ?? null,
        photoUrl: state.draft.photoUrl ?? null,
        photoFileId: state.draft.photoFileId ?? null,
        categoryId: state.draft.categoryId,
      });
      await ctx.reply(`✅ Created: ${created.title} — ${money(created.price, created.currency)} — stock ${created.stock}`);

      // (You already had auto-post here; keep or remove as you prefer.)
      // If you prefer NOT to auto-post on create anymore, comment these 4 lines.
      try {
        await Publisher.postProduct(ctx.bot ?? ctx, created.id);
        await ctx.reply('📣 Posted to group.');
      } catch (err: any) {
        await ctx.reply(`⚠️ Could not post to group: ${err.message}`);
      }
    } else if (state.action === 'edit' && state.productId) {
      const patch: any = {};
      if (state.draft.title !== undefined) patch.title = state.draft.title;
      if (state.draft.price !== undefined) patch.price = state.draft.price;
      if (state.draft.stock !== undefined) patch.stock = state.draft.stock;
      if (state.draft.categoryId !== undefined) patch.categoryId = state.draft.categoryId;
      if (state.draft.photoUrl !== undefined) patch.photoUrl = state.draft.photoUrl;
      if (state.draft.photoFileId !== undefined) patch.photoFileId = state.draft.photoFileId;
      if (state.draft.description !== undefined) patch.description = state.draft.description;

      const updated = await ProductsService.update(state.productId, patch);
      await ctx.reply(`✏️ Updated: ${updated.title} — ${money(updated.price, updated.currency)} — stock ${updated.stock}`);

      // ✅ Auto-update the group post on every edit
      try {
        await Publisher.upsertProductPost(ctx.bot ?? ctx, state.productId);
        await ctx.reply('📝 Group post updated.');
      } catch (err: any) {
        await ctx.reply(`⚠️ Could not update group post: ${err.message}`);
      }
    }

    wip.delete(tgId);
    await ctx.reply('Done. Open 🧩 Products again:', kbProductsMenu());
  } catch (e: any) {
    await ctx.reply(`❌ ${e.message || 'Failed to save'}`);
  }
});

// Save & Post button → save (create/edit) then upsert post
bot.action('A_PROD_SAVE_POST', isAdmin(), async (ctx: any) => {
  await ctx.answerCbQuery();
  const tgId = String(ctx.from.id);
  const state = wip.get(tgId);
  if (!state || state.step !== 'review') return;

  try {
    let productId: string;

    if (state.action === 'create') {
      const created = await ProductsService.create({
        title: state.draft.title!,
        price: state.draft.price!,
        stock: state.draft.stock ?? 0,
        description: state.draft.description ?? null,
        photoUrl: state.draft.photoUrl ?? null,
        photoFileId: state.draft.photoFileId ?? null,
        categoryId: state.draft.categoryId,
      });
      productId = created.id;
      await ctx.reply(`✅ Created: ${created.title} — ${money(created.price, created.currency)} — stock ${created.stock}`);
    } else {
      const patch: any = {};
      if (state.draft.title !== undefined) patch.title = state.draft.title;
      if (state.draft.price !== undefined) patch.price = state.draft.price;
      if (state.draft.stock !== undefined) patch.stock = state.draft.stock;
      if (state.draft.categoryId !== undefined) patch.categoryId = state.draft.categoryId;
      if (state.draft.photoUrl !== undefined) patch.photoUrl = state.draft.photoUrl;
      if (state.draft.photoFileId !== undefined) patch.photoFileId = state.draft.photoFileId;
      if (state.draft.description !== undefined) patch.description = state.draft.description;

      const updated = await ProductsService.update(state.productId!, patch);
      productId = updated.id;
      await ctx.reply(`✏️ Updated: ${updated.title} — ${money(updated.price, updated.currency)} — stock ${updated.stock}`);
    }

    // 📣 Ensure the group has the latest post/caption/media
    try {
      await Publisher.upsertProductPost(ctx.bot ?? ctx, productId);
      await ctx.reply('📣 Posted/updated in group.');
    } catch (err: any) {
      await ctx.reply(`⚠️ Could not post/update group: ${err.message}`);
    }

    wip.delete(tgId);
    await ctx.reply('Done. Open 🧩 Products again:', kbProductsMenu());
  } catch (e: any) {
    await ctx.reply(`❌ ${e.message || 'Failed to save & post'}`);
  }
});


// Back to change photo
bot.action('A_PROD_BACK_PHOTO', isAdmin(), async (ctx: any) => {
  await ctx.answerCbQuery();
  const tgId = String(ctx.from.id);
  const state = wip.get(tgId);
  if (!state) return;

  state.step = 'photo';
  wip.set(tgId, state);
  await ctx.reply(
    'Send a *photo upload* (preferred) or a photo *URL*.\nSend "-" to skip/keep.',
    { parse_mode: 'Markdown', reply_markup: { force_reply: true, selective: true } }
  );
});

// Back to change description
bot.action('A_PROD_BACK_DESC', isAdmin(), async (ctx: any) => {
  await ctx.answerCbQuery();
  const tgId = String(ctx.from.id);
  const state = wip.get(tgId);
  if (!state) return;

  state.step = 'description';
  wip.set(tgId, state);
  await ctx.reply(
    'Send *description* (optional). Send "-" to skip/keep.',
    { parse_mode: 'Markdown', reply_markup: { force_reply: true, selective: true } }
  );
});

// Cancel the wizard
bot.action('A_PROD_CANCEL', isAdmin(), async (ctx: any) => {
  await ctx.answerCbQuery('Cancelled');
  const tgId = String(ctx.from.id);
  wip.delete(tgId);
  await ctx.reply('Cancelled. Open 🧩 Products again:', kbProductsMenu());
});


};
