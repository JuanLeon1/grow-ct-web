# Grow CT — grow-ct.org

Website for **Grow CT**, a student-run club at Staples High School building produce
gardens and bringing nutritional education to low-income communities in Connecticut.

Static single-page site. No build step — the files in this repo are what get served.

## Layout

```
index.html        The page. Structure and content only.
styles.css        All styling. CSS custom properties at the top control the palette.
main.js           Nav behaviour, scroll animations, event calendar, form handling.
assets/           logo.png, hero-produce.jpg, garden-farm.jpg
_headers          Security + caching headers (Cloudflare).
_redirects        Path-level redirects. www → apex is a Cloudflare Redirect Rule, not here.
robots.txt        Crawler rules.
sitemap.xml       Sitemap for search engines.
wrangler.jsonc    Cloudflare Workers deploy config.
.assetsignore     Files excluded from public serving.
```

To change colors or fonts, edit the `:root` block at the top of `styles.css` — every
color on the site is defined there once.

## Local development

No tooling required. Open `index.html` in a browser, or serve it properly (needed if
you want paths to behave exactly as they do in production):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploying

Hosted on **Cloudflare Workers** (static assets) at `grow-ct.org`.

```bash
npx wrangler deploy     # publish
npx wrangler dev        # local preview with the Cloudflare runtime
```

Once the repo is connected to Cloudflare in the dashboard, every push to `main`
deploys automatically and every pull request gets its own preview URL.

## Before going live

These are placeholders in the current draft and must be replaced:

- [ ] `sitemap.xml` / `index.html` assume the domain is `grow-ct.org` — correct if that changes.
- [ ] **Formspree form IDs.** `index.html` contains `https://formspree.io/f/YOUR_FORM_ID`
      in three places (club signup, contact, and the shop "Notify me" form). Each needs
      its own endpoint ID from a Formspree account; until then they show an error on
      submit.
- [ ] **GoFundMe link.** `index.html` contains
      `https://www.gofundme.com/f/REPLACE-WITH-YOUR-CAMPAIGN` on the donate button.
- [ ] **Product card photo.** The "Container Garden Kit" card uses a placeholder SVG.
      A comment in `index.html` shows the `<img>` tag to swap in when a photo exists.

## Notes

- Images are unoptimized (~600 KB total). If page weight becomes a concern, convert
  `hero-produce.jpg` and `garden-farm.jpg` to WebP.
