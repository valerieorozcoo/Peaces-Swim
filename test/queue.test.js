import test from "node:test";
import assert from "node:assert/strict";
import { pickupDate, buildQueue, lineAhead } from "../lib/queue.js";
import "../lib/rules.js";

test("pickup time is read in the shop's local time, rolling to tomorrow after midnight", () => {
  // Miami in November is UTC-5 → getTimezoneOffset() = 300
  assert.equal(pickupDate("2026-11-01T19:05:00Z", "3:15 PM", 300), "2026-11-01T20:15:00.000Z");
  assert.equal(pickupDate("2026-11-01T19:05:00Z", "12:00 PM", 300), "2026-11-02T17:00:00.000Z"); // slots are always ahead, so noon chosen at 2:05 PM means tomorrow
  assert.equal(pickupDate("2026-11-02T04:50:00Z", "12:05 AM", 300), "2026-11-02T05:05:00.000Z"); // 11:50 PM → just after midnight
  assert.equal(pickupDate("2026-11-01T19:05:00Z", "nonsense", 300), null);
});

const draft = (n, { tags = ["peaces-builder"], attrs = [], status = "OPEN", createdAt = "2026-11-01T18:00:00Z" } = {}) => ({
  id: "gid://shopify/DraftOrder/" + n, name: "#D" + n, createdAt, status, tags, customAttributes: attrs, email: null, customer: null,
  lineItems: { nodes: [
    { title: "Custom bikini — Triangle top / Triangle bottom", quantity: 1, customAttributes: [{ key: "Top", value: "Triangle top · Mint · S" }, { key: "Bottom", value: "Triangle bottom · Mint · S" }] },
    { title: "Add-on: Mini bows (Pink)", quantity: 1, customAttributes: [] },
  ] },
});

test("wait & watch is first come first served, pickup is soonest first, done and undecided unpaid orders are left out", () => {
  const q = buildQueue([
    draft(1, { tags: ["peaces-builder", "wait-and-watch"], attrs: [{ key: "Chosen at", value: "2026-11-01T19:10:00Z" }] }),
    draft(2, { tags: ["peaces-builder", "wait-and-watch"], attrs: [{ key: "Chosen at", value: "2026-11-01T19:02:00Z" }] }),
    draft(3, { tags: ["peaces-builder", "pickup"], attrs: [{ key: "Chosen at", value: "2026-11-01T19:00:00Z" }, { key: "Pickup time", value: "4:30 PM" }] }),
    draft(4, { tags: ["peaces-builder", "pickup"], attrs: [{ key: "Chosen at", value: "2026-11-01T19:20:00Z" }, { key: "Pickup time", value: "3:45 PM" }] }),
    draft(5, { tags: ["peaces-builder", "wait-and-watch", "seamstress-done"] }),
    draft(6, {}), // never chose, not paid → not shown
    draft(7, { status: "COMPLETED", createdAt: "2026-11-01T19:30:00Z" }), // paid but never chose → wait & watch
  ], 300);
  assert.deepEqual(q.wait.map((c) => c.number), ["#D2", "#D1", "#D7"]);
  assert.deepEqual(q.pickup.map((c) => c.number), ["#D4", "#D3"]);
  assert.equal(q.wait[2].paid, true); assert.equal(q.wait[2].mode, null);
  assert.deepEqual(q.wait[0].addons, ["Mini bows (Pink)"]);
});

test("sewing minutes per customization and the wait & watch line ahead", () => {
  const R = globalThis.PeacesRules;
  const d = { topStyle: "triangle", bottomStyle: "triangle", addons: [
    { id: "laceRuffles", cfg: {} }, { id: "connectors", cfg: { top: "mid", bottom: "two" } }, { id: "roses", cfg: { tp: ["sides"], bp: ["mid"] } },
    { id: "buttons", cfg: { tn: 2, bn: 1 } }, { id: "rhinestones", cfg: {} }, { id: "fringe", cfg: {} }, { id: "extTies", cfg: {} }] };
  assert.equal(R.designMinutes(d), 5 + 8 + 6 + 3 + 6 + 3 + 4 + 2);
  const now = Date.now(), iso = (m) => new Date(now - m * 60_000).toISOString();
  const w = (n, attrs, status = "COMPLETED") => draft(n, { status, tags: ["peaces-builder", "wait-and-watch"], attrs });
  const ahead = lineAhead([
    w(1, [{ key: "Chosen at", value: iso(10) }, { key: "Work minutes", value: "20" }]),
    w(2, [{ key: "Chosen at", value: iso(5) }, { key: "Work minutes", value: "12" }], "OPEN"),   // paying right now → counts
    w(3, [{ key: "Chosen at", value: iso(90) }, { key: "Work minutes", value: "40" }], "OPEN"),  // abandoned → doesn't
    w(4, [{ key: "Chosen at", value: iso(1) }, { key: "Work minutes", value: "9" }]),            // the new customer herself
    w(5, [{ key: "Chosen at", value: iso(30) }]),                                                 // old order: 5 + 3 per add-on
  ], "gid://shopify/DraftOrder/4");
  assert.equal(ahead, 20 + 12 + 8);
});
