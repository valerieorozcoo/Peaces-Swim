import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Checkout is two steps now: choose wait & watch / pickup (before paying), then "Continue to checkout"
// makes the order, saves the choice on it and opens Shopify. This exercises step 2 in isolation.
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
assert.ok(html.includes('CHECKOUT READY'));
assert.ok(html.includes('id="fulfilGo"'));
assert.ok(!html.includes('ORDER CONFIRMED'));
assert.ok(!/<button[^>]*data-mode="pickup"[^>]*hidden/.test(html), "pickup later is offered");
const source = html.split('document.getElementById("fulfilGo").addEventListener("click",async function(){')[1].split('\n  });')[0];
const compile = new Function("document", "window", "api", "saveDesign", "designPayload", "state", "syncPerk", "renderAll", "openGate", "designImageOrNull", "rememberLead", "bagPayload",
  "fulfilStage", "sendFulfilment", "slotMinutes", "makeMinutes", "syncGo",
  'var bag=[],currentOrder=null,lead={phone:"3055551234",welcomeToken:"receipt"},PROMO_CODE="PEACESPOPUP",promoOn=function(){return false;},SHIPPING=false,prepared=null,pictureKey=function(){return "";},creator=null; return {run:async function(){' + source + '\n},order:()=>currentOrder};');

for (const scenario of ["success", "blocked-popup", "400", "409", "503", "malformed"]) {
  const nodes = { checkoutNote: { textContent: "" }, fulfil: { hidden: false }, fulfilStatus: { hidden: true, textContent: "" } };
  const state = { fulfil: "pickup", pickupAt: "1:15 PM", pickupIso: "2026-11-05T18:15:00.000Z", perk: true };
  const tab = { location: { href: "" }, closed: false, close() { this.closed = true; } };
  const window = { location: { href: "" }, open: () => scenario === "blocked-popup" ? null : tab, scrollTo() {} };
  const button = { dataset: {}, textContent: "CONTINUE TO CHECKOUT", disabled: false };
  let gate = null, calls = 0, release, staged = null, sent = null;
  const pending = new Promise(resolve => { release = resolve; });
  const fixture = compile({ getElementById: id => nodes[id] }, window, async () => {
    calls++; await pending;
    if (/^\d+$/.test(scenario)) throw Object.assign(new Error("Checkout failed " + scenario), { status: +scenario });
    return scenario === "malformed" ? {} : { id: "draft", sig: "signed", name: "#D1", checkoutUrl: "https://example.com/unpaid" };
  }, () => {}, () => ({}), state, () => {}, () => {}, step => { gate = step; }, async () => null, () => {}, () => ({ designs: [], images: [] }),
  (ready) => { staged = ready; }, (m) => { sent = m; }, () => 95, () => 20, () => {});
  const running = fixture.run.call(button);
  assert.equal(button.textContent, "PREPARING…");
  await fixture.run.call(button); assert.equal(calls, 1); // a second tap while busy does nothing
  release(); await running;
  assert.equal(button.dataset.busy, undefined); assert.equal(button.textContent, "CONTINUE TO CHECKOUT");
  if (scenario === "success" || scenario === "blocked-popup") {
    assert.equal(fixture.order().id, "draft"); assert.equal(staged, true);
    assert.equal(sent, 95, "the pickup choice is saved on the new order");
    assert.equal(scenario === "success" ? tab.location.href : window.location.href, "https://example.com/unpaid");
    assert.match(nodes.checkoutNote.textContent, /finish paying/i);
  } else {
    assert.equal(fixture.order(), null); assert.equal(tab.closed, true); assert.equal(sent, null);
    assert.equal(tab.location.href, ""); assert.equal(nodes.fulfilStatus.hidden, false);
    if (scenario === "409") { assert.equal(gate, "stepPhone"); assert.equal(state.perk, false); assert.equal(nodes.fulfil.hidden, true); }
  }
}
console.log("Checkout UI checks passed: choice saved on the new order, blocked popup, validation error, expired discount, outage, malformed reply, and duplicate clicks.");
