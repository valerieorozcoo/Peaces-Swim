import { route } from "../../lib/http.js";
import { gql } from "../../lib/shopify.js";
import { checkPasscode, buildQueue, QUEUE_QUERY, queueSince } from "../../lib/queue.js";

// POST /api/seamstress/queue  { passcode, tzOffset }
// → { wait: [card…], pickup: [card…] } for the private seamstress page (/seamstress).
// Looks at builder orders from the last 3 days that aren't marked done yet.
export default route(["POST"], async (body) => {
  checkPasscode(body.passcode);
  const data = await gql(QUEUE_QUERY, { q: queueSince() });
  return buildQueue(data.draftOrders.nodes || [], body.tzOffset);
});
