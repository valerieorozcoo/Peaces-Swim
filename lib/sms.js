// Texting customers when their bikini is ready.
// Sends through Twilio when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM are set in Vercel;
// otherwise nothing is sent here and the seamstress page offers a one-tap "Text her" button instead.
export function smsReady() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

export function readyMessage({ name, number, mode, pickupAt }) {
  const first = String(name || "").trim().split(/\s+/)[0];
  const hi = first ? "Hi " + first + "! " : "Hi! ";
  return mode === "pickup"
    ? hi + "Your Peace (order " + number + ") is ready" + (pickupAt ? " for pickup at " + pickupAt : "") + ". See you soon! - Peaces Swim"
    : hi + "Your Peace (order " + number + ") is ready! Come grab it at the Peaces Swim pop-up. - Peaces Swim";
}

export async function sendSms(to, body) {
  if (!smsReady()) return { sent: false, reason: "not-set-up" };
  if (!/^\+\d{8,15}$/.test(String(to || ""))) return { sent: false, reason: "no-phone" };
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const res = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + encodeURIComponent(sid) + "/Messages.json", {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(sid + ":" + process.env.TWILIO_AUTH_TOKEN).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM, Body: body }).toString(),
  });
  if (!res.ok) { const j = await res.json().catch(() => ({})); console.warn("[sms] Twilio said", res.status, j.message || ""); return { sent: false, reason: "failed" }; }
  return { sent: true };
}
