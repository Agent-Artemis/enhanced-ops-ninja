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
| E2E Tests | Playwright | @playwright/test ^1.60 |
| Runtime | Node ≥20.9.0 or ≥22.0.0 | |

---

## Project Structure

```
src/
  app/
    api/
      health/                         GET  → { ok: true, service: "enhanced-ops-ninja" }
      assessment/
        config/                       GET  ?track=&tier= → question config payload
        session/                      POST/GET/DELETE — free assessment sessions
        answer/                       POST — save single answer (free flow)
        complete/                     POST — score + save + email (free flow)
      create-payment-intent/          POST — Stripe PI or MASTERTEST bypass
      complete-assessment/            POST — save scores + send completion email (paid flow)
      cal-webhook/                    POST — Cal.com booking → update appointment_scheduled_at
      in-depth-ops/
        create-checkout-session/      POST — premium ops track Stripe checkout
        save-answer/                  POST — save answer after payment verified
      ops-report/
        complete/                     POST — validate all 52 Qs, generate PDF
        generate-pdf/                 POST — generate PDF only
      stripe/
        webhook/                      POST — checkout.session.completed handler
    deep-dive/
      page.tsx                        /deep-dive — track select + checkout (DeepDiveFlow)
      assessment/page.tsx             /deep-dive/assessment — 45-question wizard
      score/page.tsx                  /deep-dive/score — results page
  components/
    deep-dive/
      DeepDiveFlow.tsx                3-step checkout (track → review → form + payment)
      DeepDiveAssessmentWizard.tsx    Full wizard: welcome, module intros, questions
  lib/
    deep-dive/
      assessment-data.ts              Loads JSON configs through Zod, maps to DeepDiveQuestion[]
      assessment-scoring.ts           pointsForChoice / moduleScorePercent / overallScorePercent
      assessment-storage.ts           localStorage helpers (DEEP_DIVE_LS key map)
      pricing.ts                      Discount codes, pricing logic, formatUsd
      insert-deep-dive-assessment.ts  INSERT with duplicate-email (23505) handling
    assessments/
      schema.ts                       Zod schemas — assessmentConfigSchema, questionSchema
      load.ts                         Config loader with in-memory cache
    scoring/
      compute.ts                      Free assessment scoring (A=5, B=4, C=3, D=1)
      points.ts                       LETTER_POINTS for free tier
    supabase/
      admin.ts                        getSupabaseAdmin() singleton (service role key)
  lib/assessment/
    public-config.ts                  Converts internal config to public payload
config/
  assessments/
    paid-healthcare.json              45 Qs: 44 MC + 1 open, 7 domains
    paid-business.json                43 Qs: 42 MC + 1 open, 7 domains
    free-healthcare.json
    free-business.json
e2e/
  paid-assessment.spec.ts             Playwright e2e — full healthcare paid flow
playwright.config.ts                  Target: https://enhancedops.ninja, Chromium headless
scripts/
  validate-paid-assessments.ts        Validates config JSON against Zod schema
  generate-sample-pdf.ts              Sample ops report PDF via Browserless API
```

---

## Assessment Tracks

### 1. Free Assessment
- Entry: marketing pages → free assessment wizard
- Stores session in `assessment_sessions` table (cookie: `eon_assessment_token`, 7-day)
- Saves each answer to `assessment_responses` (choice key A-D + points)
- On complete: scores saved to `assessment_scores`, lead upserted into `deep_dive_assessments`, confirmation email via Resend
- **Scoring: A=5, B=4, C=3, D=1** (operational maturity scale)
- Color bands: green ≥75, yellow ≥55, orange ≥35, red <35
- API files: `assessment/session`, `assessment/answer`, `assessment/complete`

### 2. Paid Deep-Dive (primary product — $1,500)
- Entry: `/deep-dive`
- 3-step checkout → Stripe payment or MASTERTEST bypass
- 45-question wizard (healthcare) or 43-question (business): 7 modules, 1 open question at end
- Answers auto-saved to localStorage on every change (survive Stripe redirect)
- `POST /api/complete-assessment` → saves to DB + sends Resend email with score + Cal.com link
- **Scoring: A=3, B=2, C=1, D=0**
- Module score % = `(sum / (3 × count)) × 100`; overall = same formula across all scored Qs

### 3. In-Depth Ops (separate premium track)
- Entry: separate checkout flow
- 52 questions, module-level scoring
- Stripe Checkout (not PaymentIntent) — stores in `ops_assessment_sessions`
- Saves answers to `ops_assessment_answers` (requires `stripe_status = 'paid'`)
- On complete: generates PDF via `generateOpsReportPdf()` (Browserless API)
- API files: `in-depth-ops/create-checkout-session`, `in-depth-ops/save-answer`, `ops-report/complete`, `ops-report/generate-pdf`

---

## Scoring — Two Separate Scales

