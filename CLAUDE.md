# listyourcar.ca — rules for Claude

Portfolio-wide rules and the registry of every site live in `davebussell/portfolio-hq` — read its CLAUDE.md too, then `README.md` here.

## Every chat
1. **First:** attach this repo (`list_repos`, then `add_repo` with push access) and clone it.
2. **Last:** commit, push to `main`, deploy (below, with Dave's OK in the chat), then confirm the live URL. "Done" means pushed **and** live.
3. If the repo, the deploy path or the Netlify project changes, update the `portfolio-hq` registry row.

## Netlify
- Project `listyourcar` (`b5cd9c62-5562-4838-b6be-cdd6e1405589`) at https://listyourcar.ca.
- A push to `main` does **not** deploy (checked 2026-10-22: nothing happened for minutes after a push). Deploys are uploads.
- Last deploy: `6ada5be42a150c1008c634f0` (2026-10-22 18:54 UTC, MCP upload of `8ce424e`). Update this line after every deploy.
- `netlify.toml` publishes the repo root (`publish = "."`, no build), so everything in the root is public, including `README.md`,
  the `build-*.js` scripts and `schema.sql`. Keep secrets out of the repo.

## How to deploy (needs Dave's OK in the chat)
```
rm -rf /tmp/lyc-deploy && mkdir /tmp/lyc-deploy && git archive HEAD | tar -x -C /tmp/lyc-deploy
python3 <portfolio-hq clone>/tools/check_html_attrs.py /tmp/lyc-deploy      # must end with OK
```
Then call the Netlify MCP `netlify-deploy-services-updater` (`deploy-site`, this site id) and run the command it returns from inside
`/tmp/lyc-deploy`. Never paste its proxy token anywhere. Never create a new Netlify site.

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
