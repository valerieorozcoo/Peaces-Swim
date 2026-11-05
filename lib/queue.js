// Turns Peaces Builder draft orders from Shopify into the seamstress queue:
// two lists, Wait & Watch (first come, first served) and Pickup Later (soonest pickup first).
import crypto from "node:crypto";
import { HttpError } from "./http.js";

export const DONE_TAG = "seamstress-done";

// Seamstress page passcode lives only in Vercel (SEAMSTRESS_PASSCODE), never in the page.
export function checkPasscode(given) {
  const want = process.env.SEAMSTRESS_PASSCODE || "";
  if (!want) throw new HttpError(503, "The seamstress page isn't set up yet. Add SEAMSTRESS_PASSCODE in Vercel.");
  const a = crypto.createHash("sha256").update(String(given || "")).digest();
  const b = crypto.createHash("sha256").update(want).digest();
  if (!crypto.timingSafeEqual(a, b)) throw new HttpError(401, "Wrong passcode");
}

const split = (v) => (v ? String(v).split("\n").filter(Boolean) : []);
const attr = (list, key) => ((list || []).find((a) => a.key === key) || {}).value || "";

// "3:15 PM" on the day the customer chose it, in the shop's local time (tzOffset is
// Date#getTimezoneOffset() from the seamstress's browser). A time earlier than the
// moment they chose means tomorrow (e.g. chosen at 11:50 PM for 12:05 AM).
export function pickupDate(chosenAtIso, pickupAt, tzOffset = 0) {
  const m = /^(\d{1,2}):(\d{2})\s*([AP])M$/i.exec(String(pickupAt || "").trim());
  const chosen = Date.parse(chosenAtIso);
  if (!m || !Number.isFinite(chosen)) return null;
  const shift = (Number(tzOffset) || 0) * 60_000;
  const local = new Date(chosen - shift);
  const h = (+m[1] % 12) + (m[3].toUpperCase() === "P" ? 12 : 0);
  const at = new Date(local);
  at.setUTCHours(h, +m[2], 0, 0);
  if (at.getTime() < local.getTime() - 30 * 60_000) at.setUTCDate(at.getUTCDate() + 1);
  return new Date(at.getTime() + shift).toISOString();
}

export function toCard(d, tzOffset) {
  const tags = d.tags || [];
  const lines = (d.lineItems && d.lineItems.nodes) || [];
  const bikini = lines.find((l) => attr(l.customAttributes, "Top")) || null;
  const image = bikini && attr(bikini.customAttributes, "_design_image");
  const mode = tags.includes("pickup") ? "pickup" : tags.includes("wait-and-watch") ? "wait" : null;
  const chosenAt = attr(d.customAttributes, "Chosen at") || d.createdAt;
  const pickupAt = mode === "pickup" ? attr(d.customAttributes, "Pickup time") : "";
  const name = attr(d.customAttributes, "Customer name") || (d.customer && d.customer.displayName) || d.email || "";
  return {
    id: d.id,
    number: d.name,
    customer: name,
    mode,
    paid: d.status === "COMPLETED",
    chosenAt,
    pickupAt,
    pickupDate: pickupAt ? (attr(d.customAttributes, "Pickup at") || pickupDate(chosenAt, pickupAt, tzOffset)) : null,
    minutes: +attr(d.customAttributes, "Estimated minutes") || null,
    // sewing time for the whole order (orders from before this existed: 5 min + ~3 per add-on)
    work: +attr(d.customAttributes, "Work minutes") || (5 + 3 * lines.filter((l) => /^Add[- ]on: /.test(l.title)).length),
    image: /^https:\/\//.test(image) ? image : null,
    top: bikini ? attr(bikini.customAttributes, "Top") : "",
    bottom: bikini ? attr(bikini.customAttributes, "Bottom") : "",
    addons: lines.filter((l) => /^Add[- ]on: /.test(l.title)).map((l) => l.title.replace(/^Add[- ]on: /, "")),
    extras: lines.filter((l) => l !== bikini && !/^Add[- ]on: /.test(l.title)).map((l) => (l.quantity > 1 ? l.quantity + " × " : "") + l.title),
    done: tags.includes(DONE_TAG),
    // a seamstress pressed "Start": who, and when
    sewingBy: attr(d.customAttributes, "Sewing by"),
    startedAt: attr(d.customAttributes, "Started at") || null,
    bikinis: bikinisOf(lines),
  };
}

