import { route } from "../../lib/http.js";
import { gql, check } from "../../lib/shopify.js";
import { checkPasscode, DONE_TAG } from "../../lib/queue.js";

// POST /api/seamstress/done  { passcode, id, done: true | false }
// Marks a builder order finished (tag `seamstress-done`) so it leaves the queue; done:false undoes it.
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
  return { ok: true, done: op === "tagsAdd" };
});
