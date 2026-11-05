import { route, HttpError } from "../../lib/http.js";
import { gql, check } from "../../lib/shopify.js";
import { checkPasscode, tagVal, cleanName } from "../../lib/queue.js";

// POST /api/seamstress/start  { passcode, id, sewer, start: true | false }
// A seamstress takes an order (tags sewing-by:<name> + started-at:<time> on the draft order), so the other
// one doesn't start the same bikini and the schedule knows it's in progress. start:false hands it back.
// Tags are used (not order notes) because Shopify won't let a paid order's details be edited.
export default route(["POST"], async (body) => {
  checkPasscode(body.passcode);
  const id = String(body.id || "");
  if (!/^gid:\/\/shopify\/DraftOrder\/\d+$/.test(id)) throw new Error("Unknown order");
  const sewer = cleanName(body.sewer);
  const start = body.start !== false;
  if (start && !sewer) throw new Error("Type your name first");
  const cur = await gql(`query($id:ID!){ draftOrder(id:$id){ tags customAttributes{ key value } } }`, { id });
  const d = cur.draftOrder || {};
  const tags = d.tags || [];
  const taken = tagVal(tags, "sewing-by:") || ((d.customAttributes || []).find((a) => a.key === "Sewing by") || {}).value;
  if (start && taken && taken !== sewer && !body.force) throw new HttpError(409, taken + " is already sewing this one");
  const old = tags.filter((t) => /^(sewing-by|started-at):/.test(t));
  if (old.length) {
    const r = await gql(`mutation($id:ID!,$tags:[String!]!){ tagsRemove(id:$id, tags:$tags){ userErrors{ field message } } }`, { id, tags: old });
    check(r.tagsRemove, "tagsRemove");
  }
  if (start) {
    const r = await gql(`mutation($id:ID!,$tags:[String!]!){ tagsAdd(id:$id, tags:$tags){ userErrors{ field message } } }`,
      { id, tags: ["sewing-by:" + sewer, "started-at:" + new Date().toISOString()] });
    check(r.tagsAdd, "tagsAdd");
  }
  return { ok: true, sewing: start ? sewer : null };
});
