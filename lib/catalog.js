// The price list the server trusts. The browser sends WHAT was picked;
// the server works out HOW MUCH it costs, so prices can't be edited in the browser.
// Keep this in sync with STYLES / COLORS / ADDONS in index.html.

export const BASE_PRICE = 95;
export const DISCOUNT_PERCENT = 10;
export const SIZES = ["XS", "S", "M", "L"];
export const EXTRAS = { tote: { name: "Peaces terry tote", price: 15 }, headband: { name: "Peaces headband", price: 10 } };

export const STYLES = {
  top: {
    triangle:   { name: "Triangle top",  family: "triangle",
      addons: ["extTies","ruffles","laceRuffles","fringe","laceTrim","bows","roses","beadsAcrylic","beadsIri","beadsWavy","beadsPearl","initials","rhinestones","charmsB","charmsP","connectors"] },
    underwire:  { name: "Bralette top",  family: "underwire",
      addons: ["extTies","fringe","laceTrim","bows","roses","beadsAcrylic","beadsIri","beadsWavy","beadsPearl","initials","rhinestones","charmsB","charmsP"] },
  },
  bottom: {
    triangle:   { name: "Triangle bottom", family: "triangle",
      addons: ["ruffles","laceRuffles","fringe","laceTrim","bows","roses","rhinestones","connectors"] },
    seamless:   { name: "Seamless bottom", family: "underwire",
      addons: ["fringe","laceTrim","bows","roses","rhinestones"] },
  },
};

export const COLORS = {
  green:   { name: "Mint", family: "triangle" },
  cheetah: { name: "Cheetah",     family: "triangle" },
  teal:    { name: "Teal",        family: "underwire" },
  coral:   { name: "Coral",       family: "underwire" },
};

export const ADDONS = {
  beadsAcrylic:{ name: "Acrylic beads",  price: 5 },
  beadsIri:   { name: "Iridescent beads", price: 5 },
  beadsWavy:  { name: "Wavy beads",     price: 5 },
  beadsPearl: { name: "Pearl beads",    price: 5 },
  bows:       { name: "Mini bows",      price: 5 },
  roses:      { name: "Mini roses",     price: 5 },
  laceRuffles:{ name: "Lace ruffles",   price: 15 },
  fringe:     { name: "Fringe",         price: 15 },
  charmsB:    { name: "Gem charms",     price: 10 },
  charmsP:    { name: "Premium charms", price: 15 },
  extTies:    { name: "Extended ties",  price: 10 },
  laceTrim:   { name: "Lace trim",      price: 15 },
  ruffles:    { name: "Ruffles",        price: 15 },
  initials:   { name: "Letter charms",  price: 10 },
  rhinestones:{ name: "Rhinestones",    price: 10 },
  connectors: { name: "Connectors",     price: 10 },
};

