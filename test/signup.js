import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const source = html.split('document.getElementById("newForm").addEventListener("submit",async function(e){')[1].split('\n  });')[0];
const compile = new Function("document", "saveCustomer", "showStep", "storeLead", "syncPerk", "renderAll", "state",
  'var lead=null,pendingPhone="3055551234"; return {run:async function(e){' + source + '\n},lead:()=>lead};');

for (const scenario of ["success", "conflict", "offline", "malformed"]) {
  const nodes = Object.fromEntries(["gName", "gEmail", "newErr", "gMarketing", "backTitle", "backSub", "notYou"].map(id => [id, {
    value: id === "gName" ? "Mia" : "mia@example.com", hidden: true, checked: false,
    classList: { remove() {}, add() {} }, focus() {}, textContent: "",
  }]));
  const button = { disabled: false }, form = { dataset: {}, querySelector: () => button };
  const state = { perk: false }; let step = "stepNew", requests = 0, release;
  const pending = new Promise(resolve => { release = resolve; });
  const fixture = compile({ getElementById: id => nodes[id] }, async () => {
    requests++; await pending;
    if (scenario === "conflict") throw new Error("Check your email and phone.");
    if (scenario === "offline") throw new Error("Shop unavailable.");
    return scenario === "malformed" ? {} : { ok: true, welcomeToken: "signed-receipt" };
  }, id => { step = id; }, () => {}, () => {}, () => {}, state);
  const running = fixture.run.call(form, { preventDefault() {} });
  assert.equal(state.perk, false); assert.equal(fixture.lead(), null);
  assert.equal(button.disabled, true); assert.equal(step, "stepNew");
  await fixture.run.call(form, { preventDefault() {} });
  assert.equal(requests, 1);
  release(); await running;
  assert.equal(button.disabled, false); assert.equal(form.dataset.busy, undefined);
  assert.equal(state.perk, scenario === "success");
  assert.equal(step, scenario === "success" ? "stepBack" : "stepNew");
  if (scenario === "success") assert.equal(fixture.lead().welcomeToken, "signed-receipt");
  else { assert.equal(fixture.lead(), null); assert.equal(nodes.newErr.hidden, false); }
}
console.log("  ✓ signup UI waits for success, prevents duplicate requests, and handles conflicts, outages, and malformed replies");
