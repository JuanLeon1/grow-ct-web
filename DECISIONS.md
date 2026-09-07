# Decisions

Why things are the way they are, including the options we rejected. Entries are
append-only: when a decision changes, add a new one and mark the old one
superseded rather than editing it away.

The forward-looking work list is **not** here — it lives in the "Before going
live" section of [README.md](README.md), which is the one authoritative
next-steps list.

---

## 1. Host as Cloudflare Workers static assets

**2026-09-05 · Accepted**

The site is HTML, CSS, one JS file and three images, with no build step. It is
served by a Worker in static-assets mode (`assets.directory` in
`wrangler.jsonc`, no `main` entrypoint), on the `grow-ct.org` domain registered
in the same Cloudflare account.

Nothing executes server-side, so a bug in `main.js` degrades one feature and
cannot take the site down. See #8 for what would change if that stops being
true.

---

## 2. Deploy from git, not from a laptop

**2026-09-05 · Accepted**

The repo is connected to Cloudflare Workers Builds. Pushes to `main` run
`npx wrangler deploy`; pushes to other branches run `npx wrangler versions
upload`, which produces a preview without touching production. Build command is
empty — there is nothing to build.

Rejected: deploying by hand with `wrangler deploy`, which makes "what is live"
depend on whose laptop last ran it. Also rejected: GitHub Actions, which adds a
workflow file and an API token secret to achieve what the native integration
already does.

The Worker name in Cloudflare must match `name` in `wrangler.jsonc`, or builds
fail.

---

## 3. `www` → apex redirect belongs at the zone, not in `_redirects`

**2026-09-05 · Accepted. Supersedes the original `_redirects` approach.**

The repo originally carried this rule in `_redirects`:

```
https://www.grow-ct.org/*  https://grow-ct.org/:splat  301
```

It cannot work. Workers static assets only accepts **relative paths** as
redirect sources, and rejects hostname sources at deploy time with error
`100324` — which is how we found it: the first build after connecting the repo
failed outright.

The reason is structural, not a quirk: `_redirects` belongs to the Worker, and
the Worker only runs after Cloudflare has decided which hostname it is serving.
Choosing between hostnames has to happen a layer up.

So `www` → apex is a **zone-level Redirect Rule** (grow-ct.org → Rules →
Redirect Rules), matching hostname `www.grow-ct.org` and redirecting to the apex
with the path preserved. `_redirects` remains in the repo for future path-level
moves and currently holds only comments.

---

## 4. `www` resolves via a placeholder DNS record

**2026-09-05 · Accepted**

A Redirect Rule only fires on traffic that reaches Cloudflare's edge, so `www`
needs to resolve. It is a **proxied AAAA record pointing at `100::`** —
Cloudflare's documented placeholder for a redirect-only ("originless") hostname,
from the IPv6 discard prefix. It never routes anywhere; it exists so the edge
accepts the connection and applies the rule.

Rejected: adding `www.grow-ct.org` as a second Custom Domain on the Worker. That
also works, but makes `www` a real second entry point to the site when its only
job is to bounce visitors. The placeholder keeps `grow-ct.org` as the single
Custom Domain.

The orange cloud is load-bearing. A grey-cloud record would send visitors to the
discard address and hang.

---

## 5. Always Use HTTPS is on

**2026-09-05 · Accepted**

Plain HTTP was being served rather than upgraded: `http://grow-ct.org/` returned
200 over plaintext, and `http://www.grow-ct.org/` returned **522**, because on
port 80 the Redirect Rule was not applied before Cloudflare tried to reach the
`100::` placeholder.

Enabling Always Use HTTPS (SSL/TLS → Edge Certificates) fixed both: HTTP is
upgraded at the edge before anything else runs. `http://www` now takes two hops
— upgrade, then hostname redirect — which is correct and not worth collapsing.

---

## 6. Preview strategy: branch previews on workers.dev

**2026-09-05 · Accepted**

Non-production branch builds are enabled, so every branch gets a preview URL and
Cloudflare comments it onto the pull request. The **branch** alias
(`site-fixes-grow-ct-web.<subdomain>.workers.dev`) is the one to use; it follows
the branch tip across pushes.

Two settings this depends on, both pinned in `wrangler.jsonc` because
`wrangler deploy` overwrites dashboard toggles on every push:

```jsonc
"workers_dev": true,
"preview_urls": true
```

`preview_urls` is **not** optional decoration — Cloudflare made preview URLs
opt-in in September 2025, and Wrangler v4.34.0+ defaults it to `false`.

Gotcha for future debugging: if every workers.dev hostname returns 404 with
`error code: 1042`, the workers.dev route is off at the Worker or account level
and the request is failing before the Worker runs. `npx wrangler triggers
deploy` applies the routing settings from `wrangler.jsonc` without uploading
code, which is what fixed it here.

