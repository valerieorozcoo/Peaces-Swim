import crypto from "node:crypto";

// Signs a draft-order id so only the browser that created the order can update it.
const secret = () => process.env.ORDER_SIGNING_SECRET || process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_ADMIN_TOKEN || "dev-only-secret";
export const sign = (id) => crypto.createHmac("sha256", secret()).update(String(id)).digest("hex").slice(0, 32);
export function verify(id, sig) {
  const a = Buffer.from(sign(id)), b = Buffer.from(String(sig || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// This token authorizes only a welcome discount, never access to an account.
export function welcomeToken(phone, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ phone, expires: now + 60 * 60 * 1000 })).toString("base64url");
  return payload + "." + sign("welcome:" + payload);
}
export function verifyWelcomeToken(token, phone, now = Date.now()) {
  try {
    if (typeof token !== "string" || token.length > 1024) return false;
    const [payload, signature, extra] = token.split(".");
    if (extra !== undefined || !verify("welcome:" + payload, signature)) return false;
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return !!phone && claim.phone === phone && Number.isFinite(claim.expires) && claim.expires > now;
  } catch { return false; }
}

