import crypto from "node:crypto";

// Signs a draft-order id so only the browser that created the order can update it.
const secret = () => process.env.ORDER_SIGNING_SECRET || process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_ADMIN_TOKEN || "dev-only-secret";
export const sign = (id) => crypto.createHmac("sha256", secret()).update(String(id)).digest("hex").slice(0, 32);
export function verify(id, sig) {
  const a = Buffer.from(sign(id)), b = Buffer.from(String(sig || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
