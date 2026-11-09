import { route } from "../../lib/http.js";
import { saveDesignImage } from "../../lib/design-image.js";

// POST /api/orders/picture  { image: dataUrl }  →  { url }
// The builder uploads the bikini picture early (while the customer looks at "Anything else?"),
// so checkout doesn't have to wait for Shopify to process it. Returns url:null if it couldn't.
export default route(["POST"], async (body) => {
  const url = await saveDesignImage(body.image, "Peaces Swim custom design");
  return { url: url || null };
});
