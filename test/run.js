// End-to-end API test against the mock Shopify. Run: npm test
import assert from "node:assert/strict";
import "./signup.js";
import { startMockShopify } from "./mock-shopify.js";
import { welcomeToken, verifyWelcomeToken } from "../lib/sign.js";

const MOCK = 9811, APP = 9812;
process.env.SHOPIFY_BASE_URL = "http://localhost:" + MOCK;
process.env.SHOPIFY_CLIENT_ID = "test-id";
process.env.SHOPIFY_CLIENT_SECRET = "test-secret";
process.env.SEAMSTRESS_PASSCODE = "sew-sew-123";
const { startLocal } = await import("./local-server.js");
const { server: s1, db } = await startMockShopify(MOCK);
const s2 = await startLocal(APP);
// what's sold out in the shop right now shouldn't break the pricing tests: check the list, then test with everything in stock
await import("../lib/rules.js");
const LIVE_SOLD_OUT = globalThis.PeacesRules.SOLD_OUT.slice();
globalThis.PeacesRules.SOLD_OUT.length = 0;
const post = async (p, b) => { const r = await fetch(`http://localhost:${APP}/api${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); return { status: r.status, body: await r.json() }; };

let n = 0; const ok = (m) => { n++; console.log("  ✓", m); };
try {
  const h = await (await fetch(`http://localhost:${APP}/api/health`)).json();
  assert.equal(h.ok, true); ok("health");

  let r = await post("/customers/lookup", { phone: "(305) 555-1234" });
  assert.deepEqual(r.body, { found: false }); ok("unknown phone → not found");

  r = await post("/customers/create", { name: "Val Orozco", email: "val@peacesswim.com", phone: "305-555-1234", marketing: true });
  assert.equal(r.status, 201); assert.equal(db.customers[0].phone, "+13055551234");
  assert.equal(db.customers[0].emailMarketingConsent.marketingState, "SUBSCRIBED"); ok("create customer (E.164 phone, consent)");
  const welcome = r.body.welcomeToken;
  assert.ok(verifyWelcomeToken(welcome, "+13055551234"));

  r = await post("/customers/create", { name: "No Consent", email: "nc@x.com", phone: "3055550000" });
  assert.equal(db.customers[1].emailMarketingConsent, undefined); ok("no consent → not subscribed");

  r = await post("/customers/lookup", { phone: "3055551234" });
  assert.deepEqual(r.body, { found: false }); ok("phone-only lookup does not reveal customer identity");

  r = await post("/customers/lookup", { phone: "12" });
  assert.equal(r.status, 400); ok("bad phone rejected");

  const design = { topStyle: "triangle", bottomStyle: "seamless", topColor: "cheetah", bottomColor: "coral", sizeTop: "S", sizeBottom: "M",
    addons: [{ id: "bows", variant: "white", cfg: { tp: ["mid"] } }, { id: "ruffles", variant: "cheetah" }, { id: "charms", variant: "letters", cfg: { mid: 3 } }], initials: "val", tote: true, headband: false };
  r = await post("/orders/create", { design, customer: { phone: "3055551234", welcomeToken: welcome } });
  assert.equal(r.status, 201); assert.equal(r.body.subtotal, 95 + 5 + 15 + 3 * 7 + 15);
  assert.equal(r.body.total, 135.9); assert.equal(r.body.discounted, true);
  assert.equal(r.body.minutes, 5 + 1 + 8 + 2); // plain 5 + one bow + ruffles + charms
  assert.ok(db.drafts[0].input.customAttributes.some((x) => x.key === "Work minutes" && x.value === "16")); ok("sewing time worked out from the team's per-customization minutes");
  const d0 = db.drafts[0].input;
  assert.equal(d0.purchasingEntity, undefined);
  assert.ok(d0.lineItems.some((l) => l.title === "Add on: Charms (Basic jump ring clasp, Top, middle ×3: Letter V ×3)")); ok("signed welcome discount on guest checkout, no customer-account link");

  r = await post("/orders/create", { design, customer: { phone: "3055551234" } });
  assert.equal(r.body.discounted, false);
  assert.equal(db.drafts.at(-1).input.purchasingEntity, undefined);
  ok("knowing an existing phone cannot link its account or claim the welcome discount");
  for (const token of [welcome + "forged", welcomeToken("+13055551234", Date.now() - 30 * 24 * 3_600_000 - 1)]) {
    const count = db.drafts.length;
    r = await post("/orders/create", { design, customer: { phone: "3055551234", welcomeToken: token } });
    assert.equal(r.status, 409); assert.equal(db.drafts.length, count);
  }
  r = await post("/orders/create", { design, customer: { phone: "3055559999", welcomeToken: welcome } });
  assert.equal(r.status, 409); ok("forged, expired, and wrong-phone discount claims cannot silently change checkout pricing");

  r = await post("/orders/create", { design, customer: { phone: "3055551234", welcomeToken: welcome, email: "Val@PeacesSwim.com" } });
  const dw = db.drafts.at(-1);
  assert.deepEqual(dw.input.discountCodes, ["PEACESPARTY"]); assert.equal(dw.input.appliedDiscount, undefined);
  assert.equal(dw.input.email, "val@peacesswim.com"); assert.equal(r.body.total, 135.9);
  ok("welcome 10% is applied as PEACESPARTY (can't be stacked again at checkout) and the order carries their email");
  db.welcomeCode = "SOMETHINGELSE";
  r = await post("/orders/create", { design, customer: { phone: "3055551234", welcomeToken: welcome } });
  assert.equal(r.body.total, 135.9); assert.equal(db.drafts.at(-1).update.appliedDiscount.value, 10);
  delete db.welcomeCode; ok("if Shopify skips the code, the promised 10% is still applied");
  r = await post("/orders/create", { design, customer: { phone: "3055551234", email: "x@y.com" } });
  assert.equal(db.drafts.at(-1).input.email, undefined); ok("no signup, no email or discount on the order");

  const second = { topStyle: "underwire", bottomStyle: "seamless", topColor: "teal", bottomColor: "teal", sizeTop: "M", sizeBottom: "M", addons: [] };
  const pic = "data:image/jpeg;base64," + Buffer.from("fake-jpeg-bytes").toString("base64");
  r = await post("/orders/create", { designs: [design, second], images: [pic, pic] });
  assert.equal(r.status, 201); assert.equal(r.body.bikinis, 2); assert.equal(r.body.subtotal, 151 + 95);
  const bag = db.drafts.at(-1).input.lineItems;
  assert.equal(bag.filter((l) => /^Custom bikini/.test(l.title)).length, 2);
  assert.ok(bag.every((l) => l.customAttributes.some((a) => a.key === "Bikini")));
  assert.equal(bag.filter((l) => l.customAttributes.some((a) => a.key === "_design_image")).length, 2);
  ok("bag of 2 bikinis: one checkout, each bikini numbered with its own picture");
  r = await post("/orders/create", { designs: [design, design, design, design, design, design] });
  assert.equal(r.status, 400); ok("no more than 5 bikinis per checkout");

  r = await post("/orders/create", { design, customer: { phone: "9999999999" } });
  assert.equal(r.body.total, 151); assert.equal(r.body.discounted, false); ok("no discount for unknown phone");

  const opts = { topStyle: "triangle", bottomStyle: "triangle", topColor: "green", bottomColor: "cheetah", sizeTop: "S", sizeBottom: "S", initials: "A", rsText: "K",
    addons: [{ id: "beads", variant: "bw-pink", cfg: { ties: 3, mid: 3 } }, { id: "laceTrim", variant: "white", cfg: { bottom: "around" } },
             { id: "connectors", variant: "c-heartring", cfg: { bottom: "two" } }, { id: "rhinestones", cfg: { metal: "silver", place: "left" } }, { id: "extTies", cfg: { style: "wrap" } },
             { id: "bows", variant: "pink", cfg: { tp: ["sides"], bp: ["mid"] } }] };
  r = await post("/orders/create", { design: opts, customer: { phone: "9999999999" } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.subtotal, 95 + 15 + 20 + 25 + 10 + 10 + 5); ok("add-on choices priced on server (9 beads, lace all around +$5, 2 bottom connectors, 1 rhinestone, wrap ties, 3 bows for a flat $5)");
  const tinyJpeg = "data:image/jpeg;base64," + Buffer.from("fake-jpeg-bytes").toString("base64");
  r = await post("/orders/create", { design: opts, image: tinyJpeg });
  const dImg = db.drafts.at(-1).input;
  assert.equal(r.body.image, "https://cdn.shopify.com/s/files/peaces-design.jpg");
  assert.ok(dImg.lineItems[0].customAttributes.some((a) => a.key === "_design_image" && a.value === r.body.image));
  assert.ok(db.uploads >= 1); ok("built-bikini picture saved to Shopify Files and put on the order");
  r = await post("/orders/create", { design: opts, image: "data:text/html;base64,PHNjcmlwdD4=" });
  assert.equal(r.status, 201); assert.equal(r.body.image, null); ok("anything that isn't a picture is ignored and the order still goes through");
  const bra = { ...opts, topStyle: "underwire", bottomStyle: "seamless", topColor: "teal", bottomColor: "teal" };
  const rejects = [
    [{ ...opts, addons: [{ id: "laceTrim", cfg: { bottom: "sideways" } }] }, "unknown add-on choice"],
    [{ ...bra, addons: [{ id: "laceTrim", cfg: { bottom: "around" } }] }, "lace all around on a seamless bottom"],
    [{ ...bra, addons: [{ id: "fringe", cfg: { lower: "around" } }] }, "fringe all around"],
    [{ ...bra, addons: [{ id: "ruffles" }] }, "ruffles on the bralette set"],
    [{ ...opts, addons: [{ id: "extTies", cfg: { style: "wrap" } }] }, "wrapped ties without a connector"],
    [{ ...opts, addons: [{ id: "connectors" }, { id: "beads", variant: "ba-pink", cfg: { mid: 5 } }] }, "5 middle beads with a connector"],
    [{ ...opts, addons: [{ id: "beads", variant: "ba-pink", cfg: { ties: 11 } }] }, "11 beads on a tie"],
    [{ ...opts, addons: [{ id: "beads", variant: "ba-pink", cfg: { bot: 2 } }] }, "bottom beads without bottom connectors"],
    [{ ...opts, rsText: "Kat", addons: [{ id: "rhinestones", cfg: { place: "butt" } }] }, "uppercase rhinestones on the bottoms"],
    [{ ...opts, sizeTop: "XS", rsText: "K", addons: [{ id: "rhinestones", cfg: { place: "left" } }] }, "uppercase rhinestones on an XS top"],
    [{ ...opts, addons: [{ id: "charms", variant: "cg-heart", cfg: { mid: 4 } }] }, "4 middle charms"],
    [{ ...bra, addons: [{ id: "buttons", cfg: { tl: 4 } }] }, "4 buttons in a corner"],
    [{ ...opts, addons: [{ id: "bows", cfg: {} }] }, "bows with no spot"],
  ];
  for (const [bad, why] of rejects) { r = await post("/orders/create", { design: bad }); assert.equal(r.status, 400, why); }
  ok("rules enforced on the server: " + rejects.length + " bad designs rejected");
  r = await post("/orders/create", { design: { ...opts, rsText: "kate", addons: [
    { id: "charms", variant: "cp-shell", cfg: { mid: 2, left: 1, clasp: "cn-big-gold" } },
    { id: "laceRuffles", variant: "black", cfg: { lower: "front" } }, { id: "fringe", variant: "black", cfg: { lower: "front" } },
    { id: "rhinestones", cfg: { metal: "gold", place: "butt" } }] } });
  assert.equal(r.body.subtotal, 95 + 3 * 12 + 15 + 15 + 40); ok("3 long charms with clasp upgrades, lace ruffles + fringe front, 4 lowercase rhinestones on the back");
  const mint = { ...opts, bottomColor: "green", addons: [{ id: "charms", variant: "cp-pearls", cfg: { mid: 1, clasp: "cn-small-rhinestone" } },
    { id: "beads", variant: "ba-pink", cfg: { str: { ties: ["ba-pink", "bp-16mm", "ba-pink"], mid: ["ba-pink", "ba-pink", "ba-pink", "ba-pink"] } } }] };
  r = await post("/orders/create", { design: mint });
  assert.equal(r.status, 201, JSON.stringify(r.body)); assert.equal(r.body.subtotal, 95 + 12 + 5 * Math.ceil(10 / 3));
  const beadLine = db.drafts.at(-1).input.lineItems.find((l) => /Beads/.test(l.title)).title;
  assert.equal(beadLine, "Add on: Beads (Top ties, each side ×3: Acrylic · Pink, Pearl · 16 mm, Acrylic · Pink, Middle ×4: Acrylic · Pink ×4)");
  ok("mixed beads: each spot keeps its exact beads in order, priced $5 per 3");
  for (const str of [{ ties: ["ba-pink", "nope"] }, { mid: Array(5).fill("ba-pink") }, { ties: Array(11).fill("bp-16mm") }]) {
    r = await post("/orders/create", { design: { ...mint, addons: [{ id: "connectors" }, { id: "beads", variant: "ba-pink", cfg: { str } }] } });
    assert.equal(r.status, 400);
  }
  ok("mixed beads: unknown beads and over-the-limit spots rejected");
  const coral = { ...opts, topStyle: "underwire", bottomStyle: "seamless", topColor: "coral", bottomColor: "coral",
    addons: [{ id: "buttons", cfg: { str: { tr: ["large", "large", "small"], bl: ["large", "small"] } } }] };
  r = await post("/orders/create", { design: coral });
  assert.equal(r.status, 201, JSON.stringify(r.body)); assert.equal(r.body.subtotal, 95 + 10);
  assert.equal(db.drafts.at(-1).input.lineItems.find((l) => /Buttons/.test(l.title)).title,
    "Add on: Buttons (White · Top, right corner ×3: Large ×2, Small, Bottom, left corner ×2: Large, Small)");
  ok("bralette buttons: small and large mixed in each corner, $5 for every 3");
  r = await post("/orders/create", { design: { ...opts, addons: [{ id: "buttons", cfg: { str: { tn: ["small", "large", "large", "small"], bn: ["large"] } } }] } });
  assert.equal(r.body.subtotal, 95 + 10);
  assert.match(db.drafts.at(-1).input.lineItems.find((l) => /Buttons/.test(l.title)).title, /Top, along the lace line ×4: Small, Large ×2, Small/);
  ok("triangle buttons mix sizes too");
  r = await post("/orders/create", { design: { ...coral, addons: [{ id: "buttons", cfg: { str: { tr: ["huge"] } } }] } });
  assert.equal(r.status, 400); ok("buttons only come small or large");
  r = await post("/orders/create", { design: { ...opts, addons: [{ id: "rhinestones", cfg: { metal: "gold", place: "one" } }] } });
  assert.equal(r.body.subtotal, 95 + 10); ok("older saved designs (one cup) still price");
  r = await post("/orders/create", { design: { ...bra, addons: [{ id: "connectors" }, { id: "extTies" }, { id: "buttons", cfg: { tl: 3, tr: 1, br: 2, size: "large" } },
    { id: "beads", variant: "bp-16mm", cfg: { ties: 5, ext: 8, ends: 2 } }, { id: "charms", variant: "cg-halo", cfg: { mid: 1, left: 3, right: 3, clasp: "cn-big-gold" } }] } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.subtotal, 95 + 10 + 10 + 10 + 5 * Math.ceil(34 / 3) + 7 * 12); ok("bralette set at its limits: connectors $10 for both straps, corner buttons, 34 beads, 7 charms with clasp upgrades");
  r = await post("/orders/create", { design: { ...bra, addons: [{ id: "charms", variant: "cg-halo", cfg: { left: 1, clasp: "plain" } }] } });
  assert.equal(r.status, 400); ok("charms on the seamless bottom need a clasp upgrade");
  r = await post("/orders/create", { design: { ...opts, addons: [{ id: "roses", cfg: { tp: ["mid", "sides"], bp: ["sides"] } }] } });
  assert.equal(r.body.subtotal, 95 + 5); ok("5 roses: a flat $5");
  r = await post("/orders/create", { design: { ...opts, addons: [{ id: "bows", cfg: { tp: ["mid", "sides"], bp: ["mid", "sides"] } }] } });
  assert.equal(r.status, 400); ok("6 bows rejected: up to 5");
  r = await post("/orders/create", { design: { ...opts, addons: [{ id: "laceRuffles", variant: "pink", cfg: { lower: "around" } }, { id: "laceTrim", cfg: { bottom: "front" } }] } });
  assert.equal(r.status, 201, JSON.stringify(r.body)); assert.equal(r.body.subtotal, 95 + 15 + 15); ok("lace ruffles all around; lace front only adds nothing");
  r = await post("/orders/create", { design: { ...opts, addons: [{ id: "buttons", cfg: { str: { tn: Array(9).fill("large") } } }] } });
  assert.equal(r.body.subtotal, 95 + 15); ok("9 buttons: $15");
  r = await post("/orders/create", { design: { ...opts, addons: [{ id: "connectors", cfg: { top: "none", bottom: "two" } }] } });
  assert.equal(r.body.subtotal, 95 + 15); ok("bottom connectors only: $15");
  for (const bad of [{ top: "none", bottom: "no" }]) { r = await post("/orders/create", { design: { ...opts, addons: [{ id: "connectors", cfg: bad }] } }); assert.equal(r.status, 400); }
  r = await post("/orders/create", { design: { ...opts, addons: [{ id: "connectors", cfg: { top: "none", bottom: "two" } }, { id: "extTies", cfg: { style: "wrap" } }] } });
  assert.equal(r.status, 400); ok("no middle connector: no connector tie styles, no empty connector order");

  r = await post("/orders/accessories", { items: { headband: { color: "cheetah", qty: 2 }, tote: { color: "blue", qty: 1 } } });
  assert.equal(r.status, 201); assert.equal(r.body.subtotal, 2 * 10 + 15); assert.equal(r.body.total, 35);
  const acc = db.drafts.at(-1).input;
  assert.deepEqual(acc.lineItems.map((l) => [l.title, l.quantity]), [["Peaces headband (Cheetah)", 2], ["Peaces terry tote (Blue)", 1]]);
  assert.deepEqual(acc.tags, ["peaces-accessories"]); assert.equal(acc.allowDiscountCodesInCheckout, true); assert.equal(db.drafts[0].input.allowDiscountCodesInCheckout, true); ok("accessories on their own: headband + tote priced on the server");
  for (const bad of [{}, { tote: { color: "green", qty: 1 } }, { headband: { color: "teal", qty: 99 } }, { tote: { color: "pink", qty: 0 } }]) {
    r = await post("/orders/accessories", { items: bad }); assert.equal(r.status, 400);
  }
  ok("accessories: empty, wrong colour or silly quantities rejected");
  r = await post("/orders/create", { design: { ...design, topColor: "teal" } });
  assert.equal(r.status, 400); ok("teal on triangle rejected");
  const limited = { topStyle: "underwire", bottomStyle: "seamless", topColor: "cheetah", bottomColor: "green", sizeTop: "S", sizeBottom: "S", addons: [] };
  r = await post("/orders/create", { design: limited });
  assert.equal(r.status, 201, JSON.stringify(r.body)); ok("limited run: cheetah bralette + mint seamless bottom can be ordered");
  globalThis.PeacesRules.SOLD_OUT.push("bottom:seamless:green");
  r = await post("/orders/create", { design: limited });
  assert.equal(r.status, 400); assert.match(r.body.error, /sold out/);
  globalThis.PeacesRules.SOLD_OUT.length = 0; ok("a sold out piece can't be checked out");
  process.env.POPUP_CODE_UNTIL = "2099-01-01T00:00:00Z"; // the real window has ended; test the code logic itself
  r = await post("/orders/create", { design, promo: " peacespopup " });
  assert.equal(r.status, 201); assert.equal(r.body.promo, true); assert.equal(r.body.subtotal, 151 - 10); assert.equal(r.body.total, 141);
  { const li = db.drafts[db.drafts.length - 1].input.lineItems;
    assert.deepEqual(li.filter((l) => l.appliedDiscount).map((l) => [l.title.slice(0, 13), l.appliedDiscount.valueType, l.appliedDiscount.value]), [["Custom bikini", "FIXED_AMOUNT", 10]]);
    assert.ok(db.drafts[db.drafts.length - 1].input.tags.includes("peacespopup")); }
  ok("PeacesPopUp code: $10 off the order (once, on the first bikini), any capitalization");
  r = await post("/orders/create", { designs: [design, design], promo: "PEACESPOPUP" });
  assert.equal(r.body.subtotal, 302 - 10); ok("$10 once per order, not per bikini");
  r = await post("/orders/create", { design, promo: "PEACESPOPUP", customer: { phone: "3055551234", welcomeToken: welcome } });
  assert.equal(r.body.total, 126.9); ok("PeacesPopUp + welcome 10%: 10% off what's left");
  r = await post("/orders/create", { design, promo: "FREESTUFF" });
  assert.equal(r.body.promo, false); assert.equal(r.body.subtotal, 151); ok("a wrong code changes nothing");
  process.env.POPUP_CODE_UNTIL = "2020-01-01T00:00:00Z";
  r = await post("/orders/create", { design, promo: "PeacesPopUp" });
  assert.equal(r.body.promo, false); delete process.env.POPUP_CODE_UNTIL; ok("the code stops working after the pop-up");
  r = await post("/orders/create", { design: { ...design, addons: [{ id: "bows", cfg: { tp: ["mid"] }, price: 0 }] } });
  assert.equal(r.body.subtotal, 95 + 5 + 15); ok("browser can't set prices");

  const first = (await post("/orders/create", { design })).body;
  r = await post("/orders/fulfillment", { id: first.id, sig: first.sig, mode: "pickup", pickupAt: "3:15 PM", minutes: 40 });
  assert.equal(r.status, 200);
  const upd = db.drafts.find((x) => x.id === first.id).update;
  assert.ok(upd.tags.includes("pickup")); assert.ok(upd.customAttributes.some((a) => a.value === "3:15 PM")); ok("pickup time saved to draft order");
  r = await post("/orders/fulfillment", { id: first.id, sig: "forged", mode: "wait" });
  assert.equal(r.status, 400); ok("forged order signature rejected");

  // ---- Seamstress queue ----
  const tinyPic = "data:image/jpeg;base64," + Buffer.from("fake-jpeg-bytes").toString("base64");
  const waiter = (await post("/orders/create", { design, image: tinyPic, customer: { phone: "7865550101", name: "Mia <b>Wait</b>" } })).body;
  r = await post("/orders/estimate", { designs: [design, design] });
  assert.equal(r.status, 200); assert.equal(r.body.minutes, 32); assert.equal(typeof r.body.ahead, "number"); ok("estimate before checkout: sewing time for the bag + the line");
  r = await post("/orders/fulfillment", { id: waiter.id, sig: waiter.sig, mode: "wait", minutes: 30 });
  assert.equal(r.body.minutes, 16); ok("wait & watch time = her own sewing + the paid line ahead (the client's guess is ignored)");
  const ana = (await post("/orders/create", { design: opts, customer: { phone: "7865550202", name: "Ana Pickup" } })).body;
  await post("/orders/fulfillment", { id: ana.id, sig: ana.sig, mode: "pickup", pickupAt: "1:15 PM", pickupIso: new Date(Date.now() + 20 * 3600_000).toISOString() });
  r = await post("/seamstress/queue", { passcode: "nope" });
  assert.equal(r.status, 401); assert.equal(r.body.wait, undefined); ok("seamstress queue needs the passcode");
  r = await post("/seamstress/queue", { passcode: "sew-sew-123", tzOffset: 0 });
  assert.equal(r.status, 200); assert.match(db.lastDraftQuery, /tag:peaces-builder/);
  assert.deepEqual(r.body.wait.map((c) => c.number), [waiter.name]);
  assert.deepEqual(r.body.pickup.map((c) => c.number).sort(), [first.name, ana.name].sort());
  const ps = r.body.pickup.map((c) => Date.parse(c.pickupDate));
  assert.ok(ps[0] <= ps[1]); ok("orders split into Wait & Watch and Pickup Later (soonest pickup first)");
  const card = r.body.wait[0];
  assert.equal(card.customer, "Mia bWait/b"); assert.equal(card.image, "https://cdn.shopify.com/s/files/peaces-design.jpg");
  assert.equal(card.top, "Triangle top · Cheetah · S"); assert.equal(card.bottom, "Seamless bottom · Coral · M");
  assert.deepEqual(card.addons, ["Mini bows (White · Top: One in the middle of the string)", "Ruffles (Cheetah · On the top tie straps)", "Charms (Basic jump ring clasp, Top, middle ×3: Letter V ×3)"]);
  const tagBk = card.bikinis[0];
  assert.equal(tagBk.topEs, "Top triángulo · Animal print (cheetah) · S"); assert.equal(tagBk.bottomEs, "Parte de abajo seamless (fruncida) · Coral · M");
  assert.deepEqual(tagBk.addonsEs, ["Mini moños (Blanco · Parte de arriba: Uno en el centro de la tira)", "Volantes (Animal print (cheetah) · En las tiras del top)", "Dijes (Broche: Argolla básica, Arriba, centro ×3: Letra V ×3)"]);
  ok("seamstress tags: every piece and customization also written in Spanish");
  assert.deepEqual(card.extras, ["Peaces terry tote (Pink)"]); assert.equal(card.mode, "wait");
  const anaCard = r.body.pickup.find((c) => c.number === ana.name);
  assert.equal(anaCard.customer, "Ana Pickup"); assert.equal(anaCard.pickupAt, "1:15 PM"); assert.ok(Date.parse(anaCard.pickupDate) - Date.now() > 19 * 3600_000); // the exact pop-up day, not today
  ok("each card has order number, name (kept after the wait/pickup choice), bikini picture and full customization");
  r = await post("/seamstress/start", { passcode: "sew-sew-123", id: waiter.id, sewer: "" });
  assert.equal(r.status, 400); ok("a seamstress has to say who she is to start");
  r = await post("/seamstress/start", { passcode: "sew-sew-123", id: waiter.id, sewer: "Ana" });
  assert.equal(r.status, 200);
  r = await post("/seamstress/start", { passcode: "sew-sew-123", id: waiter.id, sewer: "Lucia" });
  assert.equal(r.status, 409); assert.match(r.body.error, /Ana is already sewing/);
  r = await post("/seamstress/queue", { passcode: "sew-sew-123", tzOffset: 0 });
  assert.deepEqual(r.body.sewing.map((c) => [c.number, c.sewingBy]), [[waiter.name, "Ana"]]);
  assert.ok(!r.body.next.some((c) => c.id === waiter.id)); assert.ok(r.body.sewing[0].readyAt);
  assert.ok(db.drafts.find((d) => d.id === waiter.id).update.customAttributes.some((x) => x.key === "Customer name")); ok("start sewing: shows under Sewing now, the other seamstress can't take it, nothing else on the order is lost");
  r = await post("/seamstress/start", { passcode: "sew-sew-123", id: waiter.id, start: false });
  r = await post("/seamstress/queue", { passcode: "sew-sew-123", tzOffset: 0 });
  assert.equal(r.body.sewing.length, 0);
  assert.ok(!r.body.next.some((c) => c.id === waiter.id)); assert.ok(r.body.unpaid.some((c) => c.id === waiter.id));
  assert.ok(r.body.next.every((c) => c.paid)); ok("Up next is paid orders only; unpaid ones (even someone paying right now) are on Not paid yet");
  db.drafts.find((d) => d.id === waiter.id).status = "COMPLETED";
  r = await post("/seamstress/queue", { passcode: "sew-sew-123", tzOffset: 0 });
  assert.equal(r.body.next[0].id, waiter.id); assert.ok(!r.body.unpaid.some((c) => c.id === waiter.id));
  ok("once paid it moves to Up next; stop hands it back to the top of the line");
  r = await post("/seamstress/done", { passcode: "sew-sew-123", id: waiter.id, sewer: "Lucia" });
  assert.equal(r.body.done, true);
  assert.equal(r.body.text.phone, "+17865550101"); assert.equal(r.body.text.sent, false); assert.equal(r.body.text.reason, "not-set-up");
  assert.match(r.body.text.message, /^Hi Mia! Your Peace \(order #D\d+\) is ready!/); ok("done: the customer's number + a ready text come back (Twilio not set up → one-tap text from the phone)");
  r = await post("/seamstress/queue", { passcode: "sew-sew-123" });
  assert.equal(r.body.wait.length, 0); ok("marking an order done takes it off the queue");
  assert.equal(r.body.completed.length, 1); assert.equal(r.body.completed[0].id, waiter.id);
  assert.equal(r.body.completed[0].doneBy, "Lucia"); assert.ok(Date.parse(r.body.completed[0].doneAt) > Date.now() - 60_000);
  ok("finished orders show on the Completed page with when + who finished them");
  await post("/seamstress/done", { passcode: "sew-sew-123", id: waiter.id, done: false });
  r = await post("/seamstress/queue", { passcode: "sew-sew-123" });
  assert.equal(r.body.wait.length, 1); assert.equal(r.body.completed.length, 0);
  assert.ok(!(db.drafts.find((d) => d.id === waiter.id).extraTags || []).some((t) => /^done-/.test(t)));
  ok("put back in line: leaves Completed and returns to the queue");
  r = await post("/seamstress/done", { passcode: "wrong", id: waiter.id });
  assert.equal(r.status, 401); ok("marking done needs the passcode too");
  process.env.SEAMSTRESS_PASSCODE = "";
  r = await post("/seamstress/queue", { passcode: "" });
  assert.equal(r.status, 503); process.env.SEAMSTRESS_PASSCODE = "sew-sew-123"; ok("no passcode set in Vercel → page stays locked");

  const hs = await (await fetch(`http://localhost:${APP}/api/health?shopify=1`)).json();
  assert.equal(hs.shopify.connected, true); ok("health ?shopify=1 signs in and returns the store name");

  r = await post("/waitlist", { firstName: "Mia", email: "Mia@Example.com", phone: "(786) 555-0101" });
  assert.equal(r.status, 201);
  const mia = db.customers.find((c) => c.email === "mia@example.com");
  assert.deepEqual(mia.tags, ["waitlist"]); assert.equal(mia.phone, "+17865550101");
  assert.equal(mia.emailMarketingConsent.marketingState, "SUBSCRIBED"); assert.equal(mia.smsMarketingConsent, undefined);
  ok("waitlist creates a tagged customer (email yes, SMS no)");

  r = await post("/waitlist", { firstName: "Ana", email: "ana@example.com", phone: "7865550202", sms: true });
  assert.equal(r.status, 201);
  assert.equal(db.customers.find((c) => c.email === "ana@example.com").smsMarketingConsent.marketingState, "SUBSCRIBED");
  ok("ticking the SMS box subscribes a new signup to texts");
  r = await post("/waitlist", { firstName: "Mia", email: "mia@example.com", phone: "(786) 555-0101", sms: true });
  assert.equal(r.body.existing, true);
  assert.equal(mia.smsMarketingConsent.marketingState, "SUBSCRIBED"); ok("ticking the SMS box subscribes an existing customer to texts");

  const before = db.customers.length;
  r = await post("/waitlist", { firstName: "Val", email: "val@peacesswim.com", phone: "3055551234" });
  assert.equal(r.body.existing, true); assert.equal(db.customers.length, before);
  assert.ok(db.customers[0].tags.includes("waitlist")); ok("existing customer just gets the waitlist tag");

  db.customers.push({ id: "gid://shopify/Customer/900", firstName: "Valerie", email: "old@shop.com", phone: null, tags: [] });
  r = await post("/waitlist", { firstName: "Valerie", email: "old@shop.com", phone: "239-641-0000", sms: true });
  const old = db.customers.find((c) => c.id === "gid://shopify/Customer/900");
  assert.equal(r.status, 200); assert.equal(r.body.ok, true); assert.ok(r.body.welcomeToken);
  assert.equal(old.phone, null); assert.equal(old.smsMarketingConsent, undefined);
  assert.ok(old.tags.includes("waitlist") && old.tags.includes("check-contact")); assert.match(old.note, /\+12396410000/);
  ok("an email already on file with another phone is still saved: tagged + noted, phone/consent untouched");

  r = await post("/waitlist", { firstName: "", email: "x@y.com", phone: "3055550000" });
  assert.equal(r.status, 400); ok("waitlist requires a first name");
  r = await post("/waitlist", { firstName: "Bot", email: "bot@spam.com", phone: "3055559999", company: "acme" });
  assert.equal(r.body.ok, true); assert.ok(!db.customers.some((c) => c.email === "bot@spam.com")); ok("spam bots are ignored");

  r = await post("/raffle", { firstName: "Lila", email: "lila@example.com", phone: "7865550303" });
  assert.equal(r.status, 400); assert.ok(!db.customers.some((c) => c.email === "lila@example.com"));
  ok("raffle refuses entries that didn't agree to texts");
  r = await post("/raffle", { firstName: "Lila", email: "lila@example.com", phone: "7865550303", sms: true });
  assert.equal(r.status, 201);
  const lila = db.customers.find((c) => c.email === "lila@example.com");
  assert.deepEqual(lila.tags, ["raffle-entry"]); assert.equal(lila.smsMarketingConsent.marketingState, "SUBSCRIBED");
  assert.equal(lila.emailMarketingConsent.marketingState, "SUBSCRIBED");
  ok("raffle creates a customer tagged raffle-entry, subscribed to texts + email");
  const n2 = db.customers.length;
  r = await post("/raffle", { firstName: "Mia", email: "mia@example.com", phone: "(786) 555-0101", sms: true });
  assert.equal(r.body.existing, true); assert.equal(db.customers.length, n2);
  assert.ok(mia.tags.includes("waitlist") && mia.tags.includes("raffle-entry"));
  ok("waitlist customer who enters the raffle keeps both tags, no duplicate");

  const miaBefore = JSON.stringify({ phone: mia.phone, email: mia.email, sms: mia.smsMarketingConsent, em: mia.emailMarketingConsent });
  for (const endpoint of ["/waitlist", "/raffle", "/customers/create"]) {
    for (const contacts of [
      { email: "mia@example.com", phone: "3055559876" },
      { email: "mia@example.com", phone: "7865550303" },
    ]) {
      r = await post(endpoint, { name: "Different", firstName: "Different", ...contacts, sms: true });
      assert.ok(r.status === 200 && r.body.ok, endpoint + " " + r.status);
      assert.equal(JSON.stringify({ phone: mia.phone, email: mia.email, sms: mia.smsMarketingConsent, em: mia.emailMarketingConsent }), miaBefore);
    }
  }
  assert.ok(mia.tags.includes("check-contact")); assert.ok(mia.tags.includes("peaces-builder"));
  ok("partly-matching details never change someone's contact info or consent, but the signup is kept and flagged");

  const count = db.customers.length;
  r = await post("/customers/create", { name: "New Person", email: "new@example.com", phone: "7865550101", marketing: true });
  assert.equal(r.status, 201); assert.equal(db.customers.length, count + 1);
  const np = db.customers.find((c) => c.email === "new@example.com");
  assert.equal(np.phone, undefined); assert.ok(np.tags.includes("peaces-builder") && np.tags.includes("check-contact"));
  assert.match(np.note, /\+17865550101/); assert.equal(mia.phone, "+17865550101");
  ok("a new email with a phone that's on someone else still gets its own customer (phone kept in the note)");

  r = await post("/customers/create", { name: "Mia", email: "MIA@EXAMPLE.COM", phone: "7865550101" });
  assert.equal(r.body.ok, true); assert.equal(r.body.existing, true);
  assert.ok(verifyWelcomeToken(r.body.welcomeToken, "+17865550101"));
  assert.ok(mia.tags.includes("waitlist") && mia.tags.includes("peaces-builder"));
  ok("matching existing contacts receive a welcome receipt without account access, and keep every tag");


  { // shipping (after the pop-up)
    const sh = (await post("/orders/create", { design, customer: { phone: "7865550909", name: "Shay Ship" } })).body;
    const dr = db.drafts.find((d) => d.id === sh.id);
    assert.ok(dr.input.lineItems.every((l) => l.requiresShipping === true)); assert.ok(dr.input.tags.includes("ship"));
    ok("orders ship: Shopify checkout asks for an address on every line");
    let q = await post("/seamstress/queue", { passcode: "sew-sew-123" });
    assert.ok(!q.body.all.some((c) => c.id === sh.id)); ok("an unpaid shipping order (open checkout) isn't in the sewing line");
    dr.status = "COMPLETED";
    q = await post("/seamstress/queue", { passcode: "sew-sew-123" });
    const c = q.body.next.find((x) => x.id === sh.id); assert.ok(c); assert.equal(c.mode, "ship");
    ok("once paid it's in Up next, marked Ship it");
    const dn = await post("/seamstress/done", { passcode: "sew-sew-123", id: sh.id, sewer: "Ana" });
    assert.equal(dn.body.text.reason, "ship"); assert.equal(dn.body.text.sent, false);
    ok("Done on a shipped order sends no 'come get it' text");
  }
  assert.equal(db.tokenCalls, 1); ok("access token fetched once and cached");
  assert.deepEqual(LIVE_SOLD_OUT, []); ok("nothing is sold out right now");
  console.log(`\nAll ${n} checks passed.`);
} finally { s1.close(); s2.close(); }


