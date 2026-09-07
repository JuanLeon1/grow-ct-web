#!/usr/bin/env python3
"""Static checks for the Grow CT site. No dependencies.

Run from the repo root:
    python3 tests/static-checks.py            # fails on real problems
    python3 tests/static-checks.py --strict    # also fails on pending placeholders

HARD FAILURES are things that are broken now: a nav link pointing at a section
that does not exist, a referenced file that is not in the repo, an image with no
alt text, a form control with no label, a form still pointing at a placeholder
endpoint.

WARNINGS are unfinished content — the "Before going live" list in README.md.
They do not fail the build, because a permanently red check is one nobody reads.
"""
import os
import re
import subprocess
import sys

STRICT = '--strict' in sys.argv
fails, warns = [], []

def fail(msg): fails.append(msg)
def warn(msg): warns.append(msg)

def strip_comments(html):
    """HTML comments hold example markup (e.g. the <img> to swap in for the
    product photo). Checking inside them produces false positives."""
    return re.sub(r'<!--.*?-->', '', html, flags=re.S)

raw = open('index.html', encoding='utf-8').read()
html = strip_comments(raw)
css = open('styles.css', encoding='utf-8').read()

# ---- ids are unique, and every in-page link resolves ----------------------
ids = re.findall(r'\bid="([^"]+)"', html)
for dupe in {i for i in ids if ids.count(i) > 1}:
    fail(f'duplicate id="{dupe}"')

for href in sorted(set(re.findall(r'href="#([^"]+)"', html))):
    if href not in ids:
        fail(f'link to #{href} but no element has that id')

# ---- every locally referenced file is in the repo -------------------------
for path in sorted(set(re.findall(r'(?:src|href)="(?!https?:|//|#|mailto:|data:)([^"]+)"', html))):
    if not os.path.exists(path):
        fail(f'referenced file is missing from the repo: {path}')

# ---- images are described -------------------------------------------------
for tag in re.findall(r'<img\b[^>]*>', html):
    if not re.search(r'\balt="[^"]+"', tag):
        fail(f'<img> with no alt text: {tag[:70]}')

# ---- form controls are labelled ------------------------------------------
for tag in re.findall(r'<(?:input|select|textarea)\b[^>]*>', html):
    if 'type="hidden"' in tag or 'name="_gotcha"' in tag:
        continue
    match = re.search(r'\bid="([^"]+)"', tag)
    has_label = (match and f'for="{match.group(1)}"' in html) or 'aria-label=' in tag
    if not has_label:
        fail(f'form control with no label: {tag[:70]}')

# ---- links that open a new tab cannot reach back -------------------------
for tag in re.findall(r'<a\b[^>]*>', html):
    if 'target="_blank"' in tag and 'noopener' not in tag:
        fail(f'target="_blank" without rel="noopener": {tag[:70]}')

# ---- forms point at real endpoints ---------------------------------------
for action in re.findall(r'<form\b[^>]*action="([^"]*)"', html):
    if 'YOUR_FORM_ID' in action:
        fail(f'form still points at a placeholder endpoint: {action}')
form_count = len(re.findall(r'<form\b', html))
actioned = len(re.findall(r'<form\b[^>]*action=', html))
if form_count != actioned:
    fail(f'{form_count - actioned} form(s) have no action, so they cannot work without JS')

# ---- heading levels do not skip -----------------------------------------
levels = [int(m) for m in re.findall(r'<h([1-6])\b', html)]
previous = levels[0] if levels else 1
for level in levels[1:]:
    if level > previous + 1:
        fail(f'heading level jumps from h{previous} to h{level}')
    previous = level

# ---- JavaScript parses ---------------------------------------------------
result = subprocess.run(['node', '--check', 'main.js'], capture_output=True, text=True)
if result.returncode != 0:
    fail(f'main.js does not parse: {result.stderr.strip().splitlines()[0]}')

# ---- CSS is at least balanced -------------------------------------------
if css.count('{') != css.count('}'):
    fail(f"styles.css braces unbalanced: {css.count('{')} open, {css.count('}')} close")

# ---- unfinished content -------------------------------------------------
for pattern, label in [
    ('YOUR_FORM_ID', 'Formspree placeholder'),
    ('REPLACE-WITH-YOUR-CAMPAIGN', 'GoFundMe placeholder'),
    ('Bio coming soon', 'team bio placeholder'),
    ('Price: TBD', 'unset price'),
    ('photo coming soon', 'missing photo'),
]:
    count = raw.count(pattern)
    if count:
        warn(f'{count}x {label} ({pattern})')

# ---- report -------------------------------------------------------------
for message in warns:
    print(f'  warn  {message}')
for message in fails:
    print(f'  FAIL  {message}')

if STRICT and warns:
    print(f'\n{len(warns)} placeholder(s) remain and --strict was passed.')
if fails:
    print(f'\n{len(fails)} check(s) failed.')
    sys.exit(1)
if STRICT and warns:
    sys.exit(1)
print(f'\nAll static checks passed{f" ({len(warns)} warning(s))" if warns else ""}.')
