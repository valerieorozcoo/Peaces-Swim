// End-to-end API test against the mock Shopify. Run: npm test
import assert from "node:assert/strict";
import "./signup.js";
import { startMockShopify } from "./mock-shopify.js";
import { welcomeToken, verifyWelcomeToken } from "../lib/sign.js";

const MOCK = 9811, APP = 9812;
process.env.SHOPIFY_BASE_URL = "http://localhost:" + MOCK;
process.env.SHOPIFY_CLIENT_ID = "test-id";
process.env.SHOPIFY_CLIENT_SECRET = "test-secret";
const { startLocal } = await import("./local-server.js");
const { server: s1, db } = await startMockShopify(MOCK);
const s2 = await startLocal(APP);
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
    addons: [{ id: "bows", option: "White" }, { id: "ruffles", option: "Pink" }, { id: "initials" }], initials: "val", tote: true, headband: false };
  r = await post("/orders/create", { design, customer: { phone: "3055551234", welcomeToken: welcome } });
  assert.equal(r.status, 201); assert.equal(r.body.subtotal, 95 + 5 + 15 + 3 * 10 + 15);
  assert.equal(r.body.total, 144); assert.equal(r.body.discounted, true);
  const d0 = db.drafts[0].input;
  assert.equal(d0.purchasingEntity, undefined);
  assert.ok(d0.lineItems.some((l) => l.title === "Add-on: Letter charms (VAL · plain 7mm ring)")); ok("signed welcome discount on guest checkout, no customer-account link");

  r = await post("/orders/create", { design, customer: { phone: "3055551234" } });
  assert.equal(r.body.discounted, false);
  assert.equal(db.drafts.at(-1).input.purchasingEntity, undefined);
  ok("knowing an existing phone cannot link its account or claim the welcome discount");
  for (const token of [welcome + "forged", welcomeToken("+13055551234", Date.now() - 3_600_001)]) {
    const count = db.drafts.length;
    r = await post("/orders/create", { design, customer: { phone: "3055551234", welcomeToken: token } });
    assert.equal(r.status, 409); assert.equal(db.drafts.length, count);
  }
  r = await post("/orders/create", { design, customer: { phone: "3055559999", welcomeToken: welcome } });
  assert.equal(r.status, 409); ok("forged, expired, and wrong-phone discount claims cannot silently change checkout pricing");

  r = await post("/orders/create", { design, customer: { phone: "9999999999" } });
  assert.equal(r.body.total, 160); assert.equal(r.body.discounted, false); ok("no discount for unknown phone");

  const opts = { topStyle: "triangle", bottomStyle: "triangle", topColor: "green", bottomColor: "cheetah", sizeTop: "S", sizeBottom: "S", initials: "A", rsText: "K",
    addons: [{ id: "beadsWavy", option: "Pink", cfg: { sets: "3" } }, { id: "laceTrim", option: "White", cfg: { bottom: "around" } },
             { id: "connectors", option: "Heart", cfg: { bottom: "two" } }, { id: "rhinestones", cfg: { metal: "silver", place: "both" } }, { id: "extTies", cfg: { style: "2" } },
             { id: "bows", option: "Pink", cfg: { top: "straps", bottom: "center" } }] };
  r = await post("/orders/create", { design: opts, customer: { phone: "9999999999" } });
  assert.equal(r.body.subtotal, 95 + 15 + 25 + 25 + 20 + 10 + 5); ok("add-on choices priced on server (beads x3, lace all around, 2 connectors, rhinestones both cups, ties)");
  const tinyJpeg = "data:image/jpeg;base64," + Buffer.from("fake-jpeg-bytes").toString("base64");
  r = await post("/orders/create", { design: opts, image: tinyJpeg });
  const dImg = db.drafts.at(-1).input;
  assert.equal(r.body.image, "https://cdn.shopify.com/s/files/peaces-design.jpg");
  assert.ok(dImg.lineItems[0].customAttributes.some((a) => a.key === "_design_image" && a.value === r.body.image));
  assert.ok(db.uploads >= 1); ok("built-bikini picture saved to Shopify Files and put on the order");
  r = await post("/orders/create", { design: opts, image: "data:text/html;base64,PHNjcmlwdD4=" });
  assert.equal(r.status, 201); assert.equal(r.body.image, null); ok("anything that isn't a picture is ignored and the order still goes through");
  r = await post("/orders/create", { design: { ...opts, addons: [{ id: "laceTrim", cfg: { bottom: "sideways" } }] } });
  assert.equal(r.status, 400); ok("unknown add-on choice rejected");
  r = await post("/orders/create", { design: { ...opts, topStyle: "underwire", bottomStyle: "seamless", topColor: "teal", bottomColor: "teal", addons: [{ id: "laceTrim", cfg: { bottom: "around" } }] } });
  assert.equal(r.status, 400); ok("no all-the-way-around lace on seamless bottoms");
  r = await post("/orders/create", { design: { ...opts, addons: [
    { id: "charmsP", option: "Shell", cfg: { clasp: "cn-big-gold" } }, { id: "charmsB", option: "Clear heart", cfg: { clasp: "plain" } },
    { id: "laceRuffles", option: "Black", cfg: { edge: "straps", lower: "around" } }, { id: "fringe", option: "Gold", cfg: { edge: "straps", lower: "sides" } },
    { id: "rhinestones", cfg: { metal: "gold", place: "back" } }] } });
  assert.equal(r.body.subtotal, 95 + 25 + 10 + 5 + 5 + 10); ok("premium clasp +$10, plain ring included, lace ruffle / fringe spots, rhinestones on the back");
  r = await post("/orders/create", { design: { ...opts, addons: [{ id: "rhinestones", cfg: { metal: "gold", place: "one" } }] } });
  assert.equal(r.body.subtotal, 95 + 10); ok("older saved designs (one cup) still price");
  r = await post("/orders/create", { design: { ...opts, topStyle: "underwire", bottomStyle: "seamless", topColor: "teal", bottomColor: "teal", addons: [{ id: "fringe", cfg: { edge: "hem", lower: "around" } }] } });
  assert.equal(r.status, 400); ok("fringe all around not offered on seamless bottoms");

  r = await post("/orders/create", { design: { ...design, topColor: "teal" } });
  assert.equal(r.status, 400); ok("teal on triangle rejected");
  r = await post("/orders/create", { design: { ...design, bottomStyle: "seamless", addons: [{ id: "connectors" }], topStyle: "underwire", topColor: "teal" } });
  assert.equal(r.status, 400); ok("connectors on bralette + seamless rejected");
  r = await post("/orders/create", { design: { ...design, addons: [{ id: "bows", price: 0 }] } });
  assert.equal(r.body.subtotal, 95 + 5 + 15); ok("browser can't set prices");

  const first = (await post("/orders/create", { design })).body;
  r = await post("/orders/fulfillment", { id: first.id, sig: first.sig, mode: "pickup", pickupAt: "3:15 PM", minutes: 40 });
  assert.equal(r.status, 200);
  const upd = db.drafts.find((x) => x.id === first.id).update;
  assert.ok(upd.tags.includes("pickup")); assert.ok(upd.customAttributes.some((a) => a.value === "3:15 PM")); ok("pickup time saved to draft order");
  r = await post("/orders/fulfillment", { id: first.id, sig: "forged", mode: "wait" });
  assert.equal(r.status, 400); ok("forged order signature rejected");

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
  r = await post("/waitlist", { firstName: "Valerie", email: "old@shop.com", phone: "239-641-0000" });
  const old = db.customers.find((c) => c.id === "gid://shopify/Customer/900");
  assert.equal(r.status, 409); assert.equal(old.phone, null); assert.deepEqual(old.tags, []);
  ok("an unverified signup cannot add a phone to an existing email record");

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

  for (const endpoint of ["/waitlist", "/raffle", "/customers/create"]) {
    const snapshot = JSON.stringify(db.customers);
    for (const contacts of [
      { email: "mia@example.com", phone: "3055559876" },
      { email: "other@example.com", phone: "7865550101" },
      { email: "mia@example.com", phone: "7865550303" },
    ]) {
      r = await post(endpoint, { name: "Different", firstName: "Different", ...contacts, sms: true });
      assert.equal(r.status, 409); assert.equal(r.body.welcomeToken, undefined);
      assert.equal(JSON.stringify(db.customers), snapshot);
    }
  }
  ok("conflicting email/phone pairs never change consent, tags, or customer details and never grant discounts");
  r = await post("/customers/create", { name: "Mia", email: "MIA@EXAMPLE.COM", phone: "7865550101" });
  assert.equal(r.body.ok, true); assert.equal(r.body.existing, true);
  assert.ok(verifyWelcomeToken(r.body.welcomeToken, "+17865550101"));
  ok("matching existing contacts receive a welcome receipt without account access");


  assert.equal(db.tokenCalls, 1); ok("access token fetched once and cached");
  console.log(`\nAll ${n} checks passed.`);
} finally { s1.close(); s2.close(); }


