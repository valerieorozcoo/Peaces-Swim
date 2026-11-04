import "./rules.js";
// The price list the server trusts. The browser sends WHAT was picked;
// the server works out HOW MUCH it costs, so prices can't be edited in the browser.
// Keep this in sync with STYLES / COLORS / ADDONS in index.html.

export const BASE_PRICE = 95;
export const DISCOUNT_PERCENT = 10;
export const SIZES = ["XS", "S", "M", "L"];
export const TOTE_COLORS = { pink: "Pink", blue: "Blue" };
export const HB_COLORS = { green: "Mint", teal: "Blue", coral: "Coral", cheetah: "Cheetah" };
export const EXTRAS = { tote: { name: "Peaces terry tote", price: 15 }, headband: { name: "Peaces headband", price: 10 } };

export const STYLES = {
  top: {
    triangle:   { name: "Triangle top",  family: "triangle" },
    underwire:  { name: "Bralette top",  family: "underwire" },
  },
  bottom: {
    triangle:   { name: "Triangle bottom", family: "triangle" },
    seamless:   { name: "Seamless bottom", family: "underwire" },
  },
};

export const COLORS = {
  green:   { name: "Mint", family: "triangle" },
  cheetah: { name: "Cheetah",     family: "triangle" },
  teal:    { name: "Blue",        family: "underwire" },
  coral:   { name: "Coral",       family: "underwire" },
};

// Every customization's spots, limits and prices live in lib/rules.js (shared with the builder page).
const R = globalThis.PeacesRules;
export const ADDONS = Object.fromEntries(R.ORDER.map((id) => [id, { name: R.SPEC[id].name, price: R.SPEC[id].price }]));

const clean = (v, n = 40) => String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);

// Validates a design from the browser and returns a priced, normalised order.
// Throws Error with a customer-friendly message when something doesn't add up.
export function priceDesign(d) {
  if (!d || typeof d !== "object") throw new Error("Missing design");
  const top = STYLES.top[d.topStyle], bottom = STYLES.bottom[d.bottomStyle];
  if (!top || !bottom) throw new Error("Unknown style");
  const tc = COLORS[d.topColor], bc = COLORS[d.bottomColor];
  if (tc && R.soldOut("top", d.topStyle, d.topColor)) throw new Error("Sorry, the " + tc.name + " " + top.name.toLowerCase() + " is sold out");
  if (bc && R.soldOut("bottom", d.bottomStyle, d.bottomColor)) throw new Error("Sorry, the " + bc.name + " " + bottom.name.toLowerCase() + " is sold out");
  if (!tc || !R.fabricOk("top", d.topStyle, d.topColor)) throw new Error("That color isn't available for the " + top.name);
  if (!bc || !R.fabricOk("bottom", d.bottomStyle, d.bottomColor)) throw new Error("That color isn't available for the " + bottom.name);
  if (!SIZES.includes(d.sizeTop) || !SIZES.includes(d.sizeBottom)) throw new Error("Pick a size from XS to L");

  const addons = [];
  const list = (Array.isArray(d.addons) ? d.addons : []).filter((a, i, all) => a && all.findIndex((x) => x && x.id === a.id) === i);
  // rules can depend on the other add-ons (e.g. beads on extended ties), so check against the whole design
  const ctx = { topStyle: d.topStyle, bottomStyle: d.bottomStyle, sizeTop: d.sizeTop, rsText: clean(d.rsText, 4), initials: clean(d.initials, 3),
    addons: list.map((a) => ({ id: a.id, cfg: a.cfg || {} })) };
  for (const a of list) {
    if (!R.SPEC[a.id]) throw new Error("Unknown add-on");
    const variant = a.variant != null ? String(a.variant) : R.SPEC[a.id].variants[0][0];
    const cfg = R.normalize(a.id, a.cfg, ctx, variant);
    ctx.addons.find((x) => x.id === a.id).cfg = cfg;
    addons.push({ id: a.id, name: R.SPEC[a.id].name, variant, cfg });
  }
  for (const a of addons) a.price = R.price(a.id, a.cfg, ctx, a.variant);

  const lines = [{
    title: "Custom bikini: " + top.name + " / " + bottom.name,
    price: BASE_PRICE,
    attrs: {
      Top: top.name + " · " + tc.name + " · " + d.sizeTop,
      Bottom: bottom.name + " · " + bc.name + " · " + d.sizeBottom,
      // Spanish copies for the seamstress tag (underscore = hidden from the customer at checkout)
      _top_es: R.es(top.name) + " · " + R.es(tc.name) + " · " + d.sizeTop,
      _bottom_es: R.es(bottom.name) + " · " + R.es(bc.name) + " · " + d.sizeBottom,
    },
  }];
  for (const a of addons) {
    const opt = a.id === "rhinestones" || a.id === "beads" ? "" : R.variantName(a.id, a.variant);
    const how = R.describe(a.id, a.cfg, ctx, a.variant);
    const bits = [opt, how].filter(Boolean).join(" · ");
    const optEs = opt ? R.es(opt) : "", howEs = R.describeEs(a.id, a.cfg, ctx, a.variant);
    const bitsEs = [optEs, howEs].filter(Boolean).join(" · ");
    lines.push({ title: "Add on: " + a.name + (bits ? " (" + bits + ")" : ""), price: a.price, attrs: { _es: R.es(a.name) + (bitsEs ? " (" + bitsEs + ")" : "") } });
  }
  if (d.tote) { const c = TOTE_COLORS[d.toteColor] || "Pink"; lines.push({ title: EXTRAS.tote.name + " (" + c + ")", price: EXTRAS.tote.price, attrs: { _es: R.es(EXTRAS.tote.name) + " (" + R.es(c) + ")" } }); }
  if (d.headband) { const c = HB_COLORS[d.headbandColor] || "Mint"; lines.push({ title: EXTRAS.headband.name + " (" + c + ")", price: EXTRAS.headband.price, attrs: { _es: R.es(EXTRAS.headband.name) + " (" + R.es(c) + ")" } }); }

  const subtotal = lines.reduce((s, l) => s + l.price, 0);
  return { lines, subtotal, top, bottom, tc, bc, sizeTop: d.sizeTop, sizeBottom: d.sizeBottom };
}

// Accessories bought on their own (the Peaces Accessories page): { headband:{color,qty}, tote:{color,qty} }.
export function priceAccessories(d) {
  if (!d || typeof d !== "object") throw new Error("Missing order");
  const lines = [];
  for (const [id, colors] of [["headband", HB_COLORS], ["tote", TOTE_COLORS]]) {
    const item = d[id];
    if (!item) continue;
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 0 || qty > 10) throw new Error("Pick between 1 and 10");
    if (!qty) continue;
    if (!colors[item.color]) throw new Error("That color isn't available");
    lines.push({ title: EXTRAS[id].name + " (" + colors[item.color] + ")", price: EXTRAS[id].price, quantity: qty, attrs: {} });
  }
  if (!lines.length) throw new Error("Add a headband or a tote first");
  return { lines, subtotal: lines.reduce((s, l) => s + l.price * l.quantity, 0) };
}