// Choices a customer makes inside an add-on, and what they cost. Mirrors SETTINGS/priceOf in index.html.
const SETS = ["1", "2", "3", "4"];
const WHERE = ["center", "straps", "both", "ties"];
// a charm hangs from a plain 7mm ring unless a premium clasp (+$10) is picked
const CLASPS = ["plain", "cn-big-gold", "cn-skinny-gold", "cn-skinny-rhinestone", "cn-small-rhinestone"];
export const SETTINGS = {
  beadsAcrylic: { sets: SETS, where: WHERE }, beadsIri: { sets: SETS, where: WHERE }, beadsWavy: { sets: SETS, where: WHERE }, beadsPearl: { sets: SETS, where: WHERE },
  extTies: { style: ["1", "2"] },
  bows: { top: ["center", "straps"], bottom: ["no", "center"] },
  roses: { top: ["center", "straps"], bottom: ["no", "center"] },
  rhinestones: { metal: ["silver", "gold"], place: ["left", "right", "both", "back"] },
  laceTrim: { bottom: ["none", "front", "around"] },
  laceRuffles: { edge: ["cups", "straps"], lower: ["front", "sides", "around", "none"] },
  fringe: { edge: ["hem", "straps"], lower: ["front", "sides", "around", "none"] },
  charmsB: { clasp: CLASPS }, charmsP: { clasp: CLASPS }, initials: { clasp: CLASPS },
  connectors: { bottom: ["no", "two"] },
};
const LABEL = {
  sets: { 1: "3 beads", 2: "6 beads", 3: "9 beads", 4: "12 beads" },
  top: { center: "1 center", straps: "2 on straps" }, bottom: { no: "", center: "+ bottom center", none: "top only", front: "+ bottom front", around: "+ bottom all around", two: "+ 2 on bottom" },
  metal: { gold: "gold", silver: "silver" }, place: { left: "top left", right: "top right", both: "both sides of the top", back: "back of the bottoms" },
  edge: { cups: "along the cups", hem: "along the hem", straps: "on the straps" },
  lower: { front: "+ bottom front", sides: "+ bottom sides", around: "+ bottom all around", none: "" },
  clasp: { plain: "plain 7mm ring", "cn-big-gold": "big gold clasp", "cn-skinny-gold": "skinny gold clasp", "cn-skinny-rhinestone": "skinny rhinestone clasp", "cn-small-rhinestone": "small rhinestone clasp" },
  where: { center: "center front", straps: "halter straps", both: "center + straps", ties: "on the ties" },
  style: { 1: "under the bust", 2: "crisscross waist" },
};
function readCfg(id, raw) {
  const spec = SETTINGS[id]; if (!spec) return {};
  const out = {};
  for (const [k, allowed] of Object.entries(spec)) {
    let v = raw && raw[k] != null ? String(raw[k]) : allowed[0];
    if (id === "rhinestones" && k === "place" && v === "one") v = "left"; // designs saved before left/right existed
    if (!allowed.includes(v)) throw new Error("That option isn't available");
    out[k] = v;
  }
  return out;
}
export function addonPrice(id, cfg, letters, rsLetters = 1) {
  let p = ADDONS[id].price;
  if (id.startsWith("beads")) p = 5 * Number(cfg.sets);
  if (id === "initials") p = 10 * Math.max(1, letters);
  if (id === "rhinestones") p = 10 * Math.max(1, rsLetters) * (cfg.place === "both" ? 2 : 1);
  if (id === "laceTrim") p += { none: 0, front: 5, around: 10 }[cfg.bottom];
  if (id === "connectors" && cfg.bottom === "two") p += 15;
  if ((id === "charmsB" || id === "charmsP" || id === "initials") && cfg.clasp !== "plain") p += 10;
  return p;
}

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
    const cfg = readCfg(a.id, a.cfg);
    if (a.id === "laceTrim" && cfg.bottom === "around" && d.bottomStyle === "seamless")
      throw new Error("All-the-way-around lace isn't available on the seamless bottom");
    if ((a.id === "laceRuffles" || a.id === "fringe") && d.bottomStyle === "seamless" && (cfg.lower === "sides" || cfg.lower === "around"))
      throw new Error(def.name + " only goes on the front of the seamless bottom");
    if (a.id === "fringe" && d.topStyle === "underwire" && cfg.edge === "straps")
      throw new Error("Fringe goes along the hem of the bralette top");
    const letters = clean(d.initials, 3).toUpperCase().replace(/[^A-Z]/g, "").length;
    const rsLetters = clean(d.rsText, 3).replace(/[^A-Za-z]/g, "").length;
    addons.push({ id: a.id, name: def.name, price: addonPrice(a.id, cfg, letters, rsLetters), option: clean(a.option), cfg });
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
    const opt = a.id === "initials" ? clean(d.initials, 3).toUpperCase().replace(/[^A-Z]/g, "")
      : a.id === "rhinestones" ? clean(d.rsText, 3).replace(/[^A-Za-z]/g, "") : a.option;
    const how = Object.entries(a.cfg).map(([k, v]) => LABEL[k][v]).filter(Boolean).join(", ");
    const bits = [opt, how].filter(Boolean).join(" · ");
    lines.push({ title: "Add-on: " + a.name + (bits ? " (" + bits + ")" : ""), price: a.price, attrs: {} });
  }
  const TOTE_COLORS = { pink: "Pink", blue: "Blue" };
  const HB_COLORS = { green: "Mint", teal: "Teal", coral: "Coral", cheetah: "Cheetah" };
  if (d.tote) lines.push({ title: EXTRAS.tote.name + " — " + (TOTE_COLORS[d.toteColor] || "Pink"), price: EXTRAS.tote.price, attrs: {} });
  if (d.headband) lines.push({ title: EXTRAS.headband.name + " — " + (HB_COLORS[d.headbandColor] || "Mint"), price: EXTRAS.headband.price, attrs: {} });

  const subtotal = lines.reduce((s, l) => s + l.price, 0);
  return { lines, subtotal, top, bottom, tc, bc, sizeTop: d.sizeTop, sizeBottom: d.sizeBottom };
}