// An order can hold several bikinis (the bag). Lines carry "Bikini: 2 of 3"; older orders have one.
function bikinisOf(lines) {
  const groups = new Map();
  for (const l of lines) {
    const k = attr(l.customAttributes, "Bikini") || "1";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(l);
  }
  return [...groups.values()].map((ls) => {
    const b = ls.find((l) => attr(l.customAttributes, "Top"));
    if (!b) return null;
    const img = attr(b.customAttributes, "_design_image");
    const adds = ls.filter((l) => /^Add[- ]on: /.test(l.title));
    return {
      top: attr(b.customAttributes, "Top"), bottom: attr(b.customAttributes, "Bottom"),
      // Spanish copies for the seamstress tag (orders placed before the tags existed fall back to English)
      topEs: attr(b.customAttributes, "_top_es"), bottomEs: attr(b.customAttributes, "_bottom_es"),
      image: /^https:\/\//.test(img) ? img : null,
      addons: adds.map((l) => l.title.replace(/^Add[- ]on: /, "")),
      addonsEs: adds.map((l) => attr(l.customAttributes, "_es")),
      // per piece (orders from before this existed only have the full add-on list above)
      short: attr(b.customAttributes, "_short"), shortEs: attr(b.customAttributes, "_short_es"),
      hasPieces: b.customAttributes.some((x) => x.key === "_top_custom"),
      topCustom: split(attr(b.customAttributes, "_top_custom")), topCustomEs: split(attr(b.customAttributes, "_top_custom_es")),
      bottomCustom: split(attr(b.customAttributes, "_bottom_custom")), bottomCustomEs: split(attr(b.customAttributes, "_bottom_custom_es")),
      extras: ls.filter((l) => l !== b && !/^Add[- ]on: /.test(l.title)).map((l) => ({ en: (l.quantity > 1 ? l.quantity + " × " : "") + l.title, es: attr(l.customAttributes, "_es") })),
    };
  }).filter(Boolean);
}

// Minutes of sewing already in the Wait & Watch line ahead of a new customer.
// Counts paid orders, plus unpaid ones chosen in the last 20 min (someone paying right now);
// older unpaid ones are probably abandoned and would make everyone's wait look too long.
export function lineAhead(drafts, excludeId) {
  const now = Date.now();
  return buildQueue(drafts).wait
    .filter((c) => c.id !== excludeId && (c.paid || now - (Date.parse(c.chosenAt) || 0) < 20 * 60_000))
    .reduce((n, c) => n + c.work, 0);
}
export const QUEUE_QUERY = `query($q:String!){ draftOrders(first:100, sortKey:CREATED_AT, reverse:true, query:$q){ nodes{
       id name createdAt status tags email
       customer{ displayName }
       customAttributes{ key value }
       lineItems(first:60){ nodes{ title quantity customAttributes{ key value } } } } } }`;
export const queueSince = () => "tag:peaces-builder AND created_at:>=" + new Date(Date.now() - 3 * 24 * 3600_000).toISOString().slice(0, 10);

/* ===================== the sewing schedule =====================
   Two seamstresses sew at the same time. Every time one of them is free, the next bikini is chosen like this:
     1. Already started → she keeps going (finishes at start + its sewing minutes).
     2. A pickup that would be LATE if she waited any longer (its pickup time − sewing time − 10 min buffer
        has arrived) → that pickup now, soonest pickup time first.
     3. Otherwise wait & watch, first come first served (the customer is standing there).
     4. Nobody waiting → get ahead on pickups, soonest pickup time first.
   Walking the line like this gives every order a start + ready time, which is
   what the customer is told and the order the seamstresses see. */
export const SEAMSTRESSES = 2;
export const PICKUP_BUFFER_MIN = 10;
// The pop-up: nothing is sewn before it opens (same times as POPUP in index.html)
export const POPUP_OPEN = Date.parse(process.env.POPUP_OPEN || "2026-11-05T10:00:00-05:00");

const ms = (min) => min * 60_000;
// who counts for the line: paid orders, plus unpaid ones chosen in the last 20 min (paying right now)
const inLine = (c, now) => c.paid || now - (Date.parse(c.chosenAt) || 0) < ms(20);

