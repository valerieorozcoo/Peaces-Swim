import assert from "node:assert/strict";
import { priceDesign } from "../lib/catalog.js";
import { DETAIL_OPTIONS, LOCATIONS, defaultLocations, locationsFor, validatePlacements } from "../lib/customizations.js";

const bralette = { topStyle:"underwire", bottomStyle:"seamless", topColor:"coral", bottomColor:"teal", sizeTop:"S", sizeBottom:"M", initials:"VO" };
const triangle = { ...bralette, topStyle:"triangle", topColor:"green", bottomStyle:"triangle", bottomColor:"cheetah" };
const detail = (id, placements, option) => ({ id, placements, option });
const order = (d, addons) => priceDesign({ ...d, addons });

const mono = order(bralette,[detail("initials",["top-cups"],"gold")]);
assert.equal(mono.subtotal,90);
assert.deepEqual(mono.lines[1].attrs,{Placement:"Top · both cups",Finish:"Gold",Initials:"VO"});
assert.equal(mono.lines[1].title,"Add-on: Rhinestones (VO)");
assert.equal(order(bralette,[detail("beads",["top-straps"],"lightpink")]).subtotal,83);
assert.match(order(bralette,[detail("laceTrim",["top-underbust","bottom-hips"],"white")]).lines[1].attrs.Placement,/lower cup edges; Bottom · both hips/);
assert.match(order(bralette,[detail("charmsB",["top-center"],"c-heart")]).lines[1].attrs.Placement,/center front/);
for (const route of ["top-wrap-cross","top-wrap-center"]) {
  const o=order(triangle,[detail("extTies",[route],"pink"),detail("connectors",["top-center","bottom-hips"],"gold"),detail("beads",["top-ties"],"coral"),detail("charmsP",["top-ties"],"c-bead1")]);
  assert.equal(o.subtotal,107);
  assert.ok(o.lines.every(l=>Number.isFinite(l.price)));
  assert.match(o.lines[1].attrs.Placement,/wrap/);
}
assert.equal(order(bralette,[detail("extTies",["top-wrap-center"],"green")]).subtotal,87);
assert.throws(()=>order(triangle,[detail("charmsB",["top-center"],"c-heart")]),/valid placement/);
assert.throws(()=>order(triangle,[detail("initials",["top-cups"],"gold")]),/valid placement/);
assert.throws(()=>order(bralette,[detail("extTies",["top-wrap-cross"],"pink")]),/valid placement/);
assert.throws(()=>order(bralette,[detail("beads",["top-ties"],"coral")]),/extended ties/);
assert.throws(()=>order(triangle,[detail("extTies",["top-wrap-cross"],"pink")]),/center connector/);
assert.throws(()=>order(bralette,[detail("initials",["top-cups","top-left"],"gold")]),/individual cups/);
assert.throws(()=>order(bralette,[detail("laceTrim",["bottom-waist","bottom-hips"],"white")]),/hip-to-hip/);
assert.throws(()=>order(bralette,[detail("charmsB",["top-center"],"c-heart"),detail("buttons",["top-center"],"pearl")]),/one detail/);
assert.throws(()=>order(bralette,[detail("initials",["top-cups"],"platinum")]),/available finish/);
assert.throws(()=>order({...bralette,initials:"<x>"},[detail("initials",["top-cups"],"gold")]),/letters/);
for (const placements of [[],["unknown"],["top-straps","top-straps"],"top-straps",null])
  assert.throws(()=>order(bralette,[detail("beads",placements,"coral")]),/valid placement/);
assert.throws(()=>order(bralette,[detail("__proto__",["top-straps"])]),/Unknown add-on/);

// Legacy requests still price correctly, with explicit, deterministic order attributes.
const legacy=order(triangle,[{id:"bows",option:"White"},{id:"initials"}]);
assert.equal(legacy.subtotal,95);
assert.equal(legacy.lines[2].attrs.Finish,"Silver");
assert.equal(legacy.lines[2].attrs.Placement,"Bottom · center front");
for (const d of [triangle,bralette]) for (const id of Object.keys(DETAIL_OPTIONS)) {
  const placements=defaultLocations(id,d);
  assert.ok(placements.every(p=>locationsFor(id,d).includes(p)&&LOCATIONS[p]));
  if(placements.length) validatePlacements([{id,placements}],d);
}
console.log("Customization checks passed: cup initials, metallic finishes, bralette beads, trim positions, both wrap routes, dependencies, placement/finish tampering, center conflicts and legacy designs.");
