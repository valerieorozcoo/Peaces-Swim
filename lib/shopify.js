// Shopify Admin GraphQL client (server-side only — never import this in index.html).
//
// Auth, in order of preference:
//   1. SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET  → client-credentials grant
//      (apps made in the Shopify Dev Dashboard; token lasts 24h and is cached here)
//   2. SHOPIFY_ADMIN_TOKEN                        → a static Admin API token (shpat_…)
//      from an older custom app created in the Shopify admin before 2026.

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";

function baseUrl() {
  // SHOPIFY_BASE_URL is only for local testing against a mock server.
  if (process.env.SHOPIFY_BASE_URL) return process.env.SHOPIFY_BASE_URL.replace(/\/$/, "");
  const shop = (process.env.SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!shop) throw new ConfigError("SHOPIFY_STORE_DOMAIN is not set (e.g. peaces-swim.myshopify.com)");
  return "https://" + shop;
}

export class ConfigError extends Error {}
export class ShopifyError extends Error {
  constructor(message, details) { super(message); this.details = details; }
}

let cached = { token: null, expiresAt: 0 };

async function accessToken() {
  const id = process.env.SHOPIFY_CLIENT_ID, secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (id && secret) {
    if (cached.token && Date.now() < cached.expiresAt - 60_000) return cached.token;
    const r = await fetch(baseUrl() + "/admin/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
    });
    if (!r.ok) throw new ShopifyError("Could not get a Shopify access token (" + r.status + ")", await r.text());
    const j = await r.json();
    cached = { token: j.access_token, expiresAt: Date.now() + (j.expires_in || 86399) * 1000 };
    return cached.token;
  }
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  throw new ConfigError("Set SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET (or SHOPIFY_ADMIN_TOKEN)");
}

export async function gql(query, variables = {}) {
  const r = await fetch(baseUrl() + "/admin/api/" + API_VERSION + "/graphql.json", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": await accessToken() },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.errors) throw new ShopifyError("Shopify API error (" + r.status + ")", j.errors || j);
  return j.data;
}

// Throws if a mutation returned userErrors.
export function check(payload, label) {
  const errs = payload && payload.userErrors;
  if (errs && errs.length) throw new ShopifyError(label + ": " + errs.map((e) => e.message).join("; "), errs);
  return payload;
}

// US-first phone normalisation to E.164 (+1XXXXXXXXXX). Returns null if unusable.
export function toE164(raw) {
  const s = String(raw || "").trim();
  const d = s.replace(/\D/g, "");
  if (s.startsWith("+") && d.length >= 8 && d.length <= 15) return "+" + d;
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d[0] === "1") return "+" + d;
  return null;
}

export async function findCustomerByPhone(phone) {
  const data = await gql(
    `query($q:String!){ customers(first:1, query:$q){ nodes{ id firstName lastName email phone } } }`,
    { q: "phone:" + phone }
  );
  return (data.customers.nodes || [])[0] || null;
}
