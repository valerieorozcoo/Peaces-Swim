// Peace Points: the Peaces Swim rewards program.
//   • $1 spent = 1 point (paid orders, after discounts, before shipping and tax)
//   • +25 for joining (the first time she opens her account), +50 in her birthday month (once a year)
//   • every 100 points = a $10-off code, made just for her
// Who she is comes from Shopify's customer sign-in (Customer Account API); points, history and codes live in
// Shopify (orders + a `peaces.points` customer metafield + discount codes), read/written with the Admin API.
import crypto from "node:crypto";
import { gql, check } from "./shopify.js";
import { HttpError } from "./http.js";

export const POINTS_PER_DOLLAR = 1, REWARD_POINTS = 100, REWARD_OFF = 10, SIGNUP_BONUS = 25, BIRTHDAY_BONUS = 50;
const SHOP_ID = () => process.env.SHOPIFY_SHOP_ID || "85529657569";
const STOREFRONT = () => (process.env.SHOPIFY_STOREFRONT_DOMAIN || "peaces-swim.myshopify.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
const TZ = process.env.SHOP_TZ || "America/New_York";

/* ---------- Shopify customer sign-in (public client, PKCE in the browser) ---------- */
let discovered = null;
async function discover() {
  if (discovered) return discovered;
  const base = "https://" + STOREFRONT();
  const id = SHOP_ID();
  const out = {
    authorize: "https://shopify.com/authentication/" + id + "/oauth/authorize",
    token: "https://shopify.com/authentication/" + id + "/oauth/token",
    logout: "https://shopify.com/authentication/" + id + "/logout",
    graphql: process.env.CUSTOMER_ACCOUNT_API_URL || "https://shopify.com/" + id + "/account/customer/api/2025-10/graphql",
  };
  if (!process.env.CUSTOMER_ACCOUNT_API_URL) {
    try {
      const o = await (await fetch(base + "/.well-known/openid-configuration")).json();
      if (o.authorization_endpoint) Object.assign(out, { authorize: o.authorization_endpoint, token: o.token_endpoint, logout: o.end_session_endpoint || out.logout });
    } catch (e) { /* keep the standard addresses */ }
    try {
      const c = await (await fetch(base + "/.well-known/customer-account-api")).json();
      if (c.graphql_api) out.graphql = c.graphql_api;
    } catch (e) { /* keep the standard address */ }
  }
  return (discovered = out);
}
export async function authConfig() {
  const clientId = process.env.SHOPIFY_CUSTOMER_CLIENT_ID || "";
  const d = await discover();
  return { enabled: !!clientId, clientId, authorize: d.authorize, token: d.token, logout: d.logout, scope: "openid email customer-account-api:full" };
}

// The signed-in customer, checked with Shopify using her own access token.
export async function customerFromToken(token) {
  if (!token || typeof token !== "string" || token.length > 6000) throw new HttpError(401, "Please sign in again.");
  const d = await discover();
  let j = {};
  try {
    const r = await fetch(d.graphql, { method: "POST", headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ query: "query { customer { id firstName lastName emailAddress { emailAddress } } }" }) });
    j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("status " + r.status);
  } catch (e) { throw new HttpError(401, "Please sign in again."); }
  const c = j.data && j.data.customer;
  if (!c || !/^gid:\/\/shopify\/Customer\/\d+$/.test(c.id)) throw new HttpError(401, "Please sign in again.");
  return c;
}

/* ---------- points ---------- */
const COUNTS = ["PAID", "PARTIALLY_REFUNDED"];
export function pointsFromOrders(orders) {
  return (orders || []).filter((o) => !o.cancelledAt && COUNTS.includes(o.displayFinancialStatus))
    .reduce((s, o) => s + Math.floor(+((o.currentSubtotalPriceSet || {}).shopMoney || {}).amount || 0) * POINTS_PER_DOLLAR, 0);
}
export function balanceOf(ledger, orders) {
  const earned = pointsFromOrders(orders);
  const bonus = (ledger.bonus || []).reduce((s, b) => s + (b.pts || 0), 0);
  const spent = (ledger.redeemed || []).reduce((s, b) => s + (b.pts || 0), 0);
  return { earned, bonus, spent, balance: Math.max(0, earned + bonus - spent) };
}
function today(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day };
}
// Adds the joining bonus the first time, and the birthday bonus once in her birthday month. Returns true if changed.
export function applyBonuses(ledger, now = new Date()) {
  let changed = false;
  ledger.bonus = ledger.bonus || []; ledger.redeemed = ledger.redeemed || [];
  if (!ledger.bonus.some((b) => b.t === "signup")) { ledger.bonus.push({ t: "signup", pts: SIGNUP_BONUS, at: now.toISOString() }); changed = true; }
  const t = today(now), m = /^(\d{2})-(\d{2})$/.exec(ledger.birthday || "");
  if (m && +m[1] === t.month && !ledger.bonus.some((b) => b.t === "birthday" && b.year === t.year)) {
    ledger.bonus.push({ t: "birthday", year: t.year, pts: BIRTHDAY_BONUS, at: now.toISOString() }); changed = true;
  }
  return changed;
}

