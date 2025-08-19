// apps/backend/src/api/telegramAuth.ts
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "../lib/db";
import { ENV } from "../config/env";

function readInitDataRaw(req: Request): string | null {
  const auth = req.headers["authorization"];
  if (typeof auth === "string") {
    const m = auth.match(/^tma\s+(.+)$/i);
    if (m) return m[1]; // exact raw
  }
  return null;
}

function safeDecode(raw: string): string {
  try { return decodeURIComponent(raw); } catch { return raw; }
}

function buildCheckString(decoded: string): string {
  const params = new URLSearchParams(decoded);
  const pairs: string[] = [];
  params.forEach((v, k) => {
    if (k === "hash" || k === "signature") return;
    pairs.push(`${k}=${v}`);
  });
  pairs.sort();
  return pairs.join("\n");
}

/** Mini Apps HMAC:
 * secret = HMAC_SHA256(key="WebAppData", message=BOT_TOKEN)  (key is the literal string "WebAppData")
 * expected = HMAC_SHA256(key=secret, message=checkString)
 */
function computeMiniAppsHash(checkString: string, botToken: string): string {
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  return crypto.createHmac("sha256", secret).update(checkString).digest("hex");
}

export async function telegramAuth(req: any, res: Response, next: NextFunction) {
  try {
    const raw = readInitDataRaw(req);
    if (!raw) return res.status(401).json({ error: "unauthorized", detail: "initData missing" });

    const decoded = safeDecode(raw);
    const params = new URLSearchParams(decoded);
    const provided = params.get("hash");
    if (!provided) return res.status(401).json({ error: "unauthorized", detail: "hash missing" });

    // Optional freshness:
    // const authDate = Number(params.get("auth_date") || "0");
    // if (!authDate || Date.now()/1000 - authDate > 7*24*3600) return res.status(401).json({ error: "unauthorized", detail: "initData too old" });

    const checkString = buildCheckString(decoded);
    const expected = computeMiniAppsHash(checkString, ENV.BOT_TOKEN);

    if (expected !== provided) {
      return res.status(401).json({ error: "unauthorized", detail: "invalid hash" });
    }

    const userRaw = params.get("user");
    const user = userRaw ? JSON.parse(userRaw) : null;
    if (!user?.id) return res.status(401).json({ error: "unauthorized", detail: "no user in initData" });

    req.userId = String(user.id);

    await db.user.upsert({
      where: { tgId: req.userId },
      update: {
        username: user.username || undefined,
        name: [user.first_name, user.last_name].filter(Boolean).join(" ") || undefined,
      },
      create: {
        tgId: req.userId,
        username: user.username || null,
        name: [user.first_name, user.last_name].filter(Boolean).join(" ") || null,
      },
    });

    next();
  } catch (e: any) {
    return res.status(401).json({ error: "unauthorized", detail: e?.message || "verify failed" });
  }
}
