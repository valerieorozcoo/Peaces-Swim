import test from "node:test";
import assert from "node:assert/strict";
import { pickupDate, buildQueue, lineAhead, schedule } from "../lib/queue.js";
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

test("sewing schedule: 2 seamstresses, wait & watch before pickups unless a pickup would be late", () => {
  const now = Date.parse("2026-11-05T12:00:00-05:00"), at = (m) => new Date(now + m * 60_000).toISOString();
  const c = (id, mode, work, chosen, pick) => ({ id, mode, paid: true, work, chosenAt: at(chosen), pickupDate: pick == null ? null : at(pick) });
  const plan = schedule([
    c("pickup-3h", "pickup", 20, -30, 180),          // picks up in 3 hours: waits behind everyone watching
    c("w1", "wait", 15, -10), c("w2", "wait", 25, -5),
    c("pickup-40", "pickup", 20, -40, 40),           // picks up in 40 min: must start by +10 min, so it jumps ahead
    c("w3", "wait", 10, -1),
    { ...c("sewing", "wait", 30, -60), startedAt: at(-20), sewingBy: "Ana" },
  ], now);
  const by = Object.fromEntries(plan.map((p) => [p.id, p]));
  const m = (iso) => (Date.parse(iso) - now) / 60_000;
  assert.deepEqual(plan.map((p) => p.id), ["sewing", "w1", "pickup-40", "w2", "w3", "pickup-3h"]);
  assert.equal(m(by.sewing.readyAt), 10);              // Ana started 20 min ago on a 30 min bikini
  assert.equal(m(by.w1.startAt), 0);                   // the other seamstress is free right away
  assert.equal(m(by["pickup-40"].readyAt), 30);        // ready 10 min before its pickup
  assert.equal(m(by.w3.readyAt), 40);
  assert.ok(m(by["pickup-3h"].readyAt) <= 180 && !by["pickup-3h"].late);
  // before the pop-up opens nothing starts until 10 AM
  const early = schedule([c("w", "wait", 15, 0)], Date.parse("2026-11-05T08:00:00-05:00"));
  assert.ok(Date.parse(early[0].startAt) >= Date.parse(process.env.POPUP_OPEN || "2026-11-05T10:00:00-05:00"));
});
