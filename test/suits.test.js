import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { priceDesign } from "../lib/catalog.js";
import "../lib/suits.js";

const S = globalThis.PeacesSuits;

test("every Shop suit is a valid design the server can price, with a picture", () => {
  assert.ok(S.SUITS.length >= 6);
  for (const s of S.SUITS) {
    const o = priceDesign({ ...s.design, sizeTop: "M", sizeBottom: "S" });
    assert.ok(o.subtotal >= 95, s.id);
    assert.ok(fs.existsSync(new URL("../photos/shop/" + s.id + ".png", import.meta.url)), "picture for " + s.id);
  }
});

test("lookbook tags point at real suits and real photos, inside the photo", () => {
  for (const [look, tags] of Object.entries(S.LOOK_TAGS)) {
    assert.ok(fs.existsSync(new URL("../photos/lookbook/" + look + ".jpg", import.meta.url)), look);
    for (const [id, x, y] of tags) { assert.ok(S.byId(id), id); assert.ok(x > 0 && x < 100 && y > 0 && y < 100); }
  }
});
