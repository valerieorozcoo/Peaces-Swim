import { route, HttpError } from "../../lib/http.js";
import { gql, check, toE164 } from "../../lib/shopify.js";
import { priceDesign, DISCOUNT_PERCENT } from "../../lib/catalog.js";
import { sign, verifyWelcomeToken } from "../../lib/sign.js";
import { saveDesignImage } from "../../lib/design-image.js";

const CURRENCY = process.env.SHOP_CURRENCY || "USD";
const money = (n) => ({ amount: n.toFixed(2), currencyCode: CURRENCY });

// POST /api/orders/create  { design, customer: { phone, name, email } }
// Prices the design on the server, creates a Shopify draft order and returns its
// checkout link (invoiceUrl). Checkout stays a guest flow; a signed signup
// receipt authorizes only the welcome discount, never customer-account access.
export default route(["POST"], async (body) => {
  const order = priceDesign(body.design);
  const cust = body.customer || {};
  const phone = toE164(cust.phone);
  const discounted = verifyWelcomeToken(cust.welcomeToken, phone);
  if (cust.welcomeToken && !discounted) throw new HttpError(409, "Your welcome discount expired. Please enter your contact details again before checking out.");

  const input = {
    tags: ["peaces-builder"],
    allowDiscountCodesInCheckout: true, // lets customers type Shopify discount codes (e.g. PEACESPARTY) at checkout
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
  // The picture of the built bikini rides on the bikini line as `_design_image`
  // (hidden from the checkout, available to the receipt email as line.properties).
  const imageUrl = await saveDesignImage(body.image, order.lines[0].title);
  if (imageUrl) {
    input.lineItems[0].customAttributes.push({ key: "_design_image", value: imageUrl });
    input.note += "\nDesign picture: " + imageUrl;
  }
  if (discounted) {
    input.appliedDiscount = { valueType: "PERCENTAGE", value: DISCOUNT_PERCENT, title: "Peaces " + DISCOUNT_PERCENT + "% welcome" };
  }

  const data = await gql(
    `mutation($input:DraftOrderInput!){ draftOrderCreate(input:$input){
       draftOrder{ id name invoiceUrl subtotalPriceSet{ shopMoney{ amount } } totalPriceSet{ shopMoney{ amount } } }
       userErrors{ field message } } }`,
    { input }
  );
  const d = check(data.draftOrderCreate, "draftOrderCreate").draftOrder;
  const expected = discounted ? order.subtotal * (1 - DISCOUNT_PERCENT / 100) : order.subtotal;
  return {
    status: 201,
    body: {
      id: d.id,
      sig: sign(d.id),
      name: d.name,
      checkoutUrl: d.invoiceUrl,
      subtotal: order.subtotal,
      discounted,
      image: imageUrl || null,
      total: d.totalPriceSet ? +d.totalPriceSet.shopMoney.amount : +expected.toFixed(2),
    },
  };
});

