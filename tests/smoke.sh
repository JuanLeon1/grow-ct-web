#!/usr/bin/env bash
# HTTP checks against a deployed copy of the site.
#
#   tests/smoke.sh https://grow-ct.org --zone
#   tests/smoke.sh https://<branch>-grow-ct-web.<subdomain>.workers.dev --wait-for ./index.html
#
# --zone      also check the redirects that only exist at the Cloudflare zone
#             level: HTTP->HTTPS upgrade and www->apex. Preview hostnames have
#             neither, so this is production-only.
# --wait-for  poll until the deployed index.html matches this local file before
#             asserting anything. Cloudflare builds run independently of CI, so
#             without this the checks can pass against the previous version.

set -uo pipefail

BASE="${1:?usage: smoke.sh <base-url> [--zone] [--wait-for <file>]}"; shift
BASE="${BASE%/}"
ZONE=0
WAIT_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --zone) ZONE=1; shift ;;
    --wait-for) WAIT_FILE="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

pass=0; fail=0
ok()   { printf '  ok    %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  FAIL  %s\n' "$1"; fail=$((fail+1)); }

sha() { if command -v sha256sum >/dev/null; then sha256sum | cut -d' ' -f1; else shasum -a 256 | cut -d' ' -f1; fi; }

status()   { curl -sS -o /dev/null -m 20 -w '%{http_code}' "$1"; }
redirect() { curl -sS -o /dev/null -m 20 -w '%{redirect_url}' "$1"; }
header()   { curl -sSI -m 20 "$1" | tr -d '\r' | grep -i "^$2:" | cut -d' ' -f2-; }

# assert_eq <label> <expected> <actual>
assert_eq() {
  if [ "$2" = "$3" ]; then ok "$1"; else bad "$1: expected '$2', got '$3'"; fi
}

expect_status() { assert_eq "$3" "$2" "$(status "$1")"; }

# ---- wait for the deploy to catch up with the commit ----------------------
if [ -n "$WAIT_FILE" ]; then
  want=$(sha < "$WAIT_FILE")
  echo "Waiting for $BASE to serve $WAIT_FILE (sha ${want:0:12})..."
  for attempt in $(seq 1 18); do
    got=$(curl -sS -m 20 "$BASE/" | sha)
    if [ "$got" = "$want" ]; then ok "deployed content matches the commit"; break; fi
    if [ "$attempt" = 18 ]; then
      bad "after 3 minutes $BASE still serves ${got:0:12}, not ${want:0:12} — build may have failed"
      echo; echo "$fail check(s) failed."; exit 1
    fi
    sleep 10
  done
fi

echo "Checking $BASE"

# ---- the site is there ----------------------------------------------------
expect_status "$BASE/"                 200 "homepage"
expect_status "$BASE/robots.txt"       200 "robots.txt"
expect_status "$BASE/sitemap.xml"      200 "sitemap.xml"
expect_status "$BASE/no-such-page-xyz" 404 "unknown path 404s"

# ---- _headers is applied --------------------------------------------------
for h in strict-transport-security x-frame-options x-content-type-options \
         referrer-policy permissions-policy; do
  if [ -n "$(header "$BASE/" "$h")" ]; then ok "header $h"; else bad "header $h missing"; fi
done

check_cache() { assert_eq "cache-control $1" "$2" "$(header "$BASE$1" cache-control)"; }
check_cache /assets/logo.png "public, max-age=31536000, immutable"
check_cache /styles.css      "public, max-age=3600"
check_cache /main.js         "public, max-age=3600"

# ---- .assetsignore keeps config off the public site -----------------------
for f in /wrangler.jsonc /README.md /DECISIONS.md /_headers /_redirects /.assetsignore; do
  expect_status "$BASE$f" 404 "not public: $f"
done

# ---- zone-level behaviour (production only) -------------------------------
if [ "$ZONE" = 1 ]; then
  host="${BASE#https://}"
  assert_eq "http -> https upgrade" "https://$host/" "$(redirect "http://$host/")"
  assert_eq "www -> apex" "https://$host/" "$(redirect "https://www.$host/")"
  assert_eq "http://www lands on apex https" "https://$host/" \
    "$(curl -sSL -o /dev/null -m 30 -w '%{url_effective}' "http://www.$host/")"
  assert_eq "redirect preserves path and query" "https://$host/about?x=1" \
    "$(redirect "https://www.$host/about?x=1")"
fi

echo
echo "$pass passed, $fail failed."
[ "$fail" -eq 0 ]
