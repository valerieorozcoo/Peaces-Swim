import test from "node:test";
import assert from "node:assert/strict";
import { pickupDate, buildQueue } from "../lib/queue.js";

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