| Track | A | B | C | D | Notes |
|---|---|---|---|---|---|
| Free | 5 | 4 | 3 | 1 | D skips to 1 (not 0) |
| Paid Deep-Dive | 3 | 2 | 1 | 0 | Linear scale |

These are intentionally different. Do not unify without product decision.

---

## Critical Fixes Made (Today's Session)

### 1. Zod Parse Fix for Question Type Defaults (`src/lib/deep-dive/assessment-data.ts`)
**Commit:** `0569414`  
**Problem:** 44 of 45 questions in the JSON configs have no `type` field. The Zod schema has `.default("multiple_choice")` but configs were loaded with `as AssessmentConfig` (a TypeScript cast) — no Zod processing, no defaults applied. `isMultipleChoiceQuestion()` returned false for every question → `computeScoresFromAnswers()` returned `overallScore: 0`, empty `moduleScores`.  
**Fix:** `CONFIG_BY_TRACK` now calls `assessmentConfigSchema.parse()` on both JSON files so Zod applies all defaults.  
**DO NOT REVERT** to `as AssessmentConfig` cast. Always parse through Zod.

```ts
// CORRECT
const CONFIG_BY_TRACK: Record<BusinessTrack, AssessmentConfig> = {
  healthcare: assessmentConfigSchema.parse(paidHealthcareConfig),
  business: assessmentConfigSchema.parse(paidBusinessConfig),
};

// WRONG — breaks scoring
const CONFIG_BY_TRACK = {
  healthcare: paidHealthcareConfig as AssessmentConfig,
  business: paidBusinessConfig as AssessmentConfig,
};
```

### 2. Score + Answers via URL Params (survive Stripe redirect)
**Commits:** `48e7eeb`, `2ffd155`, `ef5892d`  
After Stripe payment, the browser redirects back and localStorage is on a different origin path — email, firstName, and answers were lost. Fix:
- `email` passed as URL param `dde` (URL-encoded)
- `firstName` passed as URL param `ddf` (URL-encoded)  
- `answers` saved to localStorage key `deepDiveAnswers` before redirect, restored on mount
- `overallScore` + `moduleScores` passed to `/deep-dive/score` via `?os=...&ms=...` URL params
- Score page reads params first, falls back to localStorage

### 3. Unique Index Fix on `deep_dive_assessments.email`
**Commit:** `5807af6`  
The `create-payment-intent` route was failing on duplicate email submissions (Postgres error 23505). Fix: `insert-deep-dive-assessment.ts` now catches 23505 and returns the existing row's ID instead of throwing. Unique index on `email` column required in Supabase.

### 4. Playwright E2E Test Suite
**Commit:** `6f6ea38`  
Full e2e test at `e2e/paid-assessment.spec.ts`. Run with `npm run test:e2e`.  
Intercepts both API routes (no real DB/email side effects). Selects Healthcare track, applies MASTERTEST, completes all 45 questions (A for MC, open text for Q45), asserts score > 0 + 7 module rows visible.  
**Gotcha:** Q32 option B is "Voicemail — called back next business day" — the word "next" causes `getByRole('button', { name: 'Next' })` to match it. Must use `{ exact: true }`.

### 5. Supabase Trigger — Auto-create Client Cards from Assessments
**Commit:** `bc422c1` (in eon-app)  
When a free assessment completes in enhanced-ops-ninja, a Supabase DB trigger creates a client card in the eon-app's `clients` table with pipeline stage `free_assessment_complete`. This links the two apps via shared Supabase project.

---

## Checkout Flow Details (`DeepDiveFlow.tsx`)

### Steps
1. **Step 0** — Track selection: `healthcare` | `business`
2. **Step 1** — "What you get" sales copy, "Continue to checkout →"
3. **Step 2** — Form: firstName, lastName, email, phone, orgName + discount/affiliate codes + Stripe PaymentElement

### Discount Codes (case-insensitive, hardcoded in `pricing.ts`)

| Code | Amount | Behavior |
|---|---|---|
| `PILOT10` | $1,000 | 50% off |
| `SILENTNINJA20` | $1,200 | 20% off |
| `TESTER4` | $1 | Test checkout |
| `MASTERTEST` | $0 | Full bypass — no Stripe |

When `amountPaid === 0`: `create-payment-intent` returns `{ bypass: true, assessmentId, clientSecret: null }` and the app routes directly to `/deep-dive/assessment` without Stripe.

### Affiliate Codes
- Pattern: 5-char alphanumeric (`/^[A-Z0-9]{5}$/`)
- Known: `["7SJM1"]`
- Affiliate does not affect price — metadata only

---

## Assessment Wizard Details (`DeepDiveAssessmentWizard.tsx`)

### Screen Order (53 total for healthcare)
```
Screen 0:    Welcome ("You're in")
Screen 1:    Module intro 1 (financials_revenue, 7 Qs)
Screens 2-8: Questions 1–7 (all MC)
Screen 9:    Module intro 2 (staffing_hr, 7 Qs)
...continues for all 7 modules...
Screen 52:   Question 45 — OPEN TEXT (hc_p_45, labor_costs domain)
```

