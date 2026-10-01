// The price list the server trusts. The browser sends WHAT was picked;
// the server works out HOW MUCH it costs, so prices can't be edited in the browser.
// Keep this in sync with STYLES / COLORS / ADDONS in index.html.

export const BASE_PRICE = 80;
export const DISCOUNT_PERCENT = 10;
export const SIZES = ["XS", "S", "M", "L"];
export const EXTRAS = { tote: { name: "Peaces terry tote", price: 15 }, headband: { name: "Peaces headband", price: 10 } };

export const STYLES = {
  top: {
    triangle:   { name: "Triangle top",  family: "triangle",
      addons: ["extTies","ruffles","laceTrim","laceOver","bows","roses","beads","buttons","initials","charmsB","charmsP","connectors"] },
    underwire:  { name: "Bralette top",  family: "underwire",
      addons: ["extTies","laceTrim","laceOver","bows","roses","buttons","initials","charmsB","charmsP"] },
  },
  bottom: {
    triangle:   { name: "Triangle bottom", family: "triangle",
      addons: ["ruffles","laceTrim","laceOver","bows","roses","buttons","initials","charmsB","charmsP","connectors"] },
    seamless:   { name: "Seamless bottom", family: "underwire",
      addons: ["laceTrim","laceOver","bows","roses","buttons","initials","charmsB","charmsP"] },
  },
};

export const COLORS = {
  green:   { name: "Light Green", family: "triangle" },
  cheetah: { name: "Cheetah",     family: "triangle" },
  teal:    { name: "Teal",        family: "underwire" },
  coral:   { name: "Coral",       family: "underwire" },
};

export const ADDONS = {
  beads:      { name: "Beads",          price: 3 },
  bows:       { name: "Mini bows",      price: 5 },
  roses:      { name: "Mini roses",     price: 5 },
  buttons:    { name: "Buttons",        price: 5 },
  charmsB:    { name: "Basic charms",   price: 5 },
  charmsP:    { name: "Premium charms", price: 7 },
  extTies:    { name: "Extended ties",  price: 7 },
  laceTrim:   { name: "Lace trim",      price: 10 },
  laceOver:   { name: "Lace overlay",   price: 10 },
  ruffles:    { name: "Ruffles",        price: 10 },
  initials:   { name: "Rhinestones",    price: 10 },
  connectors: { name: "Connectors",     price: 10 },
};

const clean = (v, n = 40) => String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);

// Validates a design from the browser and returns a priced, normalised order.
// Throws Error with a customer-friendly message when something doesn't add up.
export function priceDesign(d) {
  if (!d || typeof d !== "object") throw new Error("Missing design");
  const top = STYLES.top[d.topStyle], bottom = STYLES.bottom[d.bottomStyle];
  if (!top || !bottom) throw new Error("Unknown style");
  const tc = COLORS[d.topColor], bc = COLORS[d.bottomColor];
  if (!tc || tc.family !== top.family) throw new Error("That color isn't available for the " + top.name);
  if (!bc || bc.family !== bottom.family) throw new Error("That color isn't available for the " + bottom.name);
  if (!SIZES.includes(d.sizeTop) || !SIZES.includes(d.sizeBottom)) throw new Error("Pick a size from XS–L");

  const addons = [];
  for (const a of Array.isArray(d.addons) ? d.addons : []) {
    const def = ADDONS[a && a.id];
    if (!def) throw new Error("Unknown add-on");
    if (!top.addons.includes(a.id) && !bottom.addons.includes(a.id))
      throw new Error(def.name + " isn't available on these styles");
    if (addons.some((x) => x.id === a.id)) continue;
    addons.push({ id: a.id, name: def.name, price: def.price, option: clean(a.option) });
  }

  const lines = [{
    title: "Custom bikini — " + top.name + " / " + bottom.name,
    price: BASE_PRICE,
    attrs: {
      Top: top.name + " · " + tc.name + " · " + d.sizeTop,
      Bottom: bottom.name + " · " + bc.name + " · " + d.sizeBottom,
    },
  }];
  for (const a of addons) {
    const opt = a.id === "initials" ? clean(d.initials, 3).toUpperCase() : a.option;
    lines.push({ title: "Add-on: " + a.name + (opt ? " (" + opt + ")" : ""), price: a.price, attrs: {} });
  }
  if (d.tote) lines.push({ title: EXTRAS.tote.name, price: EXTRAS.tote.price, attrs: {} });
  if (d.headband) lines.push({ title: EXTRAS.headband.name, price: EXTRAS.headband.price, attrs: {} });

  const subtotal = lines.reduce((s, l) => s + l.price, 0);
  return { lines, subtotal, top, bottom, tc, bc, sizeTop: d.sizeTop, sizeBottom: d.sizeBottom };
}
