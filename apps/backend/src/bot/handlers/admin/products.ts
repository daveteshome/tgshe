import { Markup } from 'telegraf';
import { isAdmin } from '../../middlewares/isAdmin';
import { ProductsService } from '../../../services/products.service';
import { money } from '../../../lib/money';
import { db } from '../../../lib/db';
import { Publisher } from '../../../lib/publisher';

type Wizard = {
  action: 'create' | 'edit';
  productId?: string;
  step: 'title' | 'price' | 'stock' | 'description' | 'photo' | 'review';
  draft: {
    title?: string;
    price?: number;
    stock?: number;
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

function num(v: any) {
  return v && typeof v === 'object' && 'toNumber' in v ? v.toNumber() : Number(v);
}

async function showProductReview(ctx: any, draft: Wizard['draft']) {
  const lines = [
    `*Review Product*`,
    `Title: ${draft.title ?? '—'}`,
    `Price: ${typeof draft.price === 'number' ? draft.price.toFixed(2) : '—'}`,
    `Stock: ${draft.stock ?? '—'}`,
  ];
  if (draft.description) lines.push(``, draft.description);

  const kb = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Save', 'A_PROD_SAVE')],
    [Markup.button.callback('📣 Save & Post to group', 'A_PROD_SAVE_POST')],
    [Markup.button.callback('↩️ Change Photo', 'A_PROD_BACK_PHOTO')],
    [Markup.button.callback('✏️ Change Description', 'A_PROD_BACK_DESC')],
    [Markup.button.callback('❌ Cancel', 'A_PROD_CANCEL')],
  ]);

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
  if (draft.photoUrl && /^https?:\/\//i.test(draft.photoUrl)) {
    try {
      await ctx.replyWithPhoto({ url: draft.photoUrl }, {
        caption: lines.join('\n'),
        parse_mode: 'Markdown',
        reply_markup: kb.reply_markup,
      });
      return;
    } catch {}
  }

  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown', reply_markup: kb.reply_markup });
}

function kbProductsFooter(page: number, hasPrev: boolean, hasNext: boolean) {
  const navRow: any[] = [];
  if (hasPrev) navRow.push(Markup.button.callback('⬅️ Prev', `A_PROD_LIST_${page - 1}`));
  navRow.push(Markup.button.callback(`Page ${page}`, 'A_NOP'));
  if (hasNext) navRow.push(Markup.button.callback('Next ➡️', `A_PROD_LIST_${page + 1}`));
  return Markup.inlineKeyboard([
    navRow,
    [Markup.button.callback('➕ New Product', 'A_PROD_NEW')],
  ]);
}

function kbProductRow(p: any) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(p.active ? '🔴 Disable' : '🟢 Enable', `A_PROD_TOGGLE_${p.id}`),
      Markup.button.callback('✏️ Edit', `A_PROD_EDIT_${p.id}`),
      Markup.button.callback('🗑 Delete', `A_PROD_DEL_${p.id}`),
    ],
  ]);
}

