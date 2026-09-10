"""
Builds public/lists/objections.html from the objections already in
bi-value-and-objections.html.

    python3 tools/build-objections.py

Run this after editing an objection on EITHER page. The two pages must always
carry the same 25 objections in the same words; this is what enforces that.

The 25 objections are EXTRACTED, never retyped. If the two pages ever disagree
that is a bug, and the only way to make that structurally hard is to have one
page's words come out of the other's markup.
"""
import re, html, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "public/lists/bi-value-and-objections.html"
OUT = ROOT / "public/lists/objections.html"
src = SRC.read_text()

# Sections, in document order, with their heading.
sections = []
for m in re.finditer(r'<section id="([a-z]+)">(.*?)</section>', src, re.S):
    sid, body = m.group(1), m.group(2)
    h2 = re.search(r"<h2>(.*?)</h2>", body, re.S)
    if not h2:
        continue
    title = html.unescape(re.sub(r"<[^>]+>", "", h2.group(1))).strip()
    pairs = []
    for o in re.finditer(r'<p class="o-q">(.*?)</p>\s*<p class="o-a">(.*?)</p>', body, re.S):
        q = " ".join(o.group(1).split())
        a = " ".join(o.group(2).split())
        pairs.append((q, a))
    if pairs:
        sections.append((sid, title, pairs))

total = sum(len(p) for _, _, p in sections)
if total != 25:
    sys.exit(f"ABORT: extracted {total} objections, expected 25. Extraction is wrong.")

def slug(q):
    t = html.unescape(re.sub(r"<[^>]+>", "", q)).lower()
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t[:52]

# ── index -------------------------------------------------------------------
idx = []
for sid, title, pairs in sections:
    idx.append(f'  <li class="ix-h">{html.escape(title)}</li>')
    for q, _ in pairs:
        plain = html.unescape(re.sub(r"<[^>]+>", "", q))
        idx.append(f'  <li><a href="#{slug(q)}">{html.escape(plain)}</a></li>')

# ── body --------------------------------------------------------------------
blocks = []
for sid, title, pairs in sections:
    blocks.append(f'<h2>{html.escape(title)}</h2>')
    for q, a in pairs:
        plain = html.unescape(re.sub(r"<[^>]+>", "", q))
        blocks.append(
            f'<div class="ob" id="{slug(q)}">\n'
            f'  <p class="q">{q}</p>\n'
            f'  <p class="a">{a}</p>\n'
            f'</div>'
        )

