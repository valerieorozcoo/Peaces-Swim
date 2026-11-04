import { route } from "../../lib/http.js";
import { gql, check } from "../../lib/shopify.js";
import { verify } from "../../lib/sign.js";
import { lineAhead, QUEUE_QUERY, queueSince } from "../../lib/queue.js";

// POST /api/orders/fulfillment  { id, sig, mode: "wait" | "pickup", pickupAt }
// Records the customer's choice on the draft order as tags + attributes the team can see in Shopify.
export default route(["POST"], async (body) => {
  const id = String(body.id || "");
  if (!/^gid:\/\/shopify\/DraftOrder\/\d+$/.test(id) || !verify(id, body.sig)) throw new Error("Unknown order");
  const mode = body.mode === "pickup" ? "pickup" : body.mode === "wait" ? "wait" : null;
  if (!mode) throw new Error("Choose wait & watch or pick up later");
  const pickupAt = String(body.pickupAt || "").replace(/[^0-9:APM ]/gi, "").slice(0, 12);
  if (mode === "pickup" && !pickupAt) throw new Error("Choose a pickup time");
  let minutes = Math.max(0, Math.min(600, parseInt(body.minutes, 10) || 0));

  // Keep what checkout already put on the order (e.g. the customer's name for the seamstresses)
  // and replace only the fulfilment details, so changing your mind doesn't leave stale ones.
  const current = await gql(`query($id:ID!){ draftOrder(id:$id){ customAttributes{ key value } } }`, { id });
  const OURS = ["Source", "Fulfilment", "Pickup time", "Estimated minutes", "Chosen at"];
  const kept = ((current.draftOrder && current.draftOrder.customAttributes) || []).filter((a) => !OURS.includes(a.key));
  // Wait & watch: her own sewing time + everything already in line ahead of her (the server knows the line)
  if (mode === "wait") {
    const own = +((kept.find((a) => a.key === "Work minutes") || {}).value) || minutes || 5;
    let ahead = 0;
    try { ahead = lineAhead((await gql(QUEUE_QUERY, { q: queueSince() })).draftOrders.nodes || [], id); } catch (e) { ahead = 0; }
    minutes = Math.min(600, own + ahead);
  }
  const attrs = [
    ...kept,
    { key: "Source", value: "Peaces Swim Builder" },
    { key: "Fulfilment", value: mode === "wait" ? "Wait & watch" : "Pick up later" },
  ];
  if (mode === "pickup") attrs.push({ key: "Pickup time", value: pickupAt });
  if (minutes) attrs.push({ key: "Estimated minutes", value: String(minutes) });
  attrs.push({ key: "Chosen at", value: new Date().toISOString() }); // first come, first served on the seamstress page

  const tags = ["peaces-builder", mode === "wait" ? "wait-and-watch" : "pickup"];
  const data = await gql(
    `mutation($id:ID!,$input:DraftOrderInput!){ draftOrderUpdate(id:$id, input:$input){
       draftOrder{ id } userErrors{ field message } } }`,
    { id, input: { customAttributes: attrs, tags } }
  );
  check(data.draftOrderUpdate, "draftOrderUpdate");
  return { ok: true, minutes };
});
