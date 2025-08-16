import { Markup } from 'telegraf';
import { CatalogService } from '../../../services/catalog.service';
import { money } from '../../../lib/money';

const PLACEHOLDER = 'https://placehold.co/800x500/png?text=Product';

export const registerViewProducts = (bot: any) => {
  bot.action('VIEW_PRODUCTS', async (ctx: any) => {
    await ctx.answerCbQuery();
    const cats = await CatalogService.listCategories();
    if (cats.length === 0) return ctx.reply('No categories yet.');
    const rows = cats.map((c) => [Markup.button.callback(c.name, `CAT_${c.id}`)]);
    await ctx.reply('Choose a category:', Markup.inlineKeyboard(rows));
  });

  bot.action(/CAT_(.+)/, async (ctx: any) => {
    await ctx.answerCbQuery();
    const categoryId = ctx.match[1];
    const prods = await CatalogService.listProductsByCategory(categoryId);
    if (prods.length === 0) return ctx.reply('No products in this category yet.');

    for (const p of prods) {
      const caption = `${p.title}\nPrice: ${money(p.price, p.currency)}\nStock: ${p.stock}`;
      const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback('🛒 Add to Cart', `CART_ADD_${p.id}`),
        Markup.button.callback('⚡ Buy Now', `BUY_${p.id}`),
      ],
    ]);

      const url = p.photoUrl && p.photoUrl.startsWith('http') ? p.photoUrl : PLACEHOLDER;

      try {
        await ctx.replyWithPhoto({ url }, { caption, reply_markup: kb.reply_markup });
      } catch (err) {
        console.error('send photo failed, falling back to text:', err);
        await ctx.reply(`${caption}`, kb);
      }
    }
  });
};
