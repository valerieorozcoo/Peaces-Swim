import { route } from "../../lib/http.js";
import { gql, check, toE164 } from "../../lib/shopify.js";
import { checkPasscode, DONE_TAG, cleanName } from "../../lib/queue.js";
import { readyMessage, sendSms, smsReady } from "../../lib/sms.js";
import { klaviyoReady, sendReadyEvent } from "../../lib/klaviyo.js";

export const TEXTED_TAG = "texted-ready";
const attr = (list, key) => ((list || []).find((a) => a.key === key) || {}).value || "";

// POST /api/seamstress/done  { passcode, id, sewer, done: true | false }
// Marks a builder order finished (tag `seamstress-done`) so it leaves the queue; done:false undoes it.
// When it's marked done the customer gets a "your Peace is ready" text (once): through Klaviyo when
// KLAVIYO_PRIVATE_KEY is set (a "Peace Ready" event → Klaviyo flow), or Twilio when that's set up instead;
// otherwise the page gets the number + message for a one-tap text from the seamstress's phone.
export default route(["POST"], async (body) => {
  checkPasscode(body.passcode);
  const id = String(body.id || "");
  if (!/^gid:\/\/shopify\/DraftOrder\/\d+$/.test(id)) throw new Error("Unknown order");
  const op = body.done === false ? "tagsRemove" : "tagsAdd";
  let doneTags = [DONE_TAG];
  if (op === "tagsAdd") { // when it was finished and by whom, for the Completed page
    const who = cleanName(body.sewer);
    doneTags.push("done-at:" + new Date().toISOString(), ...(who ? ["done-by:" + who] : []));
  } else {
    try {
      const cur = await gql(`query($id:ID!){ draftOrder(id:$id){ tags } }`, { id });
      doneTags = doneTags.concat(((cur.draftOrder && cur.draftOrder.tags) || []).filter((t) => /^done-(at|by):/.test(t)));
    } catch (e) { /* the done tag alone is enough to put it back */ }
  }
  const data = await gql(
    `mutation($id:ID!,$tags:[String!]!){ ${op}(id:$id, tags:$tags){ userErrors{ field message } } }`,
    { id, tags: doneTags }
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
  const mode = tags.includes("pickup") ? "pickup" : "wait", pickupAt = attr(a, "Pickup time");
  const message = readyMessage({ name, number: info.name, mode, pickupAt });
  if (!phone) return { ok: true, done: true, text: { sent: false, reason: "no-phone", name } };
  if (tags.includes(TEXTED_TAG)) return { ok: true, done: true, text: { sent: true, already: true, name, phone, message } };
  let r = { sent: false, reason: "failed" };
  try {
    if (klaviyoReady()) r = await sendReadyEvent({ id, phone, name, number: info.name, mode, pickupAt, message });
    else if (smsReady()) r = await sendSms(phone, message);
    else r = { sent: false, reason: "not-set-up" };
  } catch (e) { r = { sent: false, reason: "failed" }; }
  if (r.sent) { try { await gql(`mutation($id:ID!,$tags:[String!]!){ tagsAdd(id:$id, tags:$tags){ userErrors{ field message } } }`, { id, tags: [TEXTED_TAG] }); } catch (e) {} }
  return { ok: true, done: true, text: { ...r, name, phone, message } };
});