export function schedule(cards, now = Date.now(), lanes = SEAMSTRESSES) {
  const start0 = Math.max(now, POPUP_OPEN);
  const free = Array(lanes).fill(start0), who = Array(lanes).fill("");
  const out = [];
  // 1. in progress
  const going = cards.filter((c) => c.startedAt).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const used = Array(lanes).fill(false);
  going.forEach((c, i) => {
    let L = c.sewingBy ? who.indexOf(c.sewingBy) : -1;   // her own lane if she's already sewing one
    if (L < 0) L = used.indexOf(false);
    if (L < 0) L = i % lanes;
    if (!who[L]) who[L] = c.sewingBy || "";
    const begin = used[L] ? free[L] : Date.parse(c.startedAt);
    const end = Math.max(begin + ms(c.work), now + ms(1));             // running over? say "any minute"
    out.push({ ...c, state: "sewing", lane: L, startAt: c.startedAt, readyAt: new Date(end).toISOString() });
    free[L] = Math.max(end, start0); used[L] = true;
  });
  const t = (x) => Date.parse(x) || 0;
  const waits = cards.filter((c) => !c.startedAt && c.mode !== "pickup" && inLine(c, now)).sort((a, b) => t(a.chosenAt) - t(b.chosenAt));
  const picks = cards.filter((c) => !c.startedAt && c.mode === "pickup" && inLine(c, now)).sort((a, b) => t(a.pickupDate) - t(b.pickupDate));
  const latest = (c) => t(c.pickupDate) - ms(c.work + PICKUP_BUFFER_MIN);
  while (waits.length || picks.length) {
    let L = 0; for (let i = 1; i < lanes; i++) if (free[i] < free[L]) L = i;
    const at = free[L];
    let job;
    if (picks.length && latest(picks[0]) <= at) job = picks.shift();      // 2. a pickup about to be late
    else if (waits.length) job = waits.shift();                            // 3. wait & watch
    else job = picks.shift();                                              // 4. get ahead on pickups
    const end = at + ms(job.work);
    out.push({ ...job, state: "queued", lane: L, startAt: new Date(at).toISOString(), readyAt: new Date(end).toISOString(),
      late: job.mode === "pickup" && end > t(job.pickupDate) });
    free[L] = end;
  }
  return out;
}
// How long a NEW order would take (sewing minutes `work`), joining the line now as wait & watch.
export function waitFor(drafts, work, now = Date.now(), excludeId = null) {
  const cards = buildQueue(drafts).all.filter((c) => c.id !== excludeId);
  const me = { id: "new", mode: "wait", paid: true, chosenAt: new Date(now).toISOString(), work };
  const plan = schedule(cards.concat([me]), now);
  const mine = plan.find((c) => c.id === "new");
  return { readyAt: mine.readyAt, minutes: Math.max(1, Math.ceil((Date.parse(mine.readyAt) - now) / 60_000)), ahead: plan.filter((c) => c.id !== "new" && Date.parse(c.startAt) <= Date.parse(mine.startAt)).length };
}

// Paid orders where the customer never picked are treated as wait & watch, so nothing gets lost.
export function buildQueue(drafts, tzOffset = 0, now = Date.now()) {
  const cards = drafts.map((d) => toCard(d, tzOffset))
    .filter((c) => !c.done && (c.top || c.bottom) && (c.mode || c.paid));
  const t = (s) => Date.parse(s) || 0;
  const wait = cards.filter((c) => c.mode !== "pickup").sort((a, b) => t(a.chosenAt) - t(b.chosenAt));
  const pickup = cards.filter((c) => c.mode === "pickup")
    .sort((a, b) => t(a.pickupDate || a.chosenAt) - t(b.pickupDate || b.chosenAt));
  // the seamstresses' order: sewing now, then up next (from the schedule), then unpaid ones that went quiet
  const plan = schedule(cards, now);
  const planned = new Set(plan.map((c) => c.id));
  const sewing = plan.filter((c) => c.state === "sewing");
  const next = plan.filter((c) => c.state === "queued");
  const unpaid = cards.filter((c) => !planned.has(c.id));
  return { wait, pickup, sewing, next, unpaid, all: cards };
}
