# listyourcar.ca

**Canada's two-sided car marketplace — list your car to sell it, rent it, or both.**

This repo is a functional **Phase 1 prototype**. It's a static front end (HTML/CSS/vanilla JS)
with **`localStorage` standing in for a backend**, so the full dual-intent flow works end-to-end
in the browser: create a listing, see it in browse/detail pages, receive inquiries and booking
requests, and manage them in a unified dashboard inbox.

## What's implemented (Phase 1)

| Strategy item | Where |
|---|---|
| Single-listing, **dual-intent** model (sell / rent / both) | `list.html` + `js/app.js → pageList()` |
| Intent selector with dynamic sale/rental fields | `list.html` |
| Rental rate setter, availability, renter requirements | `list.html` (rental fieldset) |
| Sale **and** rental browse with filters | `browse.html` |
| Separate sale vs rental listing templates | `listing.html → pageListing()` |
| Rental **booking request** capture (inquiry-based, Phase 1) | `listing.html` booking form |
| **Unified inbox** (all channels, buyer + renter) | `dashboard.html` |
| Rental **agreement generator** (printable / PDF) | `agreement.html` |
| **6 content pillars** + articles (SEO architecture) | `guides.html`, `article.html`, data in `js/data.js` |
| **Local landing pages** (geo × intent) | `local.html?city=…&intent=…` |
| Monetization (sale Pro Pack, rental fees, affiliates) | `pricing.html` |
| Crosspost channel matrix | `about.html` |
| Revised DB schema | `schema.sql` |
| **VIN decode** (auto-fills make/model/year) | `list.html` + `js/app.js` (NHTSA vPIC API) |
| **Real form submissions** (configurable endpoint) | `js/config.js` |

## File structure

```
.
├── index.html        # Home — repositioned: "Sell it, rent it, or both"
├── browse.html       # Browse sale + rental with filters
├── list.html         # Dual-intent listing flow (replaces sell.html)
├── listing.html      # Listing detail (sale / rental / both templates)
├── dashboard.html    # Unified inbox, listings, rental bookings
├── agreement.html    # Rental agreement generator (print to PDF)
├── guides.html       # Content hub — 6 pillars
├── article.html      # Renders any article by ?slug=
├── local.html        # Geo landing pages: ?city=toronto&intent=rental
├── pricing.html      # Monetization
├── about.html        # Positioning + crosspost channel matrix
├── contact.html
├── sell.html         # → redirects to list.html
├── css/styles.css
├── js/
│   ├── data.js       # Seed listings, cities, content pillars + articles
│   ├── store.js      # localStorage CRUD (listings, inquiries, bookings)
│   └── app.js        # Per-page logic (dispatched by <body data-page>)
├── schema.sql        # Revised Postgres schema (v2)
└── assets/
```

## Run it

No build step. Serve the folder and open it:

```bash
python -m http.server 8000   # then visit http://localhost:8000
```

### Try the full loop
1. **List a car** (`/list.html`) — pick *Both*, set a price and a daily rate, publish.
2. It appears in **Browse** and on its **detail page**.
3. On the detail page, send a **contact message** (sale) and a **booking request** (rental).
4. Open the **Dashboard** — your listing, the inquiries (unified inbox), and the booking show up.
5. From a booking, **Generate agreement** → print/save as PDF.

> Data lives in your browser only. Use **Reset demo data** on the dashboard to clear it.

## Phase 2 (next — needs a real backend)

- Online booking with real-time availability (`rental_availability` table)
- **Stripe Connect** payouts + 8–12% platform fee on completed rentals
- Renter identity verification (Stripe Identity)
- Insurance partner integration (OPCF 27 referral)
- Bidirectional reviews (`reviews` table)
- Automated agreement signing (DocuSign or equivalent)

## Phase 3

- Browser extension for semi-automated crossposting
- Unified CRM with lead scoring
- Bill-of-sale generator (sale vertical)
- Dealer / fleet accounts

## Making forms submit for real

Forms run in demo mode until you point them at an endpoint. To receive real
submissions (contact form, buyer inquiries, booking requests):

1. Create a free form at [Formspree](https://formspree.io) (or use Basin,
   Netlify Forms, or your own API — any JSON `POST` endpoint works).
2. Paste the endpoint into `FORM_ENDPOINT` in [`js/config.js`](js/config.js):
   ```js
   window.LYC_CONFIG = { FORM_ENDPOINT: "https://formspree.io/f/xxxxxxxx" };
   ```

No endpoint = demo mode (data still saves to localStorage so the prototype works).

## VIN decode

The listing form decodes a 17-character VIN via the free, key-less
[NHTSA vPIC API](https://vpic.nhtsa.dot.gov/api/) and auto-fills make, model,
and year. Requires an internet connection; if the service is unreachable the
user can still enter details manually.

## Wiring to a real backend

The front end is intentionally decoupled: all reads/writes go through `js/store.js`.
Swap that module's `localStorage` calls for `fetch()` against an API implementing
`schema.sql`, and the pages keep working unchanged.