### Screen Buttons
- Welcome: "Start"
- Module intro: "Begin questions"
- Regular question: "Next" (`exact: true` required in tests — see Q32 gotcha)
- Last question (open text): "Submit assessment"

### LocalStorage Keys (`DEEP_DIVE_LS`)
| Key | Value |
|---|---|
| `deepDiveAssessmentId` | UUID from create-payment-intent |
| `businessType` | `"healthcare"` or `"business"` |
| `deepDiveEmail` | user email |
| `deepDiveFirstName` | first name |
| `deepDiveAnswers` | JSON stringified `Record<string, string>` |
| `deepDiveOverallScore` | string number |
| `deepDiveModuleScores` | JSON stringified `Record<string, number>` |

---

## Supabase Tables

### Tables managed by this app

**`assessment_sessions`** — Free tier sessions  
`id`, `track`, `tier`, `status` (in_progress|completed), `client_token`, `name`, `email`, `contact_captured_at`, `completed_at`

**`assessment_responses`** — Free tier answers  
`session_id`, `question_id`, `choice_key` (A-D), `points`

**`assessment_scores`** — Free tier aggregate scores  
`session_id`, `overall_score`, `domain_scores` (JSON), `scoring_version`, `computed_at`

**`deep_dive_assessments`** — Paid deep-dive (both free completion upsert + paid checkout)  
`id`, `first_name`, `last_name`, `email` (unique index), `phone`, `org_name`, `business_type`, `amount_paid`, `stripe_payment_intent_id`, `assessment_answers` (jsonb), `assessment_score` (numeric), `module_scores` (jsonb), `assessment_completed_at`, `appointment_scheduled_at`, `created_at`

**`ops_assessment_sessions`** — In-depth ops track  
`id`, `client_name`, `client_email`, `organization_name`, `annual_revenue`, `team_size`, `track`, `status`, `stripe_status`, `stripe_payment_id`, `started_at`, `completed_at`, `report_generated`, `report_url`, `report_generated_at`

**`ops_assessment_answers`** — In-depth ops answers  
`session_id`, `module_number`, `module_name`, `question_number`, `question_key`, `question_text`, `answer_choice`, `answer_points`

> **Note:** No Supabase migration files for these tables exist in this repo. Schema lives only in the Supabase dashboard.

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET

# Email
RESEND_API_KEY

# Cal.com (optional — has hardcoded fallback)
CAL_COM_BOOKING_URL   # default: https://cal.com/enhancedopsninja/45-min-with-enhanced-ops-ninja

# Free assessment session cookie
ASSESSMENT_SESSION_COOKIE_MAX_AGE   # default: 7 days
```

---

## Path Aliases (`tsconfig.json`)

```json
"@/*"       → "./src/*"
"@config/*" → "./config/*"
```

---

## E2E Tests

```bash
npm run test:e2e        # headless Chromium against https://enhancedops.ninja
npm run test:e2e:ui     # Playwright interactive UI mode
```

Test intercepts `create-payment-intent` and `complete-assessment` — no production DB records or emails created per run. Passes in ~17 seconds.

---

## Scripts

```bash
npm run dev                       # Next.js dev server (Turbopack)
npm run build                     # Production build
npm run validate:paid-assessments # Validate config JSONs against Zod schema
npm run generate:sample-pdf       # Generate sample ops report PDF
npm run test:e2e                  # Playwright e2e
npm run test:e2e:ui               # Playwright UI
```

---

## Brand & Config

- **Primary blue (this site):** `#1A6ECC` — not `#1A6BF9` (that's the eon-app)
- **Logo:** `/public/logo-transparent.png`
- **Legal entity:** Augeo LLC (dba EnhancedOps.ninja)
- **Cal.com:** `https://cal.com/enhancedopsninja/45-min-with-enhanced-ops-ninja`
- **Email from:** `jeff@enhancedops.ninja`

---

## Key Rules for Agents

1. **Always parse assessment configs through Zod** — `assessmentConfigSchema.parse()`, never `as AssessmentConfig`. This is what makes scoring work.
2. **`npx tsc --noEmit` must pass** before every commit. The project uses strict TypeScript.
3. **`main` branch auto-deploys to Vercel** — keep it green.
4. **Run `npm run test:e2e` after any change to the assessment wizard or scoring** to confirm the full flow works in production.
5. **Two scoring scales exist by design** — free (1-5) and paid (0-3). Do not consolidate without explicit instruction.
6. **Commit format:** lowercase imperative, max 72 chars, always include `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

---

## Relationship to eon-app (Ninja Dojo)

Both apps share the same Supabase project. When a free assessment completes here, a DB trigger creates a client card in the eon-app's `clients` table at pipeline stage `free_assessment_complete`. Paid deep-dive data feeds into the Secret Mission Briefing generation in the eon-app. See `~/eon-app/CLAUDE.md` for full CRM context.
