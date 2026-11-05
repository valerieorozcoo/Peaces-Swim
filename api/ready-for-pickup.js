// api/ready-for-pickup.js
// Vercel serverless function: sends a "Ready For Pickup" event to Klaviyo,
// which triggers your Klaviyo SMS flow.
//
// WHERE TO PUT THIS FILE
//   - Plain Vercel project (Vite/React/HTML):  /api/ready-for-pickup.js
//   - Next.js "pages" router:                  /pages/api/ready-for-pickup.js
//   - Next.js "app" router: see the note at the bottom of this file.
//
// ENVIRONMENT VARIABLES (Vercel → Project → Settings → Environment Variables)
//   KLAVIYO_PRIVATE_KEY  = your Klaviyo private API key (starts with pk_)
//                          Needs "Events: Write" and "Profiles: Write" access.
//   ADMIN_SECRET         = any long random password you make up; your
//                          admin page sends it so strangers can't trigger texts.

const KLAVIYO_URL = "https://a.klaviyo.com/api/events";
const KLAVIYO_REVISION = "2024-10-15";
const EVENT_NAME = "Ready For Pickup"; // must match the metric your Klaviyo flow uses

// Klaviyo requires phone numbers in +1XXXXXXXXXX format
function toE164(phone) {
  if (!phone) return undefined;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (String(phone).startsWith("+")) return `+${digits}`;
  return undefined;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Simple protection so only your team can fire this
  // (if ADMIN_SECRET isn't set in Vercel, nobody gets in: otherwise a missing key would match a missing secret)
  if (!process.env.ADMIN_SECRET || req.headers["x-admin-key"] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const { orderId, orderNumber, email, phone, firstName, items } = body;

  const phoneNumber = toE164(phone);
  if (!email && !phoneNumber) {
    return res.status(400).json({ error: "Need an email or a valid phone number" });
  }

  const profileAttributes = {};
  if (email) profileAttributes.email = email;
  if (phoneNumber) profileAttributes.phone_number = phoneNumber;
  if (firstName) profileAttributes.first_name = firstName;

  const payload = {
    data: {
      type: "event",
      attributes: {
        properties: {
          order_number: orderNumber || orderId || "",
          items: items || [],
        },
        metric: {
          data: { type: "metric", attributes: { name: EVENT_NAME } },
        },
        profile: {
          data: { type: "profile", attributes: profileAttributes },
        },
        // Prevents a double-click from sending two texts for the same order
        unique_id: `ready-for-pickup-${orderId || orderNumber || Date.now()}`,
      },
    },
  };

  try {
    const kRes = await fetch(KLAVIYO_URL, {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_PRIVATE_KEY}`,
        revision: KLAVIYO_REVISION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (kRes.status === 202) {
      return res.status(200).json({ ok: true });
    }

    const errText = await kRes.text();
    console.error("Klaviyo error:", kRes.status, errText);
    return res.status(502).json({ error: "Klaviyo rejected the event", details: errText });
  } catch (err) {
    console.error("Request failed:", err);
    return res.status(500).json({ error: "Could not reach Klaviyo" });
  }
}

/* ---------------------------------------------------------------------------
NEXT.JS APP ROUTER VERSION
Put this at /app/api/ready-for-pickup/route.js instead. Keep toE164 and the
payload-building code above, then swap the handler for:

export async function POST(request) {
  if (request.headers.get("x-admin-key") !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  // ...build `payload` exactly as above, then fetch(KLAVIYO_URL, ...)
  // return Response.json({ ok: true });
}
--------------------------------------------------------------------------- */
