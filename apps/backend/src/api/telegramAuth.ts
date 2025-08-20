// apps/backend/src/api/telegramAuth.ts
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "../lib/db";
import { ENV } from "../config/env";

function readInitDataRaw(req: Request): string | null {
  const auth = req.headers["authorization"];
  if (typeof auth === "string") {
    const m = auth.match(/^tma\s+(.+)$/i);
    if (m) return m[1];
  }
  return null;
}

function validateTelegramWebAppData(initData: string): boolean {
  try {
    // Parse the initData string without decoding
    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');
    
    if (!receivedHash) {
      return false;
    }

    // Remove the hash parameter only (not signature)
    params.delete('hash');
    
    // Collect all key-value pairs
    const dataCheckEntries: [string, string][] = [];
    params.forEach((value, key) => {
      dataCheckEntries.push([key, value]);
    });
    
    // Sort alphabetically by key
    dataCheckEntries.sort(([a], [b]) => a.localeCompare(b));
    
    // Build the data check string
    const dataCheckString = dataCheckEntries
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Calculate the secret key
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(ENV.BOT_TOKEN)
      .digest();
    
    // Calculate the expected hash
    const expectedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    return expectedHash === receivedHash;
  } catch (error) {
    console.error('Telegram validation error:', error);
    return false;
  }
}

export async function telegramAuth(req: any, res: Response, next: NextFunction) {
  console.log('Telegram auth middleware called');
  console.log('Request headers:', req.headers);
  try {
    const raw = readInitDataRaw(req);
    

    if (!raw) {
      console.log('Raw initData from header:', raw);
      return res.status(401).json({ error: "unauthorized", detail: "initData missing" });
    }
    // Validate the initData
    if (!validateTelegramWebAppData(raw)) {
      // Add debug information to help troubleshooting
      console.log('InitData validation failed');
      const debugInfo = debugValidation(raw);
      return res.status(401).json({ 
        error: "unauthorized", 
        detail: "invalid hash",
        debug: debugInfo
      });
    }
    console.log('InitData validation successful');
    // Parse user data
    const params = new URLSearchParams(raw);
    const userRaw = params.get("user");
    
    if (!userRaw) return res.status(401).json({ error: "unauthorized", detail: "no user in initData" });

    const user = JSON.parse(decodeURIComponent(userRaw));
    
    if (!user?.id) return res.status(401).json({ error: "unauthorized", detail: "no user id in initData" });

    req.userId = String(user.id);

    // Upsert user in database
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
    console.error('Auth error:', e);
    return res.status(401).json({ error: "unauthorized", detail: e?.message || "verify failed" });
  }
}

// Debug function to help troubleshoot
function debugValidation(initData: string): any {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  
  params.delete('hash');
  
  const dataCheckEntries: [string, string][] = [];
  params.forEach((value, key) => {
    dataCheckEntries.push([key, value]);
  });
  
  dataCheckEntries.sort(([a], [b]) => a.localeCompare(b));
  
  const dataCheckString = dataCheckEntries
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  const secretKey = crypto.createHmac('sha256', 'WebAppData')
    .update(ENV.BOT_TOKEN)
    .digest();
  
  const expectedHash = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  return {
    receivedHash,
    expectedHash,
    dataCheckString,
    keys: dataCheckEntries.map(([key]) => key),
    receivedHashTail: receivedHash ? receivedHash.slice(-12) : null,
    expectedHashTail: expectedHash.slice(-12),
    match: receivedHash === expectedHash
  };
}

