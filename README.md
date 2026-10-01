# Peaces Swim Builder

Design-your-own bikini app for Peaces Swim — pick your peaces, design your dream.

- **Front end:** `index.html` + the art in `art/` and `art2/`
- **Backend:** small serverless functions in `api/` that talk to your **Shopify** store
- **Hosting:** [Vercel](https://vercel.com) (free tier is fine) — it reads this GitHub repo and deploys both parts

## What the backend does

| Screen in the app | Endpoint | What happens in Shopify |
|---|---|---|
| Phone number → "WELCOME VAL, we're so glad you're back" | `POST /api/customers/lookup` | Finds the customer by phone. Only their first name goes back to the app. |
| New here → name + email → SAVE 10% | `POST /api/customers/create` | Creates a customer tagged `peaces-builder`. Email marketing is only turned on if they tick the box. |
| CHECKOUT | `POST /api/orders/create` | Re-prices the design on the server, creates a **draft order** (tagged `peaces-builder`) with every add-on as its own line, applies 10% if the phone belongs to a customer, and opens Shopify checkout. |
| Wait & watch / Pick it up later | `POST /api/orders/fulfillment` | Adds `wait-and-watch` or `pickup` tags + the pickup time to that draft order. |
| — | `GET /api/health` | Shows whether the Shopify settings are filled in. |

Prices live in `lib/catalog.js`. If you change a price or an add-on in `index.html`, change it there too — the server's number is the one the customer pays.

If the backend is offline, the app still works: everyone is treated as new and CHECKOUT falls back to your Shopify account link with the design copied to the clipboard.

---

## 1. Put these files in your GitHub repo

Your repo has `index.html` already. Unzip this folder on your computer, then:

1. Open the repo on github.com → **Add file → Upload files**
2. Drag in **everything inside** the unzipped folder: `index.html`, `art`, `art2`, `api`, `lib`, `test`, `package.json`, `.gitignore`, `.env.example`, `README.md`
   (drag the folders themselves, so the paths stay `art2/hero.jpg`, `api/orders/create.js`, etc.)
3. Let it replace the old `index.html` → **Commit changes**

> On a Mac, files starting with a dot (`.gitignore`, `.env.example`) are hidden in Finder. Press **Cmd + Shift + .** to show them.

## 2. Make a Shopify app (gets the backend into your store)

Shopify stopped allowing new "custom apps" from the store admin on Jan 1, 2026 — new apps are made in the **Dev Dashboard**.

1. Shopify admin → **Settings → Apps → Develop apps** → **Build apps in Dev Dashboard**
2. **Create app** → name it `Peaces Swim Builder`
3. Under **Access / scopes**, select:
   - `read_customers`, `write_customers`
   - `read_draft_orders`, `write_draft_orders`
4. **Release** the version, then **Install** it on your Peaces Swim store
5. In the app's **Settings**, copy the **Client ID** and **Client secret**

The store and the app must be in the same Shopify organization (they will be if you made both).

## 3. Deploy on Vercel

1. Go to vercel.com → sign in with GitHub → **Add New → Project** → pick this repo → **Deploy**
2. Project → **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `SHOPIFY_STORE_DOMAIN` | `your-store.myshopify.com` (Shopify admin → Settings → Domains) |
| `SHOPIFY_CLIENT_ID` | from step 2 |
| `SHOPIFY_CLIENT_SECRET` | from step 2 |
| `ORDER_SIGNING_SECRET` | any long random string |

3. **Deployments → ⋯ → Redeploy** so the settings take effect
4. Visit `https://<your-project>.vercel.app/api/health` — you want `"shopDomainSet": true, "credentialsSet": true`

Never put the client secret in `index.html` or commit it to GitHub. It only lives in Vercel.

## 4. Try it

Open your Vercel link on your phone → enter a phone number → new customer → design → CHECKOUT.
In Shopify admin you should see the customer under **Customers** and the order under **Orders → Drafts**, both tagged `peaces-builder`.

## Running it on a computer (optional, for developers)

```bash
npm test                     # backend tests against a fake Shopify
node test/local-server.js    # app on http://localhost:3000 (add real env vars to hit your store)
```

## Still to decide

- Buttons price ($5) and button artwork are placeholders
- Wait-time formula: 12 min + 4 per add-on + 2 tote + 1 headband (`makeMinutes` in `index.html`)
- Pickup slots: next 8 × 15-minute slots, no limit per slot yet
- Taxes/shipping come from your Shopify settings; line items are marked "no shipping" (in-person pickup)
