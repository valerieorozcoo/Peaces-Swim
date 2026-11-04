import { route, HttpError } from "../../lib/http.js";
import { gql, check } from "../../lib/shopify.js";
import { checkPasscode } from "../../lib/queue.js";

// POST /api/seamstress/start  { passcode, id, sewer, start: true | false }
// A seamstress takes an order ("Sewing by" + "Started at" on the draft order), so the other one
// doesn't start the same bikini and the schedule knows it's in progress. start:false hands it back.
export default route(["POST"], async (body) => {
  checkPasscode(body.passcode);
  const id = String(body.id || "");
  if (!/^gid:\/\/shopify\/DraftOrder\/\d+$/.test(id)) throw new Error("Unknown order");
  const sewer = String(body.sewer || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 30);
  const start = body.start !== false;
  if (start && !sewer) throw new Error("Type your name first");
  const cur = await gql(`query($id:ID!){ draftOrder(id:$id){ customAttributes{ key value } } }`, { id });
  const attrs = ((cur.draftOrder && cur.draftOrder.customAttributes) || []);
  const taken = (attrs.find((a) => a.key === "Sewing by") || {}).value;
  if (start && taken && taken !== sewer && !body.force) throw new HttpError(409, taken + " is already sewing this one");
  const kept = attrs.filter((a) => a.key !== "Sewing by" && a.key !== "Started at");
  if (start) kept.push({ key: "Sewing by", value: sewer }, { key: "Started at", value: new Date().toISOString() });
  const data = await gql(
    `mutation($id:ID!,$input:DraftOrderInput!){ draftOrderUpdate(id:$id, input:$input){ draftOrder{ id } userErrors{ field message } } }`,
    { id, input: { customAttributes: kept } }
  );
  check(data.draftOrderUpdate, "draftOrderUpdate");
  return { ok: true, sewing: start ? sewer : null };
});
