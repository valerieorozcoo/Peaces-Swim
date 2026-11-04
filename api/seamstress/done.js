import { route } from "../../lib/http.js";
import { gql, check, toE164 } from "../../lib/shopify.js";
import { checkPasscode, DONE_TAG } from "../../lib/queue.js";
import { readyMessage, sendSms } from "../../lib/sms.js";

export const TEXTED_TAG = "texted-ready";
const attr = (list, key) => ((list || []).find((a) => a.key === key) || {}).value || "";

// POST /api/seamstress/done  { passcode, id, done: true | false }
// Marks a builder order finished (tag `seamstress-done`) so it leaves the queue; done:false undoes it.
// When it's marked done the customer gets a "your Peace is ready" text (once): sent automatically if
// Twilio is set up, otherwise the page gets the number + message for a one-tap text from the seamstress's phone.
export default route(["POST"], async (body) => {
  checkPasscode(body.passcode);
  const id = String(body.id || "");
  if (!/^gid:\/\/shopify\/DraftOrder\/\d+$/.test(id)) throw new Error("Unknown order");
  const op = body.done === false ? "tagsRemove" : "tagsAdd";
  const data = await gql(
    `mutation($id:ID!,$tags:[String!]!){ ${op}(id:$id, tags:$tags){ userErrors{ field message } } }`,
    { id, tags: [DONE_TAG] }
  );
  check(data[op], op);
  if (op === "tagsRemove") return { ok: true, done: false };

  // who to text: the number from the builder sign-up, else the phone Shopify has for the order
  let info = null;
  try {
    const q = await gql(`query($id:ID!){ draftOrder(id:$id){ name tags phone customAttributes{ key value } customer{ displayName } } }`, { id });
    info = q.draftOrder;
  } catch (e) {
    try { info = (await gql(`query($id:ID!){ draftOrder(id:$id){ name tags customAttributes{ key value } } }`, { id })).draftOrder; } catch (e2) { info = null; }
  }
  if (!info) return { ok: true, done: true, text: null };
  const a = info.customAttributes || [];
  const phone = toE164(attr(a, "Text when ready") || info.phone || "") || "";
  const name = attr(a, "Customer name") || (info.customer && info.customer.displayName) || "";
  const tags = info.tags || [];
  const message = readyMessage({ name, number: info.name, mode: tags.includes("pickup") ? "pickup" : "wait", pickupAt: attr(a, "Pickup time") });
  if (!phone) return { ok: true, done: true, text: { sent: false, reason: "no-phone", name } };
  if (tags.includes(TEXTED_TAG)) return { ok: true, done: true, text: { sent: true, already: true, name, phone, message } };
  let r = { sent: false, reason: "failed" };
  try { r = await sendSms(phone, message); } catch (e) { r = { sent: false, reason: "failed" }; }
  if (r.sent) { try { await gql(`mutation($id:ID!,$tags:[String!]!){ tagsAdd(id:$id, tags:$tags){ userErrors{ field message } } }`, { id, tags: [TEXTED_TAG] }); } catch (e) {} }
  return { ok: true, done: true, text: { ...r, name, phone, message } };
});
