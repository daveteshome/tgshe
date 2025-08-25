// ...imports...
import { Router } from "express";
import { Readable } from "node:stream";
import { db } from "../lib/db";
import { publicImageUrl } from "../lib/r2";   // <-- you already have this
export const productsRouter = Router();

const BOT_TOKEN = process.env.BOT_TOKEN || "";

productsRouter.get('/:id/image', async (req, res, next) => {
  const id = req.params.id;
  try {
    const img = await db.productImage.findFirst({
      where: { productId: id },
      orderBy: { position: 'asc' },
      select: { tgFileId: true, imageId: true, url: true },
    });

    if (!img) {
      console.warn("[img:route] no image row", { productId: id });
      return res.status(404).send('No image');
    }

    // 1) Telegram file_id → proxy it
    if (img.tgFileId) {
      console.log("[img:route] serve TG file_id", { productId: id });
      const gf = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(img.tgFileId)}`);
      const j: any = await gf.json().catch(async () => ({ ok: false, text: await gf.text() }));
      if (!j?.ok || !j?.result?.file_path) {
        console.error("[img:route] TG getFile failed", { status: gf.status, body: j });
        return res.status(502).send('TG getFile failed');
      }
      const filePath: string = j.result.file_path;
      const f = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
      if (!f.ok) {
        const t = await f.text();
        console.error("[img:route] TG file fetch failed", { status: f.status, body: t.slice(0, 200) });
        return res.status(502).send('TG file fetch failed');
      }

      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Content-Type', f.headers.get('content-type') ?? 'image/jpeg');
      const body: any = f.body;
      if (body && typeof (Readable as any).fromWeb === 'function') {
        return (Readable as any).fromWeb(body).pipe(res);
      }
      const buf = Buffer.from(await f.arrayBuffer());
      res.setHeader('Content-Length', String(buf.length));
      return res.end(buf);
    }

    // 2) R2 image → redirect to public URL
    if (img.imageId) {
      const r2Url = publicImageUrl(img.imageId, 'jpg'); // we uploaded as orig.jpg (jpeg)
      console.log("[img:route] redirect to R2", { productId: id, r2Url });
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.redirect(302, r2Url);
    }

    // 3) Legacy URL
    if (img.url) {
      console.log("[img:route] redirect to legacy URL", { productId: id, url: img.url });
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.redirect(302, img.url);
    }

    console.warn("[img:route] row had no usable ref", { productId: id, img });
    return res.status(404).send('No image');
  } catch (e) {
    console.error("[img:route] error", { productId: id, err: (e as any)?.message });
    next(e);
  }
});

export default productsRouter;
