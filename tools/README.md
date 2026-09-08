# tools

Scripts kept because the proof they produce is worth re-running, not because
they run on a schedule. Each carries its own warnings in the file header.

- `ocs-proof.mjs` — drives the real OCS button on the public call-list pages and
  reports what each click did. **Writes to the live CRM and auto-accepts every
  confirm dialog.** Point it at a test row and delete what it creates.
  `node tools/ocs-proof.mjs`
- `ocs-proof-tabbed.mjs` — same, for rows that are not on the tab a list opens
  on. Takes a tab key as well as a row match.
  `node tools/ocs-proof-tabbed.mjs`
- `build-objections.py` — unrelated; predates these.
