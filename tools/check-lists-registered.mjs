/**
 * Every page in public/lists/ must be reachable from the CRM, or explicitly
 * hidden with a reason.
 *
 * Why this exists: LISTS was hand-maintained, so eight pages shipped and simply
 * never appeared in the Call Lists tab. Nothing failed — they were just
 * invisible, and nobody noticed until Jeff went looking for one. A silent gap
 * that only surfaces when someone needs the thing is the worst kind.
 *
 * ⛔ Deliberately NOT auto-listing the directory. Some pages are addressed to one
 * named client and must not appear in a list that might be screen-shared, so
 * registration stays a decision. This only enforces that the decision was MADE.
 *
 *   node tools/check-lists-registered.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIEW = join(ROOT, 'src/components/crm/CallListsView.tsx');
const DIR = join(ROOT, 'public/lists');

const source = readFileSync(VIEW, 'utf8');

// Registered = anything the view links to under /lists/.
const registered = new Set(
  [...source.matchAll(/\/lists\/([A-Za-z0-9._-]+\.html)/g)].map((m) => m[1]),
);

// Hidden = named in HIDDEN_LISTS, which requires a reason beside each file.
const hiddenBlock = source.match(/const HIDDEN_LISTS[^=]*=\s*\[([\s\S]*?)\n\];/);
const hidden = new Set(
  hiddenBlock ? [...hiddenBlock[1].matchAll(/file:\s*'([^']+)'/g)].map((m) => m[1]) : [],
);

const onDisk = readdirSync(DIR).filter((f) => f.endsWith('.html'));
const unregistered = onDisk.filter((f) => !registered.has(f) && !hidden.has(f));

// A stale entry is the mirror failure: a card pointing at a page that is gone.
const missing = [...registered, ...hidden].filter((f) => !onDisk.includes(f));

if (unregistered.length === 0 && missing.length === 0) {
  console.log(
    `OK — ${onDisk.length} pages in public/lists/: ${registered.size} registered, ${hidden.size} intentionally hidden.`,
  );
  process.exit(0);
}

console.error('='.repeat(72));
console.error('LIST REGISTRATION CHECK FAILED');
console.error('='.repeat(72));

if (unregistered.length) {
  console.error('\nThese pages exist but are unreachable from the Call Lists tab:\n');
  for (const f of unregistered) console.error(`    public/lists/${f}`);
  console.error(`
  Pick one, in src/components/crm/CallListsView.tsx:
    • add it to LISTS  (people to call — needs a contact count)
    • add it to DOCS   (reference — no contacts, count optional)
    • add it to HIDDEN_LISTS with a reason, if it is client-specific
      or otherwise should not appear in a list that may be screen-shared`);
}

if (missing.length) {
  console.error('\nThese are registered or hidden but the file no longer exists:\n');
  for (const f of missing) console.error(`    public/lists/${f}`);
  console.error('\n  Remove the entry, or restore the page.');
}

console.error('');
process.exit(1);
