import { route } from "../../lib/http.js";
import { toE164 } from "../../lib/shopify.js";
import { saveSignup } from "../../lib/signup.js";
import { welcomeToken } from "../../lib/sign.js";

// POST /api/customers/create  { name, email, phone, marketing }
// Website sign-up. Every sign-up becomes a Shopify customer tagged "peaces-builder" (a waitlist person
// keeps their "waitlist" tag too — see lib/signup.js). Email marketing only when they ticked the box.
// The welcome receipt authorizes the 10% only, never access to a Shopify account.
export default route(["POST"], async (body) => {
  const phone = toE164(body.phone);
  const name = String(body.name || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 80);
  const email = String(body.email || "").trim().slice(0, 120).toLowerCase();
  if (!phone) throw new Error("That phone number doesn't look right.");
  if (!name) throw new Error("Please add your name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That email doesn't look right.");

  const [firstName, ...rest] = name.split(/\s+/);
  const r = await saveSignup({
    firstName, lastName: rest.join(" ") || null, email, phone, tags: ["peaces-builder"], label: "Signed up on the website",
    note: "Signed up on the Peaces Swim website " + new Date().toISOString().slice(0, 10),
    emailConsent: body.marketing === true, smsConsent: false,
  });
  const out = { ok: true, existing: r.existing, firstName, welcomeToken: welcomeToken(phone) };
  return r.existing ? out : { status: 201, body: out };
});
