# Grow CT — grow-ct.org

Website for **Grow CT**, a student-run club at Staples High School building produce
gardens and bringing nutritional education to low-income communities in Connecticut.

Static single-page site. No build step — the files in this repo are what get served.

Why things are set up the way they are — and which alternatives were rejected —
is in [DECISIONS.md](DECISIONS.md).

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
DECISIONS.md      Why the setup is what it is; rejected alternatives.
tests/            Static checks and HTTP smoke tests. No dependencies.
```

To change colors or fonts, edit the `:root` block at the top of `styles.css` — every
color on the site is defined there once.

## Forms

Three forms post to Formspree: club signup, contact, and the shop waitlist. All
three go through `wireFormspreeForm()` in `main.js`, which posts via `fetch`,
swaps in an inline confirmation, and shows an error message without losing what
the visitor typed. With JavaScript disabled the browser posts natively to the
same `action` and Formspree shows its own thank-you page.

Each form carries two hidden fields:

- `subject` — sets the notification email's subject line. Supports `{{ field }}`
  templating, e.g. `New club signup from {{ name }} (grade {{ grade }})`.
- `_gotcha` — honeypot, hidden with CSS. Formspree silently drops any submission
  where it has a value.

The `email` field name is significant: Formspree uses it for the Reply-To header,
so replies go to the person who submitted.

Formspree's free plan caps submissions at 50 per month across all three forms.
That is a deliberate trade — see [decision 8](DECISIONS.md#8-forms-stay-on-formspree-for-now),
which also records the migration path to self-hosting when the cap starts to bite.

## Checks

Two scripts, no dependencies beyond `python3`, `bash`, `curl` and `node`:

```bash
python3 tests/static-checks.py          # the repo: links, assets, labels, syntax
python3 tests/static-checks.py --strict # also fail on unfinished placeholders

tests/smoke.sh https://grow-ct.org --zone   # a deployed copy
```

`static-checks.py` fails on things that are broken now — a nav link pointing at
a section id that does not exist, a referenced file missing from the repo, an
image without alt text, an unlabelled form control, a form still on a
placeholder endpoint, a heading level that skips, JS that does not parse.
Unfinished content is reported as a warning instead, so the check is not
permanently red; `--strict` turns those into failures for a pre-launch gate.

`smoke.sh` checks a deployed copy: status codes, the five security headers, the
cache rules, and that config files are not publicly served. `--zone` adds the
redirects that only exist on the real domain (HTTP→HTTPS, www→apex);
`--wait-for ./index.html` polls until the deploy has caught up with the commit
before asserting, which matters in CI because Cloudflare builds independently.

Both run automatically — see [decision 10](DECISIONS.md#10-what-we-test-and-where).

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
- [x] **Formspree form IDs.** Wired: club signup `mkjnqwwn`, contact `mrpgyzzp`,
      kit waitlist `xbgjzrro`. Notifications go to `formspree@grow-ct.org`, which
      needs an Email Routing rule forwarding it to a real inbox.
- [ ] **GoFundMe link.** `index.html` contains
      `https://www.gofundme.com/f/REPLACE-WITH-YOUR-CAMPAIGN` on the donate button.
- [ ] **Product card photo.** The "Container Garden Kit" card uses a placeholder SVG.
      A comment in `index.html` shows the `<img>` tag to swap in when a photo exists.

## Notes

- Images are unoptimized (~600 KB total). If page weight becomes a concern, convert
  `hero-produce.jpg` and `garden-farm.jpg` to WebP.
