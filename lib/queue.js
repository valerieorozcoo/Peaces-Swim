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
    pickupDate: pickupAt ? pickupDate(chosenAt, pickupAt, tzOffset) : null,
    minutes: +attr(d.customAttributes, "Estimated minutes") || null,
    image: /^https:\/\//.test(image) ? image : null,
    top: bikini ? attr(bikini.customAttributes, "Top") : "",
    bottom: bikini ? attr(bikini.customAttributes, "Bottom") : "",
    addons: lines.filter((l) => /^Add-on: /.test(l.title)).map((l) => l.title.replace(/^Add-on: /, "")),
    extras: lines.filter((l) => l !== bikini && !/^Add-on: /.test(l.title)).map((l) => (l.quantity > 1 ? l.quantity + " × " : "") + l.title),
    done: tags.includes(DONE_TAG),
  };
}

// Paid orders where the customer never picked are treated as wait & watch, so nothing gets lost.
export function buildQueue(drafts, tzOffset = 0) {
  const cards = drafts.map((d) => toCard(d, tzOffset))
    .filter((c) => !c.done && (c.top || c.bottom) && (c.mode || c.paid));
  const t = (s) => Date.parse(s) || 0;
  const wait = cards.filter((c) => c.mode !== "pickup").sort((a, b) => t(a.chosenAt) - t(b.chosenAt));
  const pickup = cards.filter((c) => c.mode === "pickup")
    .sort((a, b) => t(a.pickupDate || a.chosenAt) - t(b.pickupDate || b.chosenAt));
  return { wait, pickup };
}
