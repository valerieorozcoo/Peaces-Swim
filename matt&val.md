# matt&val — Peaces Swim Builder: plan moving forward

_Last updated: October 1, 2026_

## Where we are

| | Status |
|---|---|
| App (index.html + art) | ✅ In this repo |
| Shopify backend (`api/`, `lib/`) | ✅ In this repo, 14/14 tests passing (`npm test`) |
| Setup guide | ✅ [README.md](README.md) |
| Shopify app connected | ⬜ Not yet |
| Live on Vercel | ⬜ Not yet |
| New interface design | ⬜ 11 directions mocked up, choice pending |

---

## Step 1: Connect Shopify (~10 min)

Done on shopify.com. Full steps are in the README, section 2.

- [ ] Shopify admin → **Settings → Apps → Develop apps → Build apps in Dev Dashboard** → **Create app** called "Peaces Swim Builder"
- [ ] Give it these permissions: `read_customers`, `write_customers`, `read_draft_orders`, `write_draft_orders`
- [ ] **Release** the version, then **Install** it on the store
- [ ] Copy the **Client ID**, **Client secret** and the `xxxx.myshopify.com` address. The secret only goes into Vercel; never paste it in chat or commit it.

## Step 2: Put it online with Vercel (~10 min)

Full steps are in the README, section 3.

- [ ] vercel.com → sign in with GitHub → **Add New → Project** → **Peaces-Swim** → Deploy
- [ ] **Settings → Environment Variables**: add `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `ORDER_SIGNING_SECRET` (any long random string)
- [ ] **Redeploy**

After this, every merge into `main` goes live automatically, and every pull request gets its own preview link.

## Step 3: Test it end to end

- [ ] Open `https://<project>.vercel.app/api/health` and check it shows `shopDomainSet: true, credentialsSet: true`
- [ ] On a phone: new number → name + email → design → **CHECKOUT** → Shopify checkout opens
- [ ] In Shopify admin, the customer shows under **Customers** and the order under **Orders → Drafts**, both tagged `peaces-builder`, with the pickup time on the draft
- [ ] Enter the same phone number again → the app says "WELCOME" with the first name
- [ ] Delete the test order from Drafts

If something fails, send Claude the `/api/health` output or Vercel's **Logs** tab and it gets fixed through a pull request.

## Step 4: Pick the new look

There are 11 clickable directions in the "Peaces UI Directions" mockup page:

| # | Direction | Idea |
|---|---|---|
| 00 | **Atelier (recommended)** | Our pink, script and sharp edges, made premium: ticket number, pins on the bikini, price tiers, sticky total |
| 01 | Formula | Function of Beauty–style vibe quiz that builds a personalised label |
| 02 | Colour Block | Triangl-style: the whole page turns the fabric colour |
| 03 | Sun Club | Frankies-style: lowercase, sun-faded, add-ons sold like products |
| 04 | Peaces OS | Y2K computer desktop |
| 05 | Group Chat | Design by tapping replies in a text thread |
| 06 | The Ticket | The builder is a receipt that prints as you tap |
| 07 | Fitting Lab | High-tech screen with labels pointing to each spot on the bikini |
| 08 | Grid | Swiss magazine layout with a huge live price |
| 09 | Moodboard | Scrapbook: polaroid, sticky notes, marker circles |
| 10 | Player Select | Video-game select screen with stats |

**Recommendation:** build 00 Atelier now, add the zone labels from 07, and consider the vibe quiz from 01 as the first screen for new customers.

- [ ] Choose a direction (or mix)
- [ ] Claude builds it as a pull request with a preview link
- [ ] Review it on a phone → merge → live

## Decisions we still need to make

- [ ] **"Order confirmed" timing:** it currently shows when CHECKOUT is tapped, before payment. Keep it for in-person payment, or move it to after payment?
- [ ] **Buttons:** confirm the $5 price and supply the real button artwork
- [ ] **Wait time:** confirm the formula (12 min + 4 per add-on + 2 for the tote + 1 for the headband)
- [ ] **Pickup slots:** set a maximum number of orders per 15-minute slot
- [ ] **Headband:** replace the photo crop with a proper product image
- [ ] **GitHub access:** switch to a token that only covers this repo

## How we work on this from now on

1. Ask Claude for a change.
2. Claude makes a branch, edits, runs the tests, pushes and opens a pull request.
3. Vercel posts a preview link on the pull request.
4. Check it on a phone.
5. Say "merge". It's live in about a minute.