HEAD = """<!doctype html>
<!--
  GENERATED FILE — DO NOT EDIT BY HAND.
  Built from public/lists/bi-value-and-objections.html by tools/build-objections.py.
  Edit the objection there, then run:  python3 tools/build-objections.py
  Hand-editing this file makes the two pages disagree, which is the one bug this
  arrangement exists to prevent.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Objections — answers, in order</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap" rel="stylesheet">
<style>
/* THE DARK BRAND ON SCREEN, LIGHT ON PAPER — the same arrangement the source
   page (bi-value-and-objections.html) already ships: brand tokens here, a second
   set redefined inside @media print. The page used to be cream on the argument
   that it is a working reference someone prints, not a marketing surface. That
   was a compromise palette solving a print problem in the wrong place: the print
   block below serves paper, so the screen does not have to.
   Dense on purpose — whitespace is the enemy of scanning.
   ⚠️ BLUE CARRIES THE STRUCTURE. Gold is a SECONDARY accent — the eyebrow and
   nothing else. It previously coloured every h2, every index header, every link
   and the focus ring, which is gold dominating. */
:root{
  --ink:#EEF3FA; --soft:#AEBBCD; --mut:#7E8DA0; --line:#243044; --line2:#31415C;
  --blue:#1A6ECC; --blue2:#3F8AE0; --gold:#F5B301;
  --panel:#0E1420; --panel2:#131B2B; --bg:#0A0F1A;
  --head:'Bebas Neue',Impact,sans-serif; --body:'DM Sans',system-ui,sans-serif;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--body);
  font-size:14.5px;line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{max-width:820px;margin:0 auto;padding:30px 30px 60px}
h1,h2{font-family:var(--head);font-weight:400;letter-spacing:.02em;margin:0}
h1{font-size:34px;line-height:1.04}
h2{font-size:17px;letter-spacing:.11em;text-transform:uppercase;color:var(--blue2);
  margin:30px 0 10px;padding-bottom:5px;border-bottom:1px solid var(--line)}
.eyebrow{font-family:var(--head);font-size:12.5px;letter-spacing:.2em;
  text-transform:uppercase;color:var(--gold)}
.wordmark{font-family:var(--head);font-size:13px;letter-spacing:.15em;color:var(--mut)}
.lede{color:var(--soft);margin:8px 0 0;max-width:70ch;font-size:14px}
.xref{margin:10px 0 0;font-size:13px;color:var(--mut)}
.xref a{color:var(--blue2)}

/* The index is the feature: it is what makes this usable while someone talks. */
.ix{margin:22px 0 0;border-top:1px solid var(--line);padding-top:16px}
.ix ul{margin:0;padding:0;list-style:none;columns:2;column-gap:34px}
@media (max-width:700px){ .ix ul{columns:1} }
.ix li{font-size:13.2px;line-height:1.5;margin:0 0 2px;break-inside:avoid}
.ix li.ix-h{font-family:var(--head);font-size:12.5px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--blue2);margin:11px 0 4px}
.ix li.ix-h:first-child{margin-top:0}
.ix a{color:var(--soft);text-decoration:none;border-bottom:1px solid var(--line2)}
.ix a:hover{border-bottom-color:var(--blue2);color:var(--blue2)}

/* Question and answer are one unit and must never be split across a page.
   The left border is RESERVED, not added on :target — a deep link must highlight
   without shifting the page under the reader as it lands. */
.ob{margin:0 0 13px;padding:2px 0 2px 12px;border-left:3px solid transparent;
  break-inside:avoid;page-break-inside:avoid}
.ob .q{margin:0;font-weight:700;font-size:14.8px;line-height:1.35;color:var(--ink)}
.ob .q::before{content:"“"} .ob .q::after{content:"”"}
.ob .a{margin:3px 0 0;color:var(--soft);line-height:1.5}
.ob .a b{color:var(--ink)}
.ob .a em{font-style:normal;font-weight:700;color:var(--ink)}
/* ⚠️ WAS A CREAM BAND (#f3ecd8). On the dark ground that would have landed Jeff's
   own #i-already-have-a-dashboard link on an unreadable stripe. */
:target{background:var(--panel2);border-left-color:var(--blue2);border-radius:0 6px 6px 0}
:focus-visible{outline:2px solid var(--blue2);outline-offset:2px}

/* PAPER STAYS LIGHT. Same arrangement as the source page: redefine the tokens,
   do not restyle every rule. */
@media print{
  :root{--bg:#fff;--panel:#fff;--panel2:#fff;--line:#c8d0dc;--line2:#aab5c6;
    --ink:#0d1420;--soft:#33405a;--mut:#5d6b82;--blue2:#124e8f;--gold:#8a6410}
  body{background:#fff;font-size:10.2pt;line-height:1.42}
  .ob{padding-left:0;border-left:none}
  :target{background:none}
  .wrap{padding:0;max-width:100%}
  h1{font-size:26pt} h2{font-size:12.5pt;margin:14pt 0 6pt}
  .ix{display:none}            /* an index of anchors is useless on paper */
  .ob{margin-bottom:8pt}
  a{color:inherit;text-decoration:none}
  @page{margin:15mm}
}
</style>
</head>
<body>
<div class="wrap">

<div class="eyebrow">Objections &amp; answers</div>
<h1>What they will say, and what to say back</h1>
<p class="lede">Every objection and answer from the referrer's guide, in the same order,
  with nothing between the objection and its answer. Made for finding a sentence while
  someone is talking &mdash; use the index, or Cmd-F.</p>
<p class="xref">The version with the value arguments and the industry context is at
  <a href="bi-value-and-objections.html">bi-value-and-objections.html</a>.</p>
<p class="wordmark">EnhancedOps.Ninja &middot; Business Intelligence</p>

<nav class="ix" aria-label="All objections">
<ul>
__INDEX__
</ul>
</nav>

__BODY__

<p class="xref" style="margin-top:30px;border-top:1px solid var(--line);padding-top:14px">
  Internal reference. No client names and no measured results appear here.
  The value arguments and industry context are at
  <a href="bi-value-and-objections.html">bi-value-and-objections.html</a>.</p>

</div>
</body>
</html>
"""

built = HEAD.replace("__INDEX__", "\n".join(idx)).replace("__BODY__", "\n".join(blocks))

if "--check" in sys.argv:
    # CI mode. The strongest possible check: does the committed page match what
    # the designed page produces RIGHT NOW? That catches an edit to either file,
    # including a hand-edit of the generated one.
    current = OUT.read_text() if OUT.exists() else ""
    if current == built:
        print(f"OK — objections.html matches bi-value-and-objections.html ({total} objections)")
        sys.exit(0)
    print("=" * 72)
    print("OBJECTIONS PARITY FAILED")
    print("=" * 72)
    print("public/lists/objections.html is not what bi-value-and-objections.html produces.")
    print("The two pages would show different words to whoever is reading one of them.")
    print()
    def qa(text, q, a):
        return [(" ".join(html.unescape(re.sub(r"<[^>]+>", " ", m.group(1))).split()),
                 " ".join(html.unescape(re.sub(r"<[^>]+>", " ", m.group(2))).split()))
                for m in re.finditer(rf'<p class="{q}">(.*?)</p>\s*<p class="{a}">(.*?)</p>', text, re.S)]
    want, have = qa(built, "q", "a"), qa(current, "q", "a")
    if len(want) != len(have):
        print(f"  count differs: designed page has {len(want)}, objections.html has {len(have)}")
    for i, (w, h) in enumerate(zip(want, have)):
        if w != h:
            print(f"  first difference at objection {i + 1}:")
            print(f"    designed page : {w[0][:100]}")
            print(f"                    {w[1][:100]}")
            print(f"    objections.html: {h[0][:100]}")
            print(f"                    {h[1][:100]}")
            break
    print()
    print("FIX: python3 tools/build-objections.py   then commit the regenerated page.")
    sys.exit(1)

OUT.write_text(built)
print(f"extracted {total} objections across {len(sections)} sections")
for sid, title, pairs in sections:
    print(f"  {len(pairs):>2}  {title}")
print("wrote", OUT)
