import { route, HttpError } from "../../lib/http.js";
import { gql, check, toE164 } from "../../lib/shopify.js";
import { priceDesign, DISCOUNT_PERCENT } from "../../lib/catalog.js";
import { sign, verifyWelcomeToken } from "../../lib/sign.js";
import { saveDesignImage } from "../../lib/design-image.js";
import { waitFor, QUEUE_QUERY, queueSince } from "../../lib/queue.js";

const CURRENCY = process.env.SHOP_CURRENCY || "USD";
const money = (n) => ({ amount: n.toFixed(2), currencyCode: CURRENCY });
// The welcome 10% is applied as this Shopify code, so a customer can't add it a second time at checkout.
const WELCOME_CODE = process.env.WELCOME_DISCOUNT_CODE || "PEACESPARTY";
const MAX_BIKINIS = 5;
// Pop-up code: $10 off the order. Typed on the site; applied here as a $10 discount on the first bikini line,
// so it stacks with the welcome 10% code and can't be added twice.
// Works until midnight after the pop-up, Miami time; change with POPUP_CODE / POPUP_CODE_UNTIL in Vercel.
export const POPUP_CODE = String(process.env.POPUP_CODE || "PEACESPOPUP").toUpperCase();
const popupCodeUntil = () => Date.parse(process.env.POPUP_CODE_UNTIL || "2026-11-06T00:00:00-05:00");
export const popupCodeOk = (code, now = Date.now()) => String(code || "").trim().toUpperCase() === POPUP_CODE && now < popupCodeUntil();
export const POPUP_OFF = 10;
// Creator codes (product creators, from a link like www.peacesswim.com/PINKPILATESXPS): every bikini in the
// bag is $70 with free customizations, and shipping is free. Extras (tote, headband) are full price.
// More codes: CREATOR_CODES in Vercel (comma separated); price: CREATOR_BASE_PRICE.
const creatorCodes = () => String(process.env.CREATOR_CODES || "PINKPILATESXPS").toUpperCase().split(/[\s,]+/).filter(Boolean);
export const creatorCode = (code) => { const c = String(code || "").trim().toUpperCase(); return c && creatorCodes().includes(c) ? c : null; };
const creatorBase = () => +(process.env.CREATOR_BASE_PRICE || 70);
const isCustomization = (title) => /^Add[- ]on: /.test(title);

