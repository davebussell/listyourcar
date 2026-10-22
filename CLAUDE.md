# listyourcar.ca — rules for Claude

Portfolio-wide rules and the registry of every site live in `davebussell/portfolio-hq` — read its CLAUDE.md too, then `README.md` here.

## Every chat
1. **First:** attach this repo (`list_repos`, then `add_repo` with push access) and clone it.
2. **Last:** commit, then push to `main` with Dave's OK (a push deploys), wait for the Git deploy, then confirm the live URL.
   "Done" means pushed **and** live.
3. If the repo, the deploy path or the Netlify project changes, update the `portfolio-hq` registry row.

## Netlify
- Project `listyourcar` (`b5cd9c62-5562-4838-b6be-cdd6e1405589`) at https://listyourcar.ca. **Linked to this repo: every push to `main`
  deploys** (no build step; `netlify.toml` publishes the repo root). Builds can queue for a few minutes when other projects are
  building, so wait before concluding a push did not deploy (on 2026-10-22 one push took over two minutes to start).
- So never push to `main` without Dave's OK for it to go live, and never deploy by upload: the next push would overwrite it.
- Last deploys: `6ada5be42a150c1008c634f0` (2026-10-22 18:54 UTC, MCP upload of `8ce424e`, the forms fix) and the Git deploys after it.
- Everything in the repo root is public, including `README.md`, the `build-*.js` scripts and `schema.sql`; `netlify.toml` hides
  `/CLAUDE.md`. Keep secrets out of the repo.

## Forms
- Every form (contact, sell/auction listings, bids, dealer claims) goes through `window.submitForm` in `js/config.js`. With
  `FORM_ENDPOINT` empty it posts to the Netlify Form `lead`, registered by the hidden form at the bottom of `index.html`. Its fields:
  kind, subject, name, email, phone, message, page, details (the whole payload as JSON). Netlify drops any field the hidden form
  does not list, so add new fields there too. Before 2026-10-22 every form ran in "demo mode" and nothing was sent.
- The dealer-email and seller-email buttons in `js/start.js` and `js/listing.js` are deliberate `mailto:` links (the visitor emails
  the dealer or seller directly); they are not lead capture.

## Analytics
The GA4 tag is in the page source; Netlify's snippet injection adds Clarity only. Do not add a second GA4 tag.

## Standards
- Check every change at 375px and at 1280px+ before saying done.
- Keep the SEO basics (title, description, canonical, Open Graph, `sitemap.xml`, `robots.txt`) intact.
