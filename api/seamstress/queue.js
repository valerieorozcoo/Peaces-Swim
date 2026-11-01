import { route } from "../../lib/http.js";
import { gql } from "../../lib/shopify.js";
import { checkPasscode, buildQueue } from "../../lib/queue.js";

// POST /api/seamstress/queue  { passcode, tzOffset }
// → { wait: [card…], pickup: [card…] } for the private seamstress page (/seamstress).
// Looks at builder orders from the last 3 days that aren't marked done yet.
export default route(["POST"], async (body) => {
  checkPasscode(body.passcode);
  const since = new Date(Date.now() - 3 * 24 * 3600_000).toISOString().slice(0, 10);
  const data = await gql(
    `query($q:String!){ draftOrders(first:100, sortKey:CREATED_AT, reverse:true, query:$q){ nodes{
       id name createdAt status tags email
       customer{ displayName }
       customAttributes{ key value }
       lineItems(first:60){ nodes{ title quantity customAttributes{ key value } } } } } }`,
    { q: "tag:peaces-builder AND created_at:>=" + since }
  );
  return buildQueue(data.draftOrders.nodes || [], body.tzOffset);
});
