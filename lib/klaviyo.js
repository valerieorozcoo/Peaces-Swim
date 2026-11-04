// "Your Peace is ready" through Klaviyo: the website records a "Peace Ready" event on the customer's
// Klaviyo profile (phone number + order details); a Klaviyo flow triggered by that event sends the text.
// Needs KLAVIYO_PRIVATE_KEY in Vercel (a private API key with Events: write access).
export const READY_METRIC = "Peace Ready";

export function klaviyoReady() { return !!process.env.KLAVIYO_PRIVATE_KEY; }

export async function sendReadyEvent({ id, phone, name, number, mode, pickupAt, message }) {
  if (!klaviyoReady()) return { sent: false, reason: "not-set-up" };
  if (!/^\+\d{8,15}$/.test(String(phone || ""))) return { sent: false, reason: "no-phone" };
  const first = String(name || "").trim().split(/\s+/)[0] || undefined;
  const body = { data: { type: "event", attributes: {
    unique_id: String(id) + "#ready",                       // Klaviyo ignores repeats, so one text per order
    properties: { order: number, mode, pickup_time: pickupAt || "", message, first_name: first || "" },
    metric: { data: { type: "metric", attributes: { name: READY_METRIC } } },
    profile: { data: { type: "profile", attributes: { phone_number: phone, ...(first && { first_name: first }) } } },
  } } };
  const res = await fetch("https://a.klaviyo.com/api/events", {
    method: "POST",
    headers: { Authorization: "Klaviyo-API-Key " + process.env.KLAVIYO_PRIVATE_KEY, revision: "2024-10-15",
      "Content-Type": "application/vnd.api+json", Accept: "application/vnd.api+json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const j = await res.json().catch(() => ({})); console.warn("[klaviyo] event failed", res.status, JSON.stringify(j.errors || "").slice(0, 300)); return { sent: false, reason: "failed" }; }
  return { sent: true, via: "klaviyo" };
}
