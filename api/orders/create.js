import { route } from "../../lib/http.js";
import { gql, check, toE164, findCustomerByPhone } from "../../lib/shopify.js";
import { priceDesign, DISCOUNT_PERCENT } from "../../lib/catalog.js";
import { sign } from "../../lib/sign.js";

const CURRENCY = process.env.SHOP_CURRENCY || "USD";
const money = (n) => ({ amount: n.toFixed(2), currencyCode: CURRENCY });

// POST /api/orders/create  { design, customer: { phone, name, email } }
// Prices the design on the server, creates a Shopify draft order and returns its
// checkout link (invoiceUrl). The 10% only applies if the phone belongs to a
// Shopify customer — the browser can't just ask for it.
export default route(["POST"], async (body) => {
  const order = priceDesign(body.design);
  const cust = body.customer || {};
  const phone = toE164(cust.phone);
  const shopper = phone ? await findCustomerByPhone(phone) : null;

  const input = {
    tags: ["peaces-builder"],
    note: "Made in the Peaces Swim Builder",
    customAttributes: [{ key: "Source", value: "Peaces Swim Builder" }],
    lineItems: order.lines.map((l) => ({
      title: l.title,
      quantity: 1,
      originalUnitPriceWithCurrency: money(l.price),
      requiresShipping: false,
      taxable: true,
      customAttributes: Object.entries(l.attrs).map(([key, value]) => ({ key, value })),
    })),
  };
  if (shopper) {
    input.purchasingEntity = { customerId: shopper.id };
    input.appliedDiscount = { valueType: "PERCENTAGE", value: DISCOUNT_PERCENT, title: "Peaces " + DISCOUNT_PERCENT + "% welcome" };
  }

  const data = await gql(
    `mutation($input:DraftOrderInput!){ draftOrderCreate(input:$input){
       draftOrder{ id name invoiceUrl subtotalPriceSet{ shopMoney{ amount } } totalPriceSet{ shopMoney{ amount } } }
       userErrors{ field message } } }`,
    { input }
  );
  const d = check(data.draftOrderCreate, "draftOrderCreate").draftOrder;
  const expected = shopper ? order.subtotal * (1 - DISCOUNT_PERCENT / 100) : order.subtotal;
  return {
    status: 201,
    body: {
      id: d.id,
      sig: sign(d.id),
      name: d.name,
      checkoutUrl: d.invoiceUrl,
      subtotal: order.subtotal,
      discounted: !!shopper,
      total: d.totalPriceSet ? +d.totalPriceSet.shopMoney.amount : +expected.toFixed(2),
    },
  };
});
