# lists/

## objections.html is generated — do not edit it by hand

`objections.html` is the plain lookup sheet. `bi-value-and-objections.html` is the
designed referrer's guide. **Both carry the same 25 objections, and if they ever
disagree that is a bug.**

The lookup sheet is built from the designed page, so the words can only come from
one place:

```
python3 tools/build-objections.py
```

**Run that after editing any objection on either page.** The script reads the
objections out of `bi-value-and-objections.html`, rewrites `objections.html`, and
aborts if it does not find exactly 25 — so a botched edit fails loudly instead of
silently shipping two pages that say different things.

Editing `objections.html` directly is the one thing not to do: the next run of the
script overwrites it, and until then the two pages contradict each other in front
of whoever is reading one of them on a call.

### Checks worth repeating after a change

- Both pages carry 25 objections, identical and in the same order.
- Every objection in the lookup sheet's index resolves to an anchor on the page.
- Printed to PDF, no objection is separated from its own answer by a page break —
  that split is what would make the sheet useless on paper, so it is measured
  from the PDF text rather than assumed from the CSS.
