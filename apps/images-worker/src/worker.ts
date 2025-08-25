// apps/images-worker/src/worker.ts
import type { RequestInitCfProperties } from "@cloudflare/workers-types";

type Env = {
  R2_PUBLIC_HOST: string; // e.g. "pub_xxx.r2.dev/tgshop-images"
};

type CfFormat = "webp" | "avif" | "jpeg" | "png" | "json" | "baseline-jpeg" | "png-force" | "svg";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/img/")) {
      return new Response("Not found", { status: 404 });
    }

    const key = url.pathname.replace(/^\/img\//, ""); // images/<sha>/orig

    const w = toInt(url.searchParams.get("w"), 512);
    const h = toInt(url.searchParams.get("h"), 0);
    const q = clamp(toInt(url.searchParams.get("q"), 85), 40, 95);
    const fit = (url.searchParams.get("fit") || "cover") as
      | "scale-down"
      | "contain"
      | "cover"
      | "crop"
      | "pad";

    // If fmt=auto → omit 'format' to satisfy TS types (Cloudflare still serves optimal formats)
    const rawFmt = url.searchParams.get("fmt") || "auto";
    const format: CfFormat | undefined =
      rawFmt === "auto" ? undefined : (rawFmt as CfFormat);

    const allowed = [256, 512, 768, 1024, 1536];
    const width = allowed.includes(w) ? w : 512;

    const origin = `https://${env.R2_PUBLIC_HOST}/${key}`;

    const imageOpts: NonNullable<RequestInitCfProperties["image"]> = {
      width,
      height: h || undefined,
      fit,
      quality: q,
      ...(format ? { format } : {}), // only set when not "auto"
    };

    const init: RequestInit & { cf?: RequestInitCfProperties } = {
      cf: {
        image: imageOpts,
        cacheEverything: true,
        cacheTtl: 60 * 60 * 24 * 365,
      },
    };

    const resp = await fetch(origin, init);

    if (!resp.ok) {
      return new Response(`Origin ${resp.status}`, { status: 502 });
    }

    const headers = new Headers(resp.headers);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.delete("Set-Cookie");

    return new Response(resp.body, { status: 200, headers });
  },
};

function toInt(v: string | null, d = 0) {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : d;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
