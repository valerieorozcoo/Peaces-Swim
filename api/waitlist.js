import { route } from "../lib/http.js";
import { toE164 } from "../lib/shopify.js";
import { saveSignup } from "../lib/signup.js";
import { welcomeToken } from "../lib/sign.js";

const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);

// POST /api/waitlist  { firstName, email, phone, sms }
// Every signup becomes a Shopify customer tagged "waitlist" (see lib/signup.js — people already in
// Shopify are never duplicated or turned away). The form says joining means launch emails, so they're
// subscribed to email; texts only when they ticked the SMS box. Returns a welcome receipt so the
// website remembers them (and their 10% off) when the full site opens.
export default route(["POST"], async (body) => {
  if (body.company) return { ok: true }; // hidden spam-bot field — pretend it worked, save nothing

  const firstName = clean(body.firstName, 60);
  const email = clean(body.email, 120).toLowerCase();
  const phone = toE164(body.phone);
  if (!firstName) throw new Error("Please add your first name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That email doesn't look right.");
  if (!phone) throw new Error("That phone number doesn't look right.");

  const r = await saveSignup({
    firstName, email, phone, tags: ["waitlist"], label: "Joined the waitlist",
    note: "Joined the Peaces Swim waitlist " + new Date().toISOString().slice(0, 10),
    emailConsent: true, smsConsent: body.sms === true,
  });
  const out = { ok: true, existing: r.existing, firstName, welcomeToken: welcomeToken(phone) };
  return r.existing ? out : { status: 201, body: out };
});