Consequence: the site is also publicly reachable at
`grow-ct-web.<subdomain>.workers.dev`. That is inherent to preview URLs.

---

## 7. Content does not depend on JavaScript to be visible

**2026-09-05 · Accepted. Supersedes the original fade-in implementation.**

Every content block carries `.fade-in`, which started at `opacity: 0` and was
revealed by an IntersectionObserver. A failure to load `main.js`, or any
top-level exception in it, produced a blank page.

Now `main.js` adds `.js-animate` to `<html>` as its first statement, and only
`.js-animate .fade-in` is transparent. Animation is an enhancement; the page
renders without it.

The same principle governs the forms (#8): they have real `action` and `method`
attributes, so without JS the browser posts natively and the form service shows
its own thank-you page. The `fetch` handler is an upgrade, not the only path.

---

## 8. Forms stay on Formspree for now

**2026-09-06 · Accepted**

Three forms — club signup, contact, and the shop waitlist — post to Formspree.
Free plan: unlimited forms, **50 submissions per month across all of them**, two
notification addresses, 30 days of history.

The cap is real and the club could plausibly hit it after an activities fair.
We are accepting it anyway, because Formspree's free plan gives a dashboard a
non-programmer can operate. The founders graduate; a successor can be handed a
Formspree login, and cannot realistically be handed a Worker with a D1 binding.

Formspree warns by email at 50%, 75% and 90% of the cap, and again when
exceeded, so we get advance notice rather than discovering it from a lost
signup. What it does *not* document is whether submission 51 is rejected,
queued or dropped — assume the worst.

### The migration path, for when it is needed

Everything except the endpoint is already in place, and moving requires changing
three `action` attributes plus adding a Worker route. The markup, honeypot,
subject fields and JS handler all stay.

Self-hosted shape:

- **`POST /api/submit` on the Worker.** This means adding `main` to
  `wrangler.jsonc` and routing everything else to the `ASSETS` binding —
  reversing the property in #1 that no code of ours can 500 the homepage.
- **Email via the `send_email` binding.** Cloudflare sends to *verified Email
  Routing destination addresses* free on any plan. That is sufficient here: a
  notification only ever goes to the club's own inbox, with `Reply-To` set to
  the submitter so replies reach the student. Email Routing is already enabled
  on `grow-ct.org` (MX records point at `route1/2/3.mx.cloudflare.net`), so the
  prerequisite is done.
- **D1 as the durable record, email as the notification.** Write the row first,
  then send. A delivery failure then loses a notification, not a signup. D1's
  free tier (5 GB, 100k writes/day) is orders of magnitude beyond a club's
  volume.
- **Turnstile for spam**, replacing Formspree's Formshield. The `_gotcha`
  honeypot alone is not enough.

Costs of moving, beyond the code:

- No dashboard. Reading submissions means `wrangler d1 execute`, which is fine
  for a maintainer and unusable for a student officer. This is the real price,
  not the cap and not the implementation.
- Data responsibility shifts to us. Formspree holds minors' names, school email
  addresses and grades as a processor with 30-day retention. In our own D1 they
  persist until deleted, and retention becomes a policy we have to write and
  enforce.

**Trigger to revisit:** the 50%-of-cap warning arriving in a normal month, or a
maintainer who is comfortable operating a Worker.

**Rejected: running both.** Formspree *and* a self-hosted endpoint means two
systems to maintain and duplicate notifications, while still sitting under
Formspree's cap — the cost of self-hosting without the benefit.

---

## 9. Commits are authored as the personal identity and SSH-signed

**2026-09-05 · Accepted**

The first two commits were authored with the work email, which attributed them
to the wrong GitHub account. History was rewritten to
`Juan Leon <github@artedo.com>` and re-signed with the SSH key
`~/.ssh/github_JuanLeon1_ed25519`, preserving dates and trees.

This is enforced outside the repo: `~/.gitconfig` has an
`includeIf "gitdir:~/src/JuanLeon1/"` pointing at `~/.gitconfig-juanleon1`,
which sets the identity, `gpg.format = ssh`, and the signing key. A clone placed
outside that directory will silently use the work identity again.

---

## 10. What we test, and where

**2026-09-07 · Accepted**

There is no build step and no framework, so there is nothing to unit test. The
failure modes that actually matter are a maintainer editing HTML by hand and
breaking something silently, and the deployed configuration drifting from what
the repo says. Two scripts, no dependencies:

**`tests/static-checks.py`** — the repo. Anchors resolve to real ids, referenced
files exist, images have alt text, form controls are labelled, `target="_blank"`
carries `noopener`, forms have real actions, heading levels do not skip, JS
parses, CSS braces balance. Runs on every pull request.

Unfinished content (the GoFundMe placeholder, team bios, the product photo) is
reported as a **warning**, not a failure. A check that is red from day one is a
check everybody learns to ignore. `--strict` promotes warnings to failures, for
use as a pre-launch gate.

**`tests/smoke.sh`** — a deployed copy. Status codes, the five `_headers`
security headers, the cache rules, and that `.assetsignore` is keeping config
files off the public site.

### Why the split between preview and production

Preview URLs exercise the *Worker's* surface but not the *zone's*. Verified
empirically: `_headers` and `.assetsignore` both apply on a preview hostname,
but `http://<preview>.workers.dev` returns 200 rather than upgrading, because
Always Use HTTPS (#5) is a zone setting. There is no `www` variant of a preview
hostname either.

So pull requests run the 18 Worker-surface checks against the branch preview,
and pushes to `main` run those plus the four zone-level redirect checks against
`grow-ct.org` (`--zone`).

### The freshness gate

Cloudflare's build runs independently of GitHub Actions, so a naive check races
it and can pass against the *previous* version of the branch. `--wait-for
./index.html` polls until the served page hashes equal to the committed one,
timing out after three minutes. A failed build therefore shows up as a timeout
rather than a false green.

The preview hostname is read from Cloudflare's own pull request comment rather
than constructed from the branch name: how Cloudflare derives the hostname is
not documented, so guessing it would be a silent trap for a branch name with a
slash in it. Branch names should still be lowercase alphanumeric with dashes.

### Rejected: browser tests

Playwright would cover the only genuinely untested things — the mobile nav
toggle, fade-ins, form interception, the calendar. Skipped for now because it
means `node_modules`, a lockfile and a browser download in CI, turning a repo
you can clone and open in a browser into one with a toolchain. That cost lands
on the non-technical successor these checks exist to protect. Revisit if the
JavaScript grows.

### Rejected: GitHub Actions for deploys

Unchanged from #2. Actions runs the *checks*; Cloudflare still does the
deploying.

---

## 11. Checks are required on `main`

**2026-09-07 · Accepted**

Ruleset `22417183` on the default branch. Before this, a failing check showed a
red X and the merge button stayed live, which is worth nothing on a repo with a
single maintainer who is also the person in a hurry.

| Rule | Setting |
| --- | --- |
| Pull request required | 0 approvals — GitHub does not let you approve your own |
| Required checks | `static checks`, `smoke test the preview` |
| Force-push | blocked (`non_fast_forward`) |
| Branch deletion | blocked |
| Bypass | the repository owner, mode `always` |

The bypass exists so a Cloudflare outage or a wedged build cannot trap a merge
that has to happen. The repo has one collaborator, so it grants nothing beyond
that account.

### Why requiring these two is safe

A job skipped by an `if:` condition [reports as **Success**][skip] and does not
block. That is what makes this configuration workable: the `production` job is
skipped on pull requests, and `smoke test the preview` is skipped on forks,
neither of which leaves a pull request stuck pending.

Skipped *workflows* behave differently — one skipped by a path or branch filter
stays pending and does block. Ours has no path filters. If path filters are ever
added, this rule has to be revisited or the required checks will hang.

`smoke test production` is deliberately **not** required: it only runs on push
to `main`, so on a pull request it never reports anything meaningful.

[skip]: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions

### Two traps found while setting this up

**The bypass role id is an undocumented magic number.** `bypass_actors` takes
`{"actor_id": 5, "actor_type": "RepositoryRole"}`, and GitHub's REST reference
does not map ids to role names anywhere. Confirmed working by reading the
ruleset back with `gh ruleset view`, which prints `You can bypass: always`.
Keep `actor_id: 5` if editing this via the API, and verify the same way rather
than trusting the number.

**GitHub silently defaults `require_extra_approval_for_unattributed_changes` to
`true`.** Combined with 0 required approvals that is a latent deadlock: commits
here carry a `Co-Authored-By` trailer for an address with no GitHub account, so
a merge could have demanded an approval nobody is able to give. Explicitly set
to `false`.

### Verified, and not

Enforcement is real. The pull request that added this entry reported
`mergeStateStatus: BLOCKED` while the two required checks were pending, and
flipped to `CLEAN` only once both reported success. `smoke test production`
showed as `SKIPPED` throughout and did not block, confirming the reasoning
above. Cloudflare's own `Workers Builds: grow-ct-web` check reports alongside
ours but is not required.

Still untested: a check that actually *fails* rather than one that is merely
pending. That needs a deliberately broken pull request. Note that
`git push --dry-run` proves nothing here — it does not evaluate server-side
rules.

