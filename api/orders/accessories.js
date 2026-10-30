import { route } from "../../lib/http.js";
import { gql, check } from "../../lib/shopify.js";
import { priceAccessories } from "../../lib/catalog.js";

const CURRENCY = process.env.SHOP_CURRENCY || "USD";
const money = (n) => ({ amount: n.toFixed(2), currencyCode: CURRENCY });

// POST /api/orders/accessories  { items: { headband:{color,qty}, tote:{color,qty} } }
// The headband and tote on their own, no bikini. Priced on the server, then a
// Shopify draft order whose checkout link (invoiceUrl) goes back to the browser.
export default route(["POST"], async (body) => {
  const order = priceAccessories(body.items);
  const input = {
    tags: ["peaces-accessories"],
    note: "Peaces Accessories (no bikini)",
    customAttributes: [{ key: "Source", value: "Peaces Accessories page" }],
    lineItems: order.lines.map((l) => ({
      title: l.title, quantity: l.quantity, originalUnitPriceWithCurrency: money(l.price),
      requiresShipping: false, taxable: true,
    })),
  };
  const data = await gql(
    `mutation($input:DraftOrderInput!){ draftOrderCreate(input:$input){
       draftOrder{ id name invoiceUrl totalPriceSet{ shopMoney{ amount } } }
       userErrors{ field message } } }`,
    { input }
  );
  const d = check(data.draftOrderCreate, "draftOrderCreate").draftOrder;
  return { status: 201, body: { name: d.name, checkoutUrl: d.invoiceUrl, subtotal: order.subtotal,
    total: d.totalPriceSet ? +d.totalPriceSet.shopMoney.amount : order.subtotal } };
});