/* ---------- Shopify (Admin API) ---------- */
const CUSTOMER_Q = `query($id:ID!){ customer(id:$id){ id metafield(namespace:"peaces", key:"points"){ value }
  orders(first:100, sortKey:PROCESSED_AT, reverse:true){ nodes{ id name processedAt cancelledAt statusPageUrl displayFinancialStatus displayFulfillmentStatus
    currentSubtotalPriceSet{ shopMoney{ amount } } totalPriceSet{ shopMoney{ amount } }
    lineItems(first:20){ nodes{ title quantity customAttributes{ key value } } } } } } }`;
export async function loadCustomer(id) {
  const d = await gql(CUSTOMER_Q, { id });
  if (!d.customer) throw new HttpError(404, "We couldn't find your account.");
  let ledger = {};
  try { ledger = JSON.parse((d.customer.metafield && d.customer.metafield.value) || "{}") || {}; } catch (e) { ledger = {}; }
  return { orders: d.customer.orders.nodes || [], ledger };
}
export async function saveLedger(id, ledger) {
  const d = await gql(`mutation($m:[MetafieldsSetInput!]!){ metafieldsSet(metafields:$m){ metafields{ id } userErrors{ field message } } }`,
    { m: [{ ownerId: id, namespace: "peaces", key: "points", type: "json", value: JSON.stringify(ledger) }] });
  check(d.metafieldsSet, "metafieldsSet");
}
export function rewardCode() { // PEACE-7K2QXM: no 0/O/1/I so it's easy to read
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", b = crypto.randomBytes(6);
  return "PEACE-" + Array.from(b, (x) => A[x % A.length]).join("");
}
export async function createRewardCode(customerId, code) {
  const d = await gql(`mutation($d:DiscountCodeBasicInput!){ discountCodeBasicCreate(basicCodeDiscount:$d){ codeDiscountNode{ id } userErrors{ field message } } }`, {
    d: { title: "Peace Points reward " + code, code, startsAt: new Date().toISOString(), usageLimit: 1, appliesOncePerCustomer: true,
      context: { customers: { add: [customerId] } },
      customerGets: { value: { discountAmount: { amount: String(REWARD_OFF), appliesOnEachItem: false } }, items: { all: true } },
      combinesWith: { orderDiscounts: true, productDiscounts: true, shippingDiscounts: true }, tags: ["peace-points"] },
  });
  check(d.discountCodeBasicCreate, "discountCodeBasicCreate");
}
export async function codesUsed(codes) {
  const out = {};
  await Promise.all(codes.map(async (c) => {
    try {
      const d = await gql(`query($c:String!){ codeDiscountNodeByCode(code:$c){ codeDiscount{ ... on DiscountCodeBasic{ asyncUsageCount status } } } }`, { c });
      const n = d.codeDiscountNodeByCode && d.codeDiscountNodeByCode.codeDiscount;
      out[c] = n ? (n.asyncUsageCount > 0 || n.status === "EXPIRED") : false;
    } catch (e) { out[c] = false; }
  }));
  return out;
}

/* ---------- what the account page shows ---------- */
const attr = (l, k) => ((l.customAttributes || []).find((a) => a.key === k) || {}).value || "";
export async function accountView(c) {
  const { orders, ledger } = await loadCustomer(c.id);
  if (applyBonuses(ledger)) await saveLedger(c.id, ledger);
  const p = balanceOf(ledger, orders);
  const recent = (ledger.redeemed || []).slice(-10).reverse();
  const used = await codesUsed(recent.map((r) => r.code));
  return {
    name: c.firstName || "", fullName: [c.firstName, c.lastName].filter(Boolean).join(" "), email: (c.emailAddress && c.emailAddress.emailAddress) || "",
    points: { ...p, perReward: REWARD_POINTS, rewardOff: REWARD_OFF, toNext: REWARD_POINTS - (p.balance % REWARD_POINTS), canRedeem: p.balance >= REWARD_POINTS },
    rewards: recent.map((r) => ({ code: r.code, off: r.off || REWARD_OFF, at: r.at, used: !!used[r.code] })),
    bonuses: (ledger.bonus || []).map((b) => ({ t: b.t, pts: b.pts, at: b.at })),
    birthday: ledger.birthday || null,
    orders: orders.slice(0, 25).map((o) => {
      const bikini = (o.lineItems.nodes || []).find((l) => /^Custom bikini/.test(l.title));
      return {
        name: o.name, date: o.processedAt, total: +o.totalPriceSet.shopMoney.amount, cancelled: !!o.cancelledAt,
        paid: o.displayFinancialStatus, shipped: o.displayFulfillmentStatus,
        status: /^https:\/\//.test(o.statusPageUrl || "") ? o.statusPageUrl : null,
        points: !o.cancelledAt && COUNTS.includes(o.displayFinancialStatus) ? Math.floor(+o.currentSubtotalPriceSet.shopMoney.amount) : 0,
        items: (o.lineItems.nodes || []).filter((l) => !/^Add[- ]on: /.test(l.title)).map((l) => (l.quantity > 1 ? l.quantity + " × " : "") + (attr(l, "_short") || l.title)),
        image: bikini && /^https:\/\/cdn\.shopify\.com\//.test(attr(bikini, "_design_image")) ? attr(bikini, "_design_image") : null,
      };
    }),
  };
}
