import { route } from "../../lib/http.js";
import { gql } from "../../lib/shopify.js";
import { priceDesign } from "../../lib/catalog.js";
import { waitFor, QUEUE_QUERY, queueSince } from "../../lib/queue.js";

// POST /api/orders/estimate  { designs: [design…] }  →  { minutes, wait, readyAt, ahead }
// Before checkout: how long the bag takes to sew (minutes), and from the sewing schedule (2 seamstresses,
// wait & watch first, pickups when they're due) when it would be ready if they wait & watch.
export default route(["POST"], async (body) => {
  const designs = Array.isArray(body.designs) ? body.designs.slice(0, 5) : [];
  if (!designs.length) throw new Error("Missing design");
  const minutes = designs.map((d) => priceDesign(d)).reduce((s, o) => s + o.minutes, 0);
  let plan = null;
  try { plan = waitFor((await gql(QUEUE_QUERY, { q: queueSince() })).draftOrders.nodes || [], minutes); } catch (e) { plan = null; }
  return plan ? { minutes, wait: plan.minutes, readyAt: plan.readyAt, ahead: plan.ahead } : { minutes, wait: null, readyAt: null, ahead: 0 };
});
