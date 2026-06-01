# EnhancedOps.ninja — Claude Code Context

This is the **public-facing Next.js app** at [enhancedops.ninja](https://enhancedops.ninja).  
It handles marketing, free assessments, and paid deep-dive assessments.  
The companion internal CRM (Ninja Dojo) lives in `~/eon-app`.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (Postgres + RLS) |
| Payments | Stripe |
| Email | Resend |
| PDF | @react-pdf/renderer |
| Deployment | Vercel (auto-deploy from `main`) |
| E2E Tests | Playwright (`npm run test:e2e`) |

---

## Project Structure

```
src/
  app/                   # Next.js App Router pages + API routes
    api/
      create-payment-intent/   # Stripe PI or MASTERTEST bypass
      complete-assessment/     # Saves scores + sends email via Resend
      health/                  # GET /api/health → {ok:true}
    deep-dive/
      page.tsx                 # /deep-dive — track selection + checkout (DeepDiveFlow)
      assessment/page.tsx      # /deep-dive/assessment — 45-question wizard
      score/page.tsx           # /deep-dive/score — results
  components/
    deep-dive/
      DeepDiveFlow.tsx          # Checkout flow (track → form → payment/bypass)
      DeepDiveAssessmentWizard.tsx  # Full wizard (welcome, module intros, questions)
  lib/
    deep-dive/
      assessment-data.ts        # Loads + parses config JSON through Zod
      assessment-scoring.ts     # pointsForChoice, moduleScorePercent, overallScorePercent
      assessment-storage.ts     # localStorage helpers (DEEP_DIVE_LS keys)
      pricing.ts                # Discount codes, Stripe pricing, formatUsd
    assessments/
      schema.ts                 # Zod schemas (assessmentConfigSchema, questionSchema)
    supabase/
      admin.ts                  # Supabase admin client (service role)
config/
  assessments/
    paid-healthcare.json        # 45 questions (44 MC + 1 open), 7 domains
    paid-business.json          # 43 questions (42 MC + 1 open), 7 domains
    free-healthcare.json
    free-business.json
e2e/
  paid-assessment.spec.ts       # Full flow e2e test (Playwright)
playwright.config.ts
```

---

## Assessment Flow

### Checkout (`/deep-dive`)
1. User selects track: `healthcare` or `business`
2. Fills contact form (firstName, lastName, email, phone, orgName)
3. Optionally applies a discount code
4. `POST /api/create-payment-intent` → Stripe PI or bypass
5. On payment/bypass → redirect to `/deep-dive/assessment`

### Wizard (`/deep-dive/assessment`)
- `DeepDiveAssessmentWizard` reads `businessType`, `assessmentId`, `email`, `firstName` from localStorage (persisted before Stripe redirect, also passed via URL params `dde`/`ddf`)
- Screens: welcome → module intro × 7 → question × 45
- Answers auto-saved to localStorage on every change
- On submit: `computeScoresFromAnswers` → `POST /api/complete-assessment` → `router.push(/deep-dive/score?os=...&ms=...)`

### Score Page (`/deep-dive/score`)
- Reads `os` and `ms` URL params (overall score + module scores JSON)
- Falls back to localStorage if params missing
- Shows score ring, tier label, module breakdown bars

---

## Scoring System

**File:** `src/lib/deep-dive/assessment-scoring.ts`

```
A = 3 points, B = 2, C = 1, D = 0
moduleScorePercent = (sum / (3 × count)) × 100
overallScorePercent = (totalPoints / (3 × scoredQuestions)) × 100
```

Open questions are excluded from scoring (only MC questions score).

**CRITICAL FIX (commit `0569414`):** The JSON config files don't have `type` fields on most questions. The Zod schema defaults missing `type` to `"multiple_choice"`, but this only applies when the config is **parsed through Zod** — not when it's just cast with `as AssessmentConfig`. `assessment-data.ts` now calls `assessmentConfigSchema.parse()` on both configs so defaults are applied. Do not revert this to a TypeScript cast.

---

## Discount Codes

| Code | Effect |
|---|---|
| `PILOT10` | $1,000 |
| `SILENTNINJA20` | $1,200 (20% off) |
| `TESTER4` | $1 |
| `MASTERTEST` | $0 — bypasses Stripe entirely |

`MASTERTEST` triggers `bypass: true` from `create-payment-intent`, which skips Stripe and goes directly to the assessment. Used in e2e tests.

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
CAL_COM_BOOKING_URL          # defaults to https://cal.com/enhancedopsninja/45-min-with-enhanced-ops-ninja
```

---

## Supabase Tables (enhanced-ops-ninja)

- `deep_dive_assessments` — one row per paid assessment
  - `id` (uuid), `assessment_answers` (jsonb), `assessment_score` (numeric), `module_scores` (jsonb), `assessment_completed_at` (timestamp)
  - Created by `create-payment-intent`, updated by `complete-assessment`

---

## E2E Tests

```bash
npm run test:e2e        # headless Chromium against https://enhancedops.ninja
npm run test:e2e:ui     # Playwright UI mode
```

**`e2e/paid-assessment.spec.ts`** covers the full healthcare track flow:
- Intercepts `create-payment-intent` and `complete-assessment` (no real DB/email on test runs)
- Selects Healthcare → MASTERTEST bypass → 45 questions (A for MC, open text for Q45) → asserts score > 0 + 7 module rows visible
- Q32 option B contains "next" — use `{ exact: true }` on the "Next" button selector

---

## Brand / Copy Rules

- Primary blue: `#1A6ECC` (this site) — **not** `#1A6BF9` (that's the eon-app)
- Logo: `/public/logo-transparent.png`
- Legal entity: **Augeo LLC** (dba EnhancedOps.ninja)
- Cal.com: `https://cal.com/enhancedopsninja/45-min-with-enhanced-ops-ninja`
- Email sender: `jeff@enhancedops.ninja`

---

## Key Rules for Agents

- **Always parse assessment configs through Zod** (`assessmentConfigSchema.parse()`), never cast with `as AssessmentConfig`
- **No TypeScript errors allowed** — run `npx tsc --noEmit` before committing
- **Auto-deploy on push to `main`** via Vercel — keep `main` green
- **Do not break the scoring fix** — `computeScoresFromAnswers` depends on `q.type` being populated by Zod defaults
- **Run the Playwright test** after any change to the assessment flow to confirm the fix is live in production
- Commit messages: lowercase imperative, max 72 chars, always add `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

---

## Relationship to eon-app (Ninja Dojo)

The `eon-app` is the **internal CRM** used by the EON team. It is a separate React + Vite app at `~/eon-app`. The two apps share:
- The same Supabase project (different tables)
- The same Cal.com booking link
- The same brand identity (Augeo LLC / EnhancedOps.ninja)

Deep-dive assessment data from this app feeds into the eon-app's Secret Mission Briefing generation. See `~/eon-app/CLAUDE.md` for full CRM context.
