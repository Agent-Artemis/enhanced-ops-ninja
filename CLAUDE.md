# EnhancedOps.ninja — Claude Code Context

## Agent Protocol — Master-Brain Sync (Do This Every Session)

**SESSION START — before touching any code:**
1. Pull latest Master-Brain: `gh api repos/Agent-Artemis/Master-Brain/contents/enhanced-ops-ninja/CLAUDE.md --jq '.content' | base64 -d`
2. Read `enhanced-ops-ninja/CLAUDE.md` and `eon-app/CLAUDE.md` in Master-Brain
3. Read `Agent-Artemis/Master-Brain/WORKFLOW.md` for full agent protocol
4. Then open this repo and begin work

**SESSION END — before closing:**
1. Update this file with any fixes made, prompts completed, decisions taken, or new patterns discovered
2. Push updated CLAUDE.md to `Agent-Artemis/Master-Brain` as `enhanced-ops-ninja/CLAUDE.md`
3. If eon-app was also touched, update that file in Master-Brain too
4. Commit message format: `Sync CLAUDE.md — [brief description of what changed]`

Master-Brain repo: `Agent-Artemis/Master-Brain` (private)  
Full agent protocol: `WORKFLOW.md` in Master-Brain root

---

Public-facing Next.js app at [enhancedops.ninja](https://enhancedops.ninja).  
Handles marketing, free assessments, and paid deep-dive assessments.  
Auto-deploys to Vercel on push to `main`.  
Internal CRM (Ninja Dojo) lives at `~/eon-app` — see its CLAUDE.md for that side.

---

## Tech Stack

| Layer | Tool | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.3.8 |
| Language | TypeScript | strict mode |
| Styling | Tailwind CSS | v4 |
| Database | Supabase (Postgres + RLS) | @supabase/supabase-js ^2 |
| Payments | Stripe | stripe ^18 |
| Email | Resend | resend ^6 |
| PDF | @react-pdf/renderer | ^4 |
| Deployment | Vercel (auto from `main`) | |
| E2E Tests | Playwright | @playwright/test ^1.60 |

---

## Project Structure

```
src/
  app/
    api/
      health/                         GET → {ok:true}
      assessment/config|session|answer|complete  — free assessment flow
      create-payment-intent/          POST — Stripe PI or MASTERTEST bypass
      complete-assessment/            POST — save scores + send Resend email
      cal-webhook/                    POST — Cal.com booking → update DB
      in-depth-ops/                   POST — premium ops track (separate)
      ops-report/                     POST — generate PDF report
      stripe/webhook/                 POST — payment confirmation
    deep-dive/
      page.tsx                        /deep-dive — checkout flow
      assessment/page.tsx             /deep-dive/assessment — 45-question wizard
      score/page.tsx                  /deep-dive/score — results + Cal.com booking
      schedule/page.tsx               /deep-dive/schedule — Cal.com embed page
  components/
    deep-dive/
      DeepDiveFlow.tsx                3-step checkout
      DeepDiveAssessmentWizard.tsx    Full 45-question wizard
    marketing/
      MarketingHeader.tsx             Header with portal chooser modal
      MarketingHome.tsx + sections    Landing page sections
  lib/
    deep-dive/
      assessment-data.ts              Loads JSON configs through Zod
      assessment-scoring.ts           pointsForChoice / moduleScorePercent
      assessment-storage.ts           localStorage key map (DEEP_DIVE_LS)
      pricing.ts                      Discount codes, formatUsd
    assessments/schema.ts             Zod schemas
    scoring/                          Free assessment scoring
    supabase/admin.ts                 Service role client
config/assessments/
  paid-healthcare.json                45 Qs (44 MC + 1 open), 7 domains
  paid-business.json                  43 Qs (42 MC + 1 open), 7 domains
e2e/
  paid-assessment.spec.ts             Mocked e2e — full UI + scoring flow
  paid-assessment-live.spec.ts        Live e2e — real DB writes, no mocks
```

---

## Assessment Tracks

| Track | Questions | Scoring | Entry |
|---|---|---|---|
| Free | Variable | A=5,B=4,C=3,D=1 | Marketing pages |
| Paid Deep-Dive | 45 (HC) / 43 (BIZ) | A=3,B=2,C=1,D=0 | /deep-dive |
| In-Depth Ops | 52 | Module scoring | Separate checkout |

**Two scoring scales exist by design — do not consolidate.**

---

## Critical Fixes Made (All Sessions)

### 1. Zod Parse Fix — question type defaults (`0569414`)
**Problem:** 44 of 45 questions had no `type` field in JSON. Zod schema has `.default("multiple_choice")` but configs were loaded with `as AssessmentConfig` (TypeScript cast) — Zod never ran, so `q.type` was `undefined`. `isMultipleChoiceQuestion()` returned false for all questions → `overallScore: 0`.

**Fix:** `CONFIG_BY_TRACK` now calls `assessmentConfigSchema.parse()`. **DO NOT revert to `as AssessmentConfig` cast.**

### 2. URL params to survive Stripe redirect (`48e7eeb`, `2ffd155`, `ef5892d`)
Email + firstName passed as URL params `dde`/`ddf`. Answers auto-saved to `DEEP_DIVE_LS.answers` (localStorage) before redirect. Score passed to `/deep-dive/score` via `?os=...&ms=...` URL params.

### 3. Unique index on `deep_dive_assessments.email` (`5807af6`)
`create-payment-intent` catches Postgres 23505 on duplicate email and returns existing ID instead of throwing.

### 4. Cal.com URL was 404 (`ba914bf`)
`45-min-with-enhanced-ops-ninja` does not exist — the correct slug is `45-min`. Fixed in `complete-assessment/route.ts` (completion email) and `schedule/page.tsx` (embed). Verify: `curl -o/dev/null -w "%{http_code}" https://cal.com/enhancedopsninja/45-min` → 200.

### 5. Score page improvements (`e764202`)
- Ninja Review copy: past tense → future tense ("will review...map")
- Module bars: colour-coded by score (red <40, orange 40-59, yellow 60-74, green ≥75)
- `barColorFromScore()` function drives both bar fill and score number colour

### 6. Cal.com booking on score page (`ecf66ff`)
Booking section embedded directly on the score page — no intermediate navigation. Direct-link button (`target="_blank"`) plus inline Cal.com embed via `next/script afterInteractive`. The `/deep-dive/schedule` page still exists for email links.

### 7. Header button — direct to client portal (`135207a`)
`MarketingHeader.tsx` "Enter the Mission" button is a direct `<a href="https://mission.enhancedops.ninja">` — no modal, no choice. EON team accesses Ninja Dojo by typing `dojo.enhancedops.ninja` directly; there is no entry point from the marketing site for the team.

---

## Checkout Flow (DeepDiveFlow.tsx)

**Discount Codes** (case-insensitive, hardcoded in `pricing.ts`):

| Code | Amount | Notes |
|---|---|---|
| `PILOT10` | $1,000 | |
| `SILENTNINJA20` | $1,200 | |
| `TESTER4` | $1 | Test Stripe |
| `MASTERTEST` | $0 | Full bypass — used in e2e tests |

When `amountPaid === 0`: `create-payment-intent` returns `{bypass:true, assessmentId, clientSecret:null}` → direct to `/deep-dive/assessment`, no Stripe.

---

## Wizard (DeepDiveAssessmentWizard.tsx)

53 screens for healthcare: welcome → 7 module intros → 44 MC questions → 1 open question (hc_p_45, last screen).

**Q32 Playwright gotcha:** Option B is "Voicemail — called back **next** business day". `getByRole('button', { name: 'Next' })` without `exact: true` matches it. Always use `{ exact: true }`.

---

## LocalStorage Keys (DEEP_DIVE_LS)

| Key | Value |
|---|---|
| `deepDiveAssessmentId` | UUID |
| `businessType` | `"healthcare"` or `"business"` |
| `deepDiveEmail` | user email |
| `deepDiveFirstName` | first name |
| `deepDiveAnswers` | JSON Record<string,string> |
| `deepDiveOverallScore` | string number |
| `deepDiveModuleScores` | JSON Record<string,number> |

---

## Supabase Tables

**`deep_dive_assessments`** — unique index on `email`
`id`, `first_name`, `last_name`, `email`, `phone`, `org_name`, `business_type`, `amount_paid`, `stripe_payment_intent_id`, `assessment_answers` (jsonb), `assessment_score`, `module_scores` (jsonb), `assessment_completed_at`, `appointment_scheduled_at`, `created_at`

**`assessment_sessions`** — free tier  
**`assessment_responses`** — free tier answers  
**`assessment_scores`** — free tier aggregate  
**`ops_assessment_sessions/answers/reports`** — in-depth ops track

> **No migration files** for these tables — schema lives in Supabase dashboard only.

---

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
CAL_COM_BOOKING_URL   # default: https://cal.com/enhancedopsninja/45-min
```

---

## Path Aliases

```json
"@/*" → "./src/*"
"@config/*" → "./config/*"
```

---

## E2E Tests

```bash
npm run test:e2e          # mocked — 15s, no side effects
npm run test:e2e:ui       # Playwright UI
npx playwright test e2e/paid-assessment-live.spec.ts  # real DB + email
```

**Mocked test** (`paid-assessment.spec.ts`) intercepts both API routes — runs in ~15s, no DB writes, confirms UI flow + scoring + module bars + Cal.com slug + future-tense copy.

**Live test** (`paid-assessment-live.spec.ts`) hits real `create-payment-intent` and `complete-assessment` with MASTERTEST. Uses `jeff+playwright@augeo-hq.com` — sends a real completion email to that address (not Jeff's main inbox).

---

## Brand

- **Primary blue (this site):** `#1A6ECC` — not `#1A6BF9` (eon-app)
- **Logo:** `/public/logo-transparent.png`
- **Legal entity:** Augeo LLC (dba EnhancedOps.ninja)
- **Cal.com:** `https://cal.com/enhancedopsninja/45-min`
- **Email from:** `jeff@enhancedops.ninja`

---

## Key Rules for Agents

1. **Always parse assessment configs through Zod** — `assessmentConfigSchema.parse()`, never `as AssessmentConfig`
2. **`npx tsc --noEmit` must pass** before every commit
3. **`main` auto-deploys to Vercel** — keep it green
4. **Cal.com slug is `45-min`** (not `45-min-with-enhanced-ops-ninja` — that's a 404)
5. **Two scoring scales** — free (1-5) and paid (0-3) — intentional, do not merge
6. **Q32 Playwright**: use `{ exact: true }` on "Next" button selector
7. **Completion email** uses `jeff+playwright@augeo-hq.com` for automated tests — not Jeff's real inbox
8. **Commit format:** lowercase imperative, `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

---

## Relationship to eon-app

Both apps share the same Supabase project. When a free assessment completes here, a DB trigger creates a client card in the eon-app at stage `free_assessment_complete`. Paid deep-dive data feeds into the eon-app's Secret Mission Briefing generation. See `~/eon-app/CLAUDE.md` for full CRM context.