export const registerAdminProducts = (bot: any) => {
  bot.action('A_PROD_MENU', isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    await ctx.reply('Products admin:', kbProductsMenu());
  });

  bot.action(/A_PROD_LIST_(\d+)/, isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    const page = Math.max(1, parseInt(ctx.match[1], 10));
    const perPage = 5;

    const [items, total] = await Promise.all([
      ProductsService.list({ page, perPage }),
      ProductsService.count({}),
    ]);

    if (!items.length) {
      await ctx.reply(
        'No products yet.',
        Markup.inlineKeyboard([[Markup.button.callback('➕ New Product', 'A_PROD_NEW')]])
      );
      return;
    }

    for (const p of items) {
      const priceNum = num(p.price);
      const line = `${p.title} • ${money(priceNum, String(p.currency))} • Stock: ${p.stock} • ${p.active ? 'Active' : 'Inactive'}`;
      await ctx.reply(line, kbProductRow(p));
    }

    const pages = Math.ceil(total / perPage);
    await ctx.reply(`Total: ${total}`, kbProductsFooter(page, page > 1, page < pages));
  });

  bot.action(/A_PROD_TOGGLE_(.+)/, isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    const id = ctx.match[1];
    const p = await ProductsService.get(id);
    if (!p) return ctx.reply('Product not found.');
    await ProductsService.setActive(id, !p.active);
    await ctx.reply(`Toggled: ${p.title} → ${!p.active ? 'Active' : 'Inactive'}`);
  });

  bot.action(/A_PROD_DEL_(.+)/, isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    const id = ctx.match[1];
    const p = await ProductsService.get(id);
    if (!p) return ctx.reply('Not found.');
    await db.productImage.deleteMany({ where: { productId: id } }).catch(() => {});
    await ProductsService.delete(id);
    await ctx.reply(`🗑 Deleted: ${p.title}`);
  });

  bot.action('A_PROD_NEW', isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    const tgId = String(ctx.from.id);
    wip.set(tgId, { action: 'create', step: 'title', draft: {} });
    await ctx.reply('Enter product title:', { reply_markup: { force_reply: true, selective: true } });
  });

  bot.action(/A_PROD_EDIT_(.+)/, isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    const id = ctx.match[1];
    const p = await ProductsService.get(id);
    if (!p) return ctx.reply('Not found.');
    const tgId = String(ctx.from.id);
    wip.set(tgId, {
      action: 'edit',
      productId: id,
      step: 'title',
      draft: {
        title: p.title,
        price: num(p.price),
        stock: p.stock,
        description: p.description ?? null,
        photoUrl: null,
        photoFileId: null,
      },
    });
    await ctx.reply(`Editing "${p.title}". Send new *title* or "-" to keep it.`, {
      parse_mode: 'Markdown',
      reply_markup: { force_reply: true, selective: true },
    });
  });

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
        await ctx.reply('Enter price (e.g., 12.99) or "-" to keep:', {
          reply_markup: { force_reply: true, selective: true },
        });
        return;
      }

      if (state.step === 'price') {
        if (!keep) {
          const n = parseFloat(text.replace(',', '.'));
          if (!Number.isFinite(n) || n < 0) throw new Error('Invalid price');
          state.draft.price = n;
        }
        state.step = 'stock';
        await ctx.reply('Enter stock (integer) or "-" to keep:', {
          reply_markup: { force_reply: true, selective: true },
        });
        return;
      }

      if (state.step === 'stock') {
        if (!keep) {
          const n = parseInt(text, 10);
          if (!Number.isInteger(n) || n < 0) throw new Error('Invalid stock');
          state.draft.stock = n;
        }
        state.step = 'description';
        await ctx.reply('Send *description* (optional). Send "-" to skip/keep.', {
          parse_mode: 'Markdown',
          reply_markup: { force_reply: true, selective: true },
        });
        return;
      }

      if (state.step === 'description') {
        if (!keep) {
          state.draft.description = text === '-' ? null : text;
        }
        state.step = 'photo';
        await ctx.reply('Now send a *photo upload* (preferred) or a photo *URL*.\nSend "-" to skip/keep.', {
          parse_mode: 'Markdown',
          reply_markup: { force_reply: true, selective: true },
        });
        return;
      }

      if (state.step === 'photo') {
        if (!keep && text && text !== '-') {
          state.draft.photoUrl = text;
          state.draft.photoFileId = null;
        }
        state.step = 'review';
        wip.set(tgId, state);
        await showProductReview(ctx, state.draft);
        return;
      }
    } catch (e: any) {
      await ctx.reply(
        `❌ ${e.message || 'Invalid input'}. Try again or send "-" to keep current value.`,
        { reply_markup: { force_reply: true, selective: true } }
      );
    }
  });

  bot.action('A_NOP', isAdmin(), async (ctx: any) => ctx.answerCbQuery());

  bot.on('photo', isAdmin(), async (ctx: any, next: any) => {
    const tgId = String(ctx.from.id);
    const state = wip.get(tgId);
    if (!state || state.step !== 'photo') return next();

    const photos = ctx.message?.photo;
    if (!photos?.length) return next();

    const fileId = photos[photos.length - 1].file_id;

    state.draft.photoFileId = fileId;
    state.draft.photoUrl = null;

    state.step = 'review';
    wip.set(tgId, state);

    await showProductReview(ctx, state.draft);
  });

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
        });

        // replace images if provided
        if (state.draft.photoFileId || state.draft.photoUrl) {
          await db.productImage.deleteMany({ where: { productId: created.id } }).catch(() => {});
          if (state.draft.photoFileId) {
            await db.productImage.create({
              data: {
                tenantId: created.tenantId,
                productId: created.id,
                url: `tg:file_id:${state.draft.photoFileId}`,
                position: 0,
              },
            });
          } else if (state.draft.photoUrl) {
            await db.productImage.create({
              data: {
                tenantId: created.tenantId,
                productId: created.id,
                url: state.draft.photoUrl,
                position: 0,
              },
            });
          }
        }

        await ctx.reply(
          `✅ Created: ${created.title} — ${money(num(created.price), String(created.currency))} — stock ${created.stock}`
        );

        try {
          await Publisher.postProduct(ctx.bot ?? ctx, created.id);
          await ctx.reply('📣 Posted to group.');
        } catch (err: any) {
          await ctx.reply(`⚠️ Could not post to group: ${err.message}`);
        }
      } else if (state.action === 'edit' && state.productId) {
        const updated = await ProductsService.update(state.productId, {
          title: state.draft.title,
          price: state.draft.price,
          stock: state.draft.stock,
          description: state.draft.description,
          active: undefined as any,
        });

        // replace images if provided
        if (state.draft.photoFileId || state.draft.photoUrl) {
          await db.productImage.deleteMany({ where: { productId: updated.id } }).catch(() => {});
          if (state.draft.photoFileId) {
            await db.productImage.create({
              data: {
                tenantId: updated.tenantId,
                productId: updated.id,
                url: `tg:file_id:${state.draft.photoFileId}`,
                position: 0,
              },
            });
          } else if (state.draft.photoUrl) {
            await db.productImage.create({
              data: {
                tenantId: updated.tenantId,
                productId: updated.id,
                url: state.draft.photoUrl,
                position: 0,
              },
            });
          }
        }

        await ctx.reply(
          `✏️ Updated: ${updated.title} — ${money(num(updated.price), String(updated.currency))} — stock ${updated.stock}`
        );

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
        });
        productId = created.id;

        if (state.draft.photoFileId || state.draft.photoUrl) {
          await db.productImage.deleteMany({ where: { productId: created.id } }).catch(() => {});
          if (state.draft.photoFileId) {
            await db.productImage.create({
              data: {
                tenantId: created.tenantId,
                productId: created.id,
                url: `tg:file_id:${state.draft.photoFileId}`,
                position: 0,
              },
            });
          } else if (state.draft.photoUrl) {
            await db.productImage.create({
              data: {
                tenantId: created.tenantId,
                productId: created.id,
                url: state.draft.photoUrl,
                position: 0,
              },
            });
          }
        }

        await ctx.reply(
          `✅ Created: ${created.title} — ${money(num(created.price), String(created.currency))} — stock ${created.stock}`
        );
      } else {
        const updated = await ProductsService.update(state.productId!, {
          title: state.draft.title,
          price: state.draft.price,
          stock: state.draft.stock,
          description: state.draft.description,
          active: undefined as any,
        });
        productId = updated.id;

        if (state.draft.photoFileId || state.draft.photoUrl) {
          await db.productImage.deleteMany({ where: { productId: updated.id } }).catch(() => {});
          if (state.draft.photoFileId) {
            await db.productImage.create({
              data: {
                tenantId: updated.tenantId,
                productId: updated.id,
                url: `tg:file_id:${state.draft.photoFileId}`,
                position: 0,
              },
            });
          } else if (state.draft.photoUrl) {
            await db.productImage.create({
              data: {
                tenantId: updated.tenantId,
                productId: updated.id,
                url: state.draft.photoUrl,
                position: 0,
              },
            });
          }
        }

        await ctx.reply(
          `✏️ Updated: ${updated.title} — ${money(num(updated.price), String(updated.currency))} — stock ${updated.stock}`
        );
      }

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

  bot.action('A_PROD_BACK_DESC', isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    const tgId = String(ctx.from.id);
    const state = wip.get(tgId);
    if (!state) return;

    state.step = 'description';
    wip.set(tgId, state);
    await ctx.reply('Send *description* (optional). Send "-" to skip/keep.', {
      parse_mode: 'Markdown',
      reply_markup: { force_reply: true, selective: true },
    });
  });

  bot.action('A_PROD_CANCEL', isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery('Cancelled');
    const tgId = String(ctx.from.id);
    wip.delete(tgId);
    await ctx.reply('Cancelled. Open 🧩 Products again:', kbProductsMenu());
  });
};
