import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
assert.ok(html.includes('CHECKOUT READY'));
assert.ok(!html.includes('ORDER CONFIRMED'));
const source = html.split('document.getElementById("checkoutBtn").addEventListener("click",async function(e){')[1].split('\n  });')[0];
const compile = new Function("document", "window", "api", "saveDesign", "designPayload", "state", "syncPerk", "renderAll", "openGate", "resetFulfilmentFeedback",
  'var currentOrder={id:"old"},lead={phone:"3055551234",welcomeToken:"receipt"}; return {run:async function(e){' + source + '\n},order:()=>currentOrder};');

for (const scenario of ["success", "blocked-popup", "400", "409", "503", "malformed"]) {
  const nodes = { checkoutNote: { textContent: "" }, fulfil: { hidden: false }, slotBlock: { hidden: false }, waitBlock: { hidden: false },
    fulfilChoices: { querySelectorAll: () => [{ setAttribute(k,v) { assert.equal(v,"false"); } }] } };
  const state = { fulfil: "pickup", pickupAt: "3:00 PM", perk: true };
  const tab = { location: { href: "" }, closed: false, close() { this.closed = true; } };
  const window = { location: { href: "" }, open: () => scenario === "blocked-popup" ? null : tab, scrollTo() {} };
  const button = { dataset: {}, textContent: "CHECKOUT" };
  let gate = null, calls = 0, release;
  const pending = new Promise(resolve => { release = resolve; });
  const fixture = compile({ getElementById: id => nodes[id] }, window, async () => {
    calls++; await pending;
    if (/^\d+$/.test(scenario)) throw Object.assign(new Error("Checkout failed " + scenario), { status: +scenario });
    return scenario === "malformed" ? {} : { id: "draft", sig: "signed", name: "#D1", checkoutUrl: "https://example.com/unpaid" };
  }, () => {}, () => ({}), state, () => {}, () => {}, step => { gate = step; }, () => {});
  const running = fixture.run.call(button, { preventDefault() {} });
  assert.equal(nodes.fulfil.hidden, true); assert.equal(fixture.order(), null);
  await fixture.run.call(button, { preventDefault() {} }); assert.equal(calls, 1);
  release(); await running;
  assert.equal(button.dataset.busy, undefined); assert.equal(button.textContent, "CHECKOUT");
  if (scenario === "success" || scenario === "blocked-popup") {
    assert.equal(nodes.fulfil.hidden, false); assert.equal(fixture.order().id, "draft");
    assert.equal(state.pickupAt, null); assert.equal(state.fulfil, null);
    assert.equal(nodes.slotBlock.hidden, true); assert.equal(nodes.waitBlock.hidden, true);
    assert.equal(scenario === "success" ? tab.location.href : window.location.href, "https://example.com/unpaid");
    assert.match(nodes.checkoutNote.textContent, /finish paying/);
  } else {
    assert.equal(nodes.fulfil.hidden, true); assert.equal(fixture.order(), null); assert.equal(tab.closed, true);
    assert.equal(tab.location.href, ""); assert.doesNotMatch(nodes.checkoutNote.textContent, /copied|confirmed/i);
    if (scenario === "409") { assert.equal(gate, "stepPhone"); assert.equal(state.perk, false); }
  }
}
console.log("Checkout UI checks passed: unpaid draft, blocked popup, validation error, expired discount, outage, malformed reply, and duplicate clicks.");