// POST /api/orders/create  { designs:[design…], images:[dataUrl…], customer:{ phone, name, email, welcomeToken } }
// (a single { design, image } still works). Prices every bikini in the bag on the server,
// creates ONE Shopify draft order and returns its checkout link (invoiceUrl). A signed
// signup receipt authorizes only the welcome discount, never customer-account access.
export default route(["POST"], async (body) => {
  const designs = Array.isArray(body.designs) ? body.designs : [body.design];
  const images = Array.isArray(body.images) ? body.images : [body.image];
  if (!designs.length || designs.length > MAX_BIKINIS) throw new Error("You can check out 1 to " + MAX_BIKINIS + " bikinis at a time");
  const orders = designs.map((d) => priceDesign(d));
  const creator = creatorCode(body.creator);
  const promo = !creator && popupCodeOk(body.promo);
  const full = orders.reduce((s, o) => s + o.subtotal, 0);
  const promoOff = promo ? Math.min(POPUP_OFF, orders[0].lines[0].price) : 0;
  // creator pricing: what comes off each bikini (base down to $70, every customization free)
  const creatorOff = (o) => o.lines.reduce((x, l, k) => x + (k === 0 ? Math.max(0, l.price - creatorBase()) : isCustomization(l.title) ? l.price : 0), 0);
  const creatorTotalOff = creator ? orders.reduce((x, o) => x + creatorOff(o), 0) : 0;
  const subtotal = full - promoOff - creatorTotalOff;
  const work = orders.reduce((s, o) => s + o.minutes, 0); // sewing minutes for every bikini in the bag

  const cust = body.customer || {};
  const phone = toE164(cust.phone);
  const discounted = verifyWelcomeToken(cust.welcomeToken, phone);
  if (cust.welcomeToken && !discounted) throw new HttpError(409, "Your welcome discount expired. Please enter your contact details again before checking out.");

  const many = orders.length > 1;
  const lineItems = [], pictures = [];
  // Pictures: one the builder already uploaded (a Shopify CDN link) is used as is; the rest are
  // uploaded now, all at the same time.
  const given = Array.isArray(body.imageUrls) ? body.imageUrls : [];
  const okUrl = (u) => typeof u === "string" && u.length < 800 && /^https:\/\/cdn\.shopify\.com\/s\/files\/[^\s"'<>]+$/.test(u);
  const pics = await Promise.all(orders.map((o, i) => (okUrl(given[i]) ? given[i] : saveDesignImage(images[i], o.lines[0].title))));
  for (let i = 0; i < orders.length; i++) {
    const tag = many ? [{ key: "Bikini", value: (i + 1) + " of " + orders.length }] : [];
    const first = lineItems.length;
    for (const [k, l] of orders[i].lines.entries()) {
      const creatorDiscount = !creator ? null
        : k === 0 && l.price > creatorBase() ? { valueType: "FIXED_AMOUNT", value: l.price - creatorBase(), title: creator + ": $" + creatorBase() + " bikini" }
        : isCustomization(l.title) && l.price > 0 ? { valueType: "PERCENTAGE", value: 100, title: creator + ": free customizations" } : null;
      lineItems.push({
        title: l.title, quantity: 1, originalUnitPriceWithCurrency: money(l.price),
        requiresShipping: true, taxable: true, // we ship now: Shopify checkout asks for their address
        customAttributes: tag.concat(Object.entries(l.attrs).map(([key, value]) => ({ key, value }))),
        ...(promoOff && lineItems.length === 0 && { appliedDiscount: { valueType: "FIXED_AMOUNT", value: promoOff, title: "PeacesPopUp: $10 off" } }),
        ...(creatorDiscount && { appliedDiscount: creatorDiscount }),
      });
    }
    // The picture of each built bikini rides on its bikini line as `_design_image`
    // (hidden at checkout, available to the receipt email as line.properties).
    const url = pics[i];
    pictures.push(url || null);
    if (url) lineItems[first].customAttributes.push({ key: "_design_image", value: url });
  }

  const input = {
    tags: ["peaces-builder", "ship", ...(promo ? ["peacespopup"] : []), ...(creator ? ["creator", creator.toLowerCase()] : [])],
    ...(creator && { shippingLine: { title: "Free shipping (" + creator + ")", priceWithCurrency: money(0) } }),
    allowDiscountCodesInCheckout: true, // lets customers type Shopify discount codes (e.g. FREETOTE) at checkout
    note: "Made in the Peaces Swim Builder" + (many ? " · " + orders.length + " bikinis" : "")
      + pictures.map((u, i) => (u ? "\nDesign picture" + (many ? " " + (i + 1) : "") + ": " + u : "")).join(""),
    customAttributes: [{ key: "Source", value: "Peaces Swim Builder" }, { key: "Delivery", value: "Ship" }, ...(promo ? [{ key: "Code", value: "PeacesPopUp ($10 off)" }] : [])],
    lineItems,
  };
  const customerName = String(cust.name || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60);
  if (customerName) input.customAttributes.push({ key: "Customer name", value: customerName });
  input.customAttributes.push({ key: "Work minutes", value: String(work) });
  // to text them when it's ready (the seamstress page's Done button)
  if (phone) input.customAttributes.push({ key: "Text when ready", value: phone });
  const email = String(cust.email || "").trim().toLowerCase().slice(0, 120);
  // Signed-up customers: their email goes on the order so it shows in their Shopify account.
  if (discounted && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) input.email = email;
  // creator orders are already at the creator price, so the welcome 10% isn't added on top
  if (discounted && !creator) input.discountCodes = [WELCOME_CODE];
  if (creator) input.customAttributes.push({ key: "Code", value: creator + " (creator: $" + creatorBase() + " bikini, free customizations, free shipping)" });

  const create = await gql(
    `mutation($input:DraftOrderInput!){ draftOrderCreate(input:$input){
       draftOrder{ id name invoiceUrl subtotalPriceSet{ shopMoney{ amount } } totalPriceSet{ shopMoney{ amount } } }
       userErrors{ field message } } }`,
    { input }
  );
  let d = check(create.draftOrderCreate, "draftOrderCreate").draftOrder;
  const total = (x) => (x && x.totalPriceSet ? +x.totalPriceSet.shopMoney.amount : null);
  // If Shopify skipped the code (e.g. it was paused or changed), still honour the 10% we promised.
  if (discounted && !creator && total(d) !== null && total(d) >= subtotal) {
    const upd = await gql(
      `mutation($id:ID!,$input:DraftOrderInput!){ draftOrderUpdate(id:$id,input:$input){
         draftOrder{ id name invoiceUrl totalPriceSet{ shopMoney{ amount } } } userErrors{ field message } } }`,
      { id: d.id, input: { discountCodes: [], appliedDiscount: { valueType: "PERCENTAGE", value: DISCOUNT_PERCENT, title: "Peaces " + DISCOUNT_PERCENT + "% welcome" } } }
    );
    d = { ...d, ...(check(upd.draftOrderUpdate, "draftOrderUpdate").draftOrder || {}) };
  }
  // sewing already waiting in line, so the earliest pickup time is realistic (never blocks checkout)
  // when it would be ready from the sewing schedule (2 seamstresses, wait & watch first)
  let plan = null;
  if (body.ship !== true) try { plan = waitFor((await gql(QUEUE_QUERY, { q: queueSince() })).draftOrders.nodes || [], work, Date.now(), d.id); } catch (e) { plan = null; }
  const expected = discounted && !creator ? subtotal * (1 - DISCOUNT_PERCENT / 100) : subtotal;
  return {
    status: 201,
    body: {
      id: d.id, sig: sign(d.id), name: d.name, checkoutUrl: d.invoiceUrl,
      subtotal, discounted: discounted && !creator, promo, promoOff, creator, bikinis: orders.length, minutes: work, wait: plan ? plan.minutes : null, readyAt: plan ? plan.readyAt : null,
      image: pictures[0] || null, images: pictures,
      total: total(d) !== null ? total(d) : +expected.toFixed(2),
    },
  };
});
