import { route } from "../../lib/http.js";
import { gql } from "../../lib/shopify.js";
import { priceDesign } from "../../lib/catalog.js";
import { lineAhead, QUEUE_QUERY, queueSince } from "../../lib/queue.js";

// POST /api/orders/estimate  { designs: [design…] }  →  { minutes, ahead }
// Before checkout: how long the bag takes to sew, and how much sewing is already in line,
// so the wait & watch / pickup choice can come before the customer pays.
export default route(["POST"], async (body) => {
  const designs = Array.isArray(body.designs) ? body.designs.slice(0, 5) : [];
  if (!designs.length) throw new Error("Missing design");
  const minutes = designs.map((d) => priceDesign(d)).reduce((s, o) => s + o.minutes, 0);
  let ahead = 0;
  try { ahead = lineAhead((await gql(QUEUE_QUERY, { q: queueSince() })).draftOrders.nodes || []); } catch (e) { ahead = 0; }
  return { minutes, ahead };
});
