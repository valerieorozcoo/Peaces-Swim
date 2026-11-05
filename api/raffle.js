import { route } from "../lib/http.js";
import { toE164 } from "../lib/shopify.js";
import { saveSignup } from "../lib/signup.js";

const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);

// POST /api/raffle  { firstName, email, phone, sms }
// Raffle entry for a free customized Peaces bikini. Saved as a Shopify customer tagged "raffle-entry"
// (same customer list as everyone else; filter by that tag). Agreeing to texts is required to enter,
// and the form says they'll get emails, so entrants are subscribed to both. See lib/signup.js.
export default route(["POST"], async (body) => {
  if (body.company) return { ok: true }; // hidden spam-bot field — pretend it worked, save nothing

  const firstName = clean(body.firstName, 60);
  const email = clean(body.email, 120).toLowerCase();
  const phone = toE164(body.phone);
  if (!firstName) throw new Error("Please add your first name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That email doesn't look right.");
  if (!phone) throw new Error("That phone number doesn't look right.");
  if (body.sms !== true) throw new Error("Please check the box to agree to texts from Peaces to enter.");

  const r = await saveSignup({
    firstName, email, phone, tags: ["raffle-entry"], label: "Entered the raffle",
    note: "Entered the Peaces Swim raffle " + new Date().toISOString().slice(0, 10),
    emailConsent: true, smsConsent: true,
  });
  return r.existing ? { ok: true, existing: true } : { status: 201, body: { ok: true, existing: false } };
});
