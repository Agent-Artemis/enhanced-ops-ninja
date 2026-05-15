# EnhancedOps.ninja — Full Cursor Build Package
### Complete Claude → Cursor Handoff | Paste this entire document into Claude, then hand to Cursor

---

> **HOW TO USE THIS DOCUMENT**
> 1. Open Claude (claude.ai or Claude in Cursor)
> 2. Paste this entire document as your first message
> 3. Claude will read the full spec and begin building
> 4. Every file path, function, and data structure is defined — Claude should not need to ask questions
> 5. After Claude generates each file, paste it into Cursor at the specified path

---

# SECTION 1: PROJECT OVERVIEW

You are building a web-based business operations assessment system for **EnhancedOps.ninja**.

The live site is at: `https://enhanced-ops-ninja.vercel.app`
Stack: **Next.js 14 (App Router) + Supabase + Stripe + Vercel + Browserless**
Language: **TypeScript throughout**

## What This System Does

1. Client pays via Stripe checkout
2. Client completes a 52-question assessment (Healthcare or General Business track)
3. Every answer saves to Supabase in real time
4. On completion: scores auto-calculate, dollar-loss figures auto-generate, a full PDF report renders automatically
5. Client sees a teaser score screen and books a review call
6. Jeff gets an admin notification with the PDF attached

## The Output
A fully branded, 13-page PDF report that:
- Shows an overall Operations Health Score (0–100)
- Breaks down 8 modules with scores, status (RED/YELLOW/GREEN), and calculated dollar losses
- Shows the math behind every dollar figure
- Includes module findings, action items, offer recommendations, and a phased roadmap
- Is generated automatically — no manual work required

---

# SECTION 2: COMPLETE FILE STRUCTURE

Create every file listed below. Do not skip any.

```
enhanced-ops-ninja/
├── app/
│   ├── api/
│   │   ├── stripe/
│   │   │   └── webhook/route.ts
│   │   ├── complete-assessment/route.ts
│   │   └── generate-report-pdf/route.ts
│   ├── assessment/
│   │   ├── [session_id]/
│   │   │   ├── page.tsx          (assessment questions UI)
│   │   │   └── results/page.tsx  (teaser score screen)
│   │   └── page.tsx              (track selection + Stripe CTA)
│   └── admin/
│       └── reports/page.tsx      (Jeff's admin view)
├── lib/
│   ├── report-template.ts        (generateReportHTML function)
│   ├── report-builder.ts         (buildReportData from Supabase)
│   ├── scoring.ts                (all scoring logic)
│   ├── finding-text.ts           (all 52 finding strings)
│   ├── module-actions.ts         (action bullets per module)
│   └── supabase.ts               (client + server instances)
├── types/
│   └── report.ts                 (ReportData + all interfaces)
├── scripts/
│   └── generate-sample-pdf.ts    (generates Smith's sample PDF)
└── public/
    └── sample-report.pdf         (output of generate-sample-pdf.ts)
```

---

# SECTION 3: ENVIRONMENT VARIABLES

Create `.env.local` with these exact keys:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_signing_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_PRICE_ID_INDEPTH=your_stripe_price_id_for_indepth_assessment

BLESS_TOKEN=your_browserless_api_token

RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=jeff@enhancedops.ninja

NEXT_PUBLIC_SITE_URL=https://enhanced-ops-ninja.vercel.app
ADMIN_SECRET=choose_a_strong_secret_for_admin_route
CAL_BOOKING_URL=https://cal.com/jeffoldroyd/review
```

---

# SECTION 4: SUPABASE SCHEMA

Run this SQL in your Supabase SQL editor to create all tables:

```sql
-- TABLE 1: assessment_sessions
CREATE TABLE assessment_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT now(),
  client_name         TEXT NOT NULL,
  client_email        TEXT NOT NULL,
  organization_name   TEXT,
  annual_revenue      NUMERIC,
  team_size           INTEGER,
  track               TEXT CHECK (track IN ('healthcare','general_business')),
  assessment_type     TEXT DEFAULT 'in_depth',
  stripe_payment_id   TEXT UNIQUE,
  stripe_status       TEXT DEFAULT 'pending',
  status              TEXT DEFAULT 'not_started',
  started_at          TIMESTAMP WITH TIME ZONE,
  completed_at        TIMESTAMP WITH TIME ZONE,
  current_module      INTEGER DEFAULT 1,
  current_question    INTEGER DEFAULT 1,
  cal_booking_id      TEXT,
  call_scheduled_at   TIMESTAMP WITH TIME ZONE,
  report_generated    BOOLEAN DEFAULT false,
  report_url          TEXT,
  report_generated_at TIMESTAMP WITH TIME ZONE
);

-- TABLE 2: assessment_answers
CREATE TABLE assessment_answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
  module_number   INTEGER NOT NULL,
  module_name     TEXT NOT NULL,
  question_number INTEGER NOT NULL,
  question_key    TEXT NOT NULL,
  question_text   TEXT,
  answer_choice   TEXT CHECK (answer_choice IN ('A','B','C','D')),
  answer_points   INTEGER CHECK (answer_points IN (1,2,3,4)),
  UNIQUE(session_id, question_key)
);

-- TABLE 3: module_scores
CREATE TABLE module_scores (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  calculated_at           TIMESTAMP WITH TIME ZONE DEFAULT now(),
  module_number           INTEGER NOT NULL,
  module_name             TEXT NOT NULL,
  questions_answered      INTEGER,
  raw_points_earned       INTEGER,
  max_possible_points     INTEGER,
  module_score_pct        NUMERIC(5,2),
  module_weight           NUMERIC(4,3),
  weighted_score          NUMERIC(5,2),
  status_color            TEXT CHECK (status_color IN ('RED','YELLOW','GREEN')),
  dollar_loss_calculated  NUMERIC,
  dollar_loss_label       TEXT,
  recommended_offer       TEXT,
  recommended_offer_desc  TEXT,
  deployment_timeline     TEXT,
  expected_impact         TEXT,
  UNIQUE(session_id, module_number)
);

-- TABLE 4: assessment_reports
CREATE TABLE assessment_reports (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id               UUID REFERENCES assessment_sessions(id) ON DELETE CASCADE UNIQUE,
  generated_at             TIMESTAMP WITH TIME ZONE DEFAULT now(),
  overall_score            NUMERIC(5,2),
  overall_status           TEXT CHECK (overall_status IN ('RED','YELLOW','GREEN')),
  total_dollar_loss        NUMERIC,
  total_dollar_loss_label  TEXT,
  priority_1_module        TEXT,
  priority_1_finding       TEXT,
  priority_2_module        TEXT,
  priority_2_finding       TEXT,
  priority_3_module        TEXT,
  priority_3_finding       TEXT,
  phase_1_recommendations  JSONB,
  phase_2_recommendations  JSONB,
  phase_3_recommendations  JSONB,
  full_report_json         JSONB,
  pdf_url                  TEXT,
  pdf_generated            BOOLEAN DEFAULT false
);

-- STORAGE BUCKET for PDFs
-- Run this in Supabase dashboard → Storage → New Bucket
-- Name: assessment-reports
-- Public: true (so PDF links work without auth)
```

---

# SECTION 5: TYPES — `/types/report.ts`

```typescript
export interface ModuleResult {
  module_number:                 number
  module_name:                   string
  module_score_pct:              number
  status_color:                  'RED' | 'YELLOW' | 'GREEN'
  dollar_loss_calculated:        number
  dollar_loss_label:             string
  recommended_offer:             string
  recommended_offer_description: string
  deployment_timeline:           string
  expected_impact:               string
  findings:                      string[]
  actions:                       string[]
  calc_table: {
    input: string
    value: string
    source: string
  }[]
}

export interface PhaseItem {
  module:         string
  offer:          string
  target_outcome: string
  dollar_recovery: string
}

export interface AnswerRow {
  module_name:     string
  question_number: number
  question_text:   string
  answer_choice:   string
  answer_points:   number
}

export interface ReportData {
  client_name:           string
  organization_name:     string
  track:                 'healthcare' | 'general_business'
  completed_at:          string
  annual_revenue:        number
  team_size:             number
  overall_score:         number
  overall_status:        'RED' | 'YELLOW' | 'GREEN'
  total_dollar_loss:     number
  total_dollar_loss_label: string
  executive_narrative:   string
  total_points_earned:   number
  max_possible_points:   number
  priority_1_module:     string
  priority_1_finding:    string
  priority_2_module:     string
  priority_2_finding:    string
  priority_3_module:     string
  priority_3_finding:    string
  modules:               ModuleResult[]
  phase_1_recommendations: PhaseItem[]
  phase_2_recommendations: PhaseItem[]
  phase_3_recommendations: PhaseItem[]
  answers:               AnswerRow[]
}
```

---

# SECTION 6: SCORING LOGIC — `/lib/scoring.ts`

```typescript
export const POINT_MAP: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 }

export const MODULE_CONFIG = [
  { number: 1, name: 'Financial Health & Revenue',          maxQuestions: 7,  weight: 0.15 },
  { number: 2, name: 'Staffing & HR Operations',            maxQuestions: 7,  weight: 0.15 },
  { number: 3, name: 'Accounts Receivable & Collections',   maxQuestions: 8,  weight: 0.15 },
  { number: 4, name: 'Manual Tasks & Automation Readiness', maxQuestions: 6,  weight: 0.15 },
  { number: 5, name: 'Phone Systems & Communication',       maxQuestions: 5,  weight: 0.10 },
  { number: 6, name: 'Staff Roles & Org Structure',         maxQuestions: 5,  weight: 0.10 },
  { number: 7, name: 'Labor Costs & Workforce Economics',   maxQuestions: 6,  weight: 0.10 },
  { number: 8, name: 'Marketing & Growth',                  maxQuestions: 8,  weight: 0.10 },
]

export function getStatus(pct: number): 'RED' | 'YELLOW' | 'GREEN' {
  if (pct >= 80) return 'GREEN'
  if (pct >= 55) return 'YELLOW'
  return 'RED'
}

export function getStatusLabel(s: string) {
  return { RED: 'CRITICAL', YELLOW: 'AT RISK', GREEN: 'OPTIMIZED' }[s] ?? s
}

export function getStatusEmoji(s: string) {
  return { RED: '🔴', YELLOW: '🟡', GREEN: '🟢' }[s] ?? ''
}

export function getStatusColor(s: string) {
  return { RED: '#ef4444', YELLOW: '#f59e0b', GREEN: '#22c55e' }[s] ?? '#ffffff'
}

// ── DOLLAR LOSS CALCULATIONS ──
// Each function takes the client's actual revenue and team_size
// and returns a calculated dollar loss based on their score + benchmarks

export function calcModuleDollarLoss(
  moduleNumber: number,
  scorePct: number,
  status: string,
  annualRevenue: number,
  teamSize: number,
  answers: { question_key: string; answer_points: number }[]
): { amount: number; label: string; calcTable: { input: string; value: string; source: string }[] } {

  if (status === 'GREEN') return { amount: 0, label: '—', calcTable: [] }

  const gap = (100 - scorePct) / 100  // how far below perfect

  switch (moduleNumber) {

    case 1: { // Financial Health
      // Gap vs. 14% benchmark operating margin
      const reportedMarginPct = scorePct >= 70 ? 0.11 : scorePct >= 55 ? 0.08 : 0.05
      const benchmarkMargin   = 0.14
      const marginGap         = Math.max(0, benchmarkMargin - reportedMarginPct)
      const amount            = Math.round(annualRevenue * marginGap)
      return {
        amount,
        label: `$${(amount/1000).toFixed(0)}K`,
        calcTable: [
          { input: 'Annual revenue',           value: `$${(annualRevenue/1000).toFixed(0)}K`,  source: 'Client provided' },
          { input: 'Reported operating margin',value: `~${(reportedMarginPct*100).toFixed(0)}%`, source: 'Assessment answer (Q5)' },
          { input: 'Industry benchmark margin',value: '14%',                                    source: 'SMB industry average' },
          { input: 'Margin gap',               value: `${(marginGap*100).toFixed(0)} points`,  source: 'Benchmark minus reported' },
          { input: 'Calculated annual loss',   value: `$${(annualRevenue/1000).toFixed(0)}K × ${(marginGap*100).toFixed(0)}% = $${(amount/1000).toFixed(0)}K`, source: '' },
        ]
      }
    }

    case 2: { // Staffing
      const turnoverRate      = scorePct >= 70 ? 0.18 : scorePct >= 55 ? 0.28 : 0.38
      const benchmarkTurnover = 0.15
      const extraDepartures   = Math.max(0, (turnoverRate - benchmarkTurnover) * teamSize)
      const replacementCost   = 18000
      const amount            = Math.round(extraDepartures * replacementCost)
      return {
        amount,
        label: `$${(amount/1000).toFixed(0)}K`,
        calcTable: [
          { input: 'Team size',                value: `${teamSize} FTEs`,                       source: 'Client provided' },
          { input: 'Reported turnover rate',   value: `~${(turnoverRate*100).toFixed(0)}%`,     source: 'Assessment answer' },
          { input: 'Benchmark turnover',       value: '15%',                                    source: 'SHRM 2024 SMB average' },
          { input: 'Extra departures/yr',      value: extraDepartures.toFixed(1),               source: `(${(turnoverRate*100).toFixed(0)}% − 15%) × ${teamSize} FTEs` },
          { input: 'Replacement cost/person',  value: '$18,000',                                source: 'SHRM 2024 conservative midpoint' },
          { input: 'Calculated annual loss',   value: `${extraDepartures.toFixed(1)} × $18,000 = $${(amount/1000).toFixed(0)}K`, source: '' },
        ]
      }
    }

    case 3: { // AR & Collections
      const dso             = scorePct >= 70 ? 35 : scorePct >= 55 ? 42 : 58
      const arBalance       = (annualRevenue / 365) * dso * 2.4
      const badDebtRate     = scorePct >= 70 ? 0.015 : scorePct >= 55 ? 0.03 : 0.05
      const badDebt         = arBalance * badDebtRate
      const carryingCost    = arBalance * 0.075
      const amount          = Math.round(badDebt + carryingCost)
      return {
        amount,
        label: `$${(amount/1000).toFixed(0)}K`,
        calcTable: [
          { input: 'Annual revenue',          value: `$${(annualRevenue/1000).toFixed(0)}K`,     source: 'Client provided' },
          { input: 'Average DSO',             value: `~${dso} days`,                             source: 'Assessment answer (Q3)' },
          { input: 'Estimated AR balance',    value: `$${(arBalance/1000).toFixed(0)}K`,         source: `$${(annualRevenue/1000).toFixed(0)}K ÷ 365 × ${dso} days` },
          { input: 'Bad debt write-off rate', value: `${(badDebtRate*100).toFixed(1)}%`,         source: 'Assessment answer (Q8)' },
          { input: 'Bad debt annual cost',    value: `$${(badDebt/1000).toFixed(0)}K`,           source: `$${(arBalance/1000).toFixed(0)}K × ${(badDebtRate*100).toFixed(1)}%` },
          { input: 'Carrying cost on AR',     value: `$${(carryingCost/1000).toFixed(0)}K`,     source: '$AR balance × 7.5% (prime + spread)' },
          { input: 'Calculated annual loss',  value: `$${(badDebt/1000).toFixed(0)}K + $${(carryingCost/1000).toFixed(0)}K = $${(amount/1000).toFixed(0)}K`, source: '' },
        ]
      }
    }

    case 4: { // Automation
      const manualHoursPerWeek = scorePct >= 70 ? 8 : scorePct >= 55 ? 12 : 18
      const loadedRate         = 28
      const amount             = Math.round(manualHoursPerWeek * loadedRate * 52)
      return {
        amount,
        label: `$${(amount/1000).toFixed(0)}K`,
        calcTable: [
          { input: 'Automatable admin hrs/wk', value: `${manualHoursPerWeek} hrs`,              source: 'Assessment answer (Q1) — conservative estimate' },
          { input: 'Loaded labor cost/hr',     value: '$28/hr',                                 source: 'Wages + 40% benefits/overhead burden' },
          { input: 'Calculated annual loss',   value: `${manualHoursPerWeek} × $28 × 52 = $${(amount/1000).toFixed(0)}K`, source: 'Labor cost of automatable work' },
        ]
      }
    }

    case 5: { // Phone Systems
      const missedCallRate  = scorePct >= 70 ? 0.06 : scorePct >= 55 ? 0.12 : 0.20
      const leadsPerMonth   = Math.round(annualRevenue / 12 / 3500 * 1.4)
      const avgTxnValue     = Math.round(annualRevenue / (annualRevenue / 3500))
      const lostLeadsPerYr  = Math.round(leadsPerMonth * missedCallRate * 12)
      const amount          = Math.round(lostLeadsPerYr * avgTxnValue)
      return {
        amount,
        label: `$${(amount/1000).toFixed(0)}K`,
        calcTable: [
          { input: 'Est. inbound leads/month',   value: `${leadsPerMonth}`,                    source: 'Revenue ÷ avg. transaction value' },
          { input: 'Missed/mishandled call rate', value: `${(missedCallRate*100).toFixed(0)}%`, source: 'Assessment answers (Q2, Q3, Q5)' },
          { input: 'Lost leads per year',         value: `${lostLeadsPerYr}`,                  source: `${leadsPerMonth} × ${(missedCallRate*100).toFixed(0)}% × 12 months` },
          { input: 'Avg. transaction value',      value: `$${(avgTxnValue/1000).toFixed(1)}K`, source: 'Revenue ÷ est. annual transactions' },
          { input: 'Calculated annual loss',      value: `${lostLeadsPerYr} × $${(avgTxnValue/1000).toFixed(1)}K = $${(amount/1000).toFixed(0)}K`, source: '' },
        ]
      }
    }

    case 6: { // Org Structure
      const mgmtHoursWasted = scorePct >= 70 ? 2 : scorePct >= 55 ? 4 : 7
      const mgmtRate        = 42
      const reworkCost      = mgmtHoursWasted * mgmtRate * 52
      const disruptionCost  = scorePct >= 70 ? 4000 : scorePct >= 55 ? 10000 : 18000
      const amount          = Math.round(reworkCost + disruptionCost)
      return {
        amount,
        label: `$${(amount/1000).toFixed(0)}K`,
        calcTable: [
          { input: 'Mgmt rework hrs/wk (over-escalation)', value: `${mgmtHoursWasted} hrs`,   source: 'Assessment answer (Q3)' },
          { input: 'Manager loaded rate',                  value: '$42/hr',                   source: 'Senior staff rate estimate' },
          { input: 'Annual rework cost',                   value: `$${(reworkCost/1000).toFixed(0)}K`, source: `${mgmtHoursWasted} × $42 × 52 wks` },
          { input: 'Key-person disruption cost/yr',        value: `$${(disruptionCost/1000).toFixed(0)}K`, source: 'Assessment (Q5) — coverage gaps × avg disruption' },
          { input: 'Calculated annual loss',               value: `$${(reworkCost/1000).toFixed(0)}K + $${(disruptionCost/1000).toFixed(0)}K = $${(amount/1000).toFixed(0)}K`, source: '' },
        ]
      }
    }

    case 7: { // Labor Costs
      const totalLaborCost   = teamSize * 52000
      const efficiencyGap    = scorePct >= 70 ? 0.04 : scorePct >= 55 ? 0.075 : 0.12
      const grossOpportunity = totalLaborCost * efficiencyGap
      const nonAddressable   = grossOpportunity * 0.23
      const amount           = Math.round(grossOpportunity - nonAddressable)
      return {
        amount,
        label: `$${(amount/1000).toFixed(0)}K`,
        calcTable: [
          { input: 'Team size',                value: `${teamSize} FTEs`,                      source: 'Client provided' },
          { input: 'Avg loaded cost/FTE',      value: '$52,000/yr',                            source: 'Wages + benefits + overhead' },
          { input: 'Total annual labor cost',  value: `$${(totalLaborCost/1000).toFixed(0)}K`, source: `${teamSize} × $52,000` },
          { input: 'Efficiency gap vs. bench', value: `${(efficiencyGap*100).toFixed(1)}%`,    source: 'Untracked OT + manual workflows + no benchmarking' },
          { input: 'Gross opportunity',        value: `$${(grossOpportunity/1000).toFixed(0)}K`, source: `$${(totalLaborCost/1000).toFixed(0)}K × ${(efficiencyGap*100).toFixed(1)}%` },
          { input: 'Minus non-addressable',    value: `$${(nonAddressable/1000).toFixed(0)}K`, source: 'Fixed structural labor (23%)' },
          { input: 'Calculated annual loss',   value: `$${(amount/1000).toFixed(0)}K`,         source: 'Net addressable efficiency gap' },
        ]
      }
    }

    case 8: { // Marketing
      const currentGrowthRate   = 0.04   // word-of-mouth only = ~4%/yr
      const benchmarkGrowthRate = 0.13   // active digital + referral system
      const addressableGap      = benchmarkGrowthRate - currentGrowthRate
      const amount              = Math.round(annualRevenue * addressableGap)
      return {
        amount,
        label: `$${(amount/1000).toFixed(0)}K`,
        calcTable: [
          { input: 'Current annual revenue',         value: `$${(annualRevenue/1000).toFixed(0)}K`, source: 'Client provided' },
          { input: 'Estimated growth (word-of-mouth only)', value: '~4%/yr',                       source: 'Implied by D answers on Q3, Q4' },
          { input: 'Benchmark growth (active mktg)', value: '~13%/yr',                             source: 'SMB avg with digital + referral system' },
          { input: 'Addressable gap',                value: `${(addressableGap*100).toFixed(1)} points`, source: '13% − 4% = 9% addressable' },
          { input: 'Calculated annual opportunity',  value: `$${(annualRevenue/1000).toFixed(0)}K × ${(addressableGap*100).toFixed(1)}% = $${(amount/1000).toFixed(0)}K`, source: '' },
        ]
      }
    }

    default: return { amount: 0, label: '—', calcTable: [] }
  }
}
```

---

# SECTION 7: REPORT BUILDER — `/lib/report-builder.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import { ReportData, ModuleResult, PhaseItem, AnswerRow } from '@/types/report'
import { MODULE_CONFIG, POINT_MAP, getStatus, getStatusLabel, calcModuleDollarLoss } from './scoring'
import { FINDING_TEXT } from './finding-text'
import { MODULE_ACTIONS, OFFER_MAP } from './module-actions'

export async function buildReportData(
  supabase: SupabaseClient,
  session_id: string
): Promise<ReportData> {

  // 1. Fetch session
  const { data: session } = await supabase
    .from('assessment_sessions')
    .select('*')
    .eq('id', session_id)
    .single()

  const annualRevenue = session.annual_revenue ?? 2100000
  const teamSize      = session.team_size      ?? 18
  const track         = session.track          ?? 'general_business'

  // 2. Fetch answers
  const { data: answers } = await supabase
    .from('assessment_answers')
    .select('*')
    .eq('session_id', session_id)
    .order('module_number', { ascending: true })
    .order('question_number', { ascending: true })

  // 3. Calculate module scores
  const modules: ModuleResult[] = MODULE_CONFIG.map(cfg => {
    const moduleAnswers = answers?.filter(a => a.module_number === cfg.number) ?? []
    const rawPoints     = moduleAnswers.reduce((sum, a) => sum + (a.answer_points ?? 0), 0)
    const maxPoints     = cfg.maxQuestions * 4
    const scorePct      = maxPoints > 0 ? (rawPoints / maxPoints) * 100 : 0
    const status        = getStatus(scorePct)

    const dollarCalc = calcModuleDollarLoss(
      cfg.number, scorePct, status, annualRevenue, teamSize, moduleAnswers
    )

    // Get 2 lowest-scoring answers for findings
    const weakAnswers = [...moduleAnswers]
      .sort((a, b) => (a.answer_points ?? 4) - (b.answer_points ?? 4))
      .slice(0, 2)

    const findings = weakAnswers
      .map(a => FINDING_TEXT[a.question_key]?.[status])
      .filter(Boolean) as string[]

    const actions  = MODULE_ACTIONS[track]?.[cfg.number]?.[status] ?? []
    const offerMap = OFFER_MAP[track]?.[cfg.number]

    return {
      module_number:                 cfg.number,
      module_name:                   cfg.name,
      module_score_pct:              scorePct,
      status_color:                  status,
      dollar_loss_calculated:        dollarCalc.amount,
      dollar_loss_label:             dollarCalc.label,
      recommended_offer:             offerMap?.offer             ?? '',
      recommended_offer_description: offerMap?.desc              ?? '',
      deployment_timeline:           offerMap?.timeline          ?? '30–60 day deployment',
      expected_impact:               offerMap?.impact            ?? '',
      findings,
      actions,
      calc_table:                    dollarCalc.calcTable,
    }
  })

  // 4. Overall score
  const overallScore  = modules.reduce((sum, m) => {
    const cfg = MODULE_CONFIG.find(c => c.number === m.module_number)!
    return sum + (m.module_score_pct * cfg.weight)
  }, 0)
  const overallStatus = getStatus(overallScore)

  // 5. Total dollar loss
  const totalDollarLoss = modules.reduce((sum, m) => sum + m.dollar_loss_calculated, 0)
  const totalLabel      = `$${(totalDollarLoss / 1000).toFixed(0)}K`

  // 6. Executive narrative
  const narrativeMap = {
    RED:    `${session.organization_name} has significant operational exposure across multiple areas. The findings in this report identify specific gaps currently costing an estimated ${totalLabel} per year. Every gap identified has a clear, implementable solution — the path forward is laid out in detail below.`,
    YELLOW: `${session.organization_name} is functional — and that's exactly the problem. You've built something real. But this assessment reveals a business running harder than it needs to, on systems built for a smaller version of what you're trying to become. The ${totalLabel} in this report is not a penalty — it's your roadmap.`,
    GREEN:  `${session.organization_name} is running well. A targeted set of improvement opportunities exists, and the recommendations below will help you protect what's working and push toward your next level of growth.`,
  }

  // 7. Top 3 priority modules by dollar loss
  const sortedByDollar = [...modules]
    .filter(m => m.status_color !== 'GREEN')
    .sort((a, b) => b.dollar_loss_calculated - a.dollar_loss_calculated)

  // 8. Roadmap phases
  const sortedByImpact = [...modules]
    .filter(m => m.status_color !== 'GREEN')
    .sort((a, b) => {
      if (a.status_color === 'RED' && b.status_color !== 'RED') return -1
      if (b.status_color === 'RED' && a.status_color !== 'RED') return 1
      return b.dollar_loss_calculated - a.dollar_loss_calculated
    })

  const toPhaseItem = (m: ModuleResult): PhaseItem => ({
    module:          m.module_name,
    offer:           m.recommended_offer,
    target_outcome:  m.expected_impact,
    dollar_recovery: m.dollar_loss_label,
  })

  // 9. Answer rows for appendix
  const answerRows: AnswerRow[] = (answers ?? []).map(a => ({
    module_name:     a.module_name,
    question_number: a.question_number,
    question_text:   a.question_text ?? '',
    answer_choice:   a.answer_choice ?? '',
    answer_points:   a.answer_points ?? 0,
  }))

  return {
    client_name:           session.client_name,
    organization_name:     session.organization_name ?? session.client_name,
    track,
    completed_at:          new Date(session.completed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    annual_revenue:        annualRevenue,
    team_size:             teamSize,
    overall_score:         overallScore,
    overall_status:        overallStatus,
    total_dollar_loss:     totalDollarLoss,
    total_dollar_loss_label: totalLabel,
    executive_narrative:   narrativeMap[overallStatus],
    total_points_earned:   answers?.reduce((s, a) => s + (a.answer_points ?? 0), 0) ?? 0,
    max_possible_points:   208,
    priority_1_module:     sortedByDollar[0]?.module_name   ?? '',
    priority_1_finding:    sortedByDollar[0]?.findings[0]   ?? '',
    priority_2_module:     sortedByDollar[1]?.module_name   ?? '',
    priority_2_finding:    sortedByDollar[1]?.findings[0]   ?? '',
    priority_3_module:     sortedByDollar[2]?.module_name   ?? '',
    priority_3_finding:    sortedByDollar[2]?.findings[0]   ?? '',
    modules,
    phase_1_recommendations: sortedByImpact.slice(0, 2).map(toPhaseItem),
    phase_2_recommendations: sortedByImpact.slice(2, 4).map(toPhaseItem),
    phase_3_recommendations: sortedByImpact.slice(4).map(toPhaseItem),
    answers:               answerRows,
  }
}
```

---

# SECTION 8: SAMPLE PDF GENERATION SCRIPT — `/scripts/generate-sample-pdf.ts`

```typescript
// Run with: npx ts-node --project tsconfig.json scripts/generate-sample-pdf.ts
// Output: /public/sample-report.pdf

import fs from 'fs'
import path from 'path'
import { generateReportHTML } from '../lib/report-template'
import { ReportData } from '../types/report'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const SMITHS_DATA: ReportData = {
  client_name:           'Michael Smith',
  organization_name:     "Smith's General Business",
  track:                 'general_business',
  completed_at:          'May 14, 2026',
  annual_revenue:        2100000,
  team_size:             18,
  overall_score:         55,
  overall_status:        'YELLOW',
  total_dollar_loss:     647500,
  total_dollar_loss_label: '$647K',
  executive_narrative:   "Smith's General Business is functional — and that's exactly the problem. You've built something real. But this assessment reveals a business running harder than it needs to, on systems built for a smaller version of what you're trying to become. The $647K identified in this report is not a penalty — it's your roadmap.",
  total_points_earned:   110,
  max_possible_points:   208,
  priority_1_module:     'Marketing & Growth',
  priority_1_finding:    'No lead capture, no paid advertising, no referral system — Smith\'s is relying entirely on word of mouth. This is a ceiling, not a strategy.',
  priority_2_module:     'Financial Health & Revenue',
  priority_2_finding:    'Operating margin ~8% with no segment P&L — 6 points below benchmark — represents $126K in uncaptured margin annually.',
  priority_3_module:     'Manual Tasks & Automation Readiness',
  priority_3_finding:    '15+ automatable admin hours per week at $28/hr loaded cost = $87K/yr in labor spent on tasks software handles better.',
  modules: [
    {
      module_number: 1, module_name: 'Financial Health & Revenue',
      module_score_pct: 64, status_color: 'YELLOW',
      dollar_loss_calculated: 126000, dollar_loss_label: '$126K',
      recommended_offer: 'Business Transparency Dashboards',
      recommended_offer_description: 'Real-time visibility into your business — revenue, pipeline, margin by segment, and team performance.',
      deployment_timeline: '30–45 day deployment',
      expected_impact: '$126K in margin gap recovered through visibility and segment-level optimization.',
      findings: [
        'Your operating margin sits at ~8% — 6 full points below the 14% industry benchmark for businesses at your revenue level. At $2.1M in revenue, that gap is worth $126,000 per year in operating profit left on the table.',
        'All revenue runs together — no P&L breakout by product line or client type. You may be subsidizing an unprofitable service line with revenue from a healthy one and have no visibility into it.'
      ],
      actions: [
        'Build a segment-level P&L within 30 days — break revenue and direct costs out by product or service type.',
        'Add cash flow and balance sheet to your monthly review. P&L alone is not financial management.',
        'Set a precise break-even number and review it quarterly as your cost structure shifts.'
      ],
      calc_table: [
        { input: 'Annual revenue',            value: '$2,100K', source: 'Client provided' },
        { input: 'Reported operating margin', value: '~8%',     source: 'Assessment answer (Q5)' },
        { input: 'Industry benchmark margin', value: '14%',     source: 'SMB industry average' },
        { input: 'Margin gap',                value: '6 points',source: 'Benchmark minus reported' },
        { input: 'Calculated annual loss',    value: '$2,100K × 6% = $126K', source: '' },
      ]
    },
    {
      module_number: 2, module_name: 'Staffing & HR Operations',
      module_score_pct: 46, status_color: 'RED',
      dollar_loss_calculated: 63000, dollar_loss_label: '$63K',
      recommended_offer: 'Automation for Manual Tasks',
      recommended_offer_description: 'Eliminate the repetitive admin burden that burns good people out — redirect that time to work that matters.',
      deployment_timeline: '45–60 day deployment',
      expected_impact: 'Reduced burnout-driven turnover — $63K/yr in replacement costs recovered.',
      findings: [
        'Turnover is running ~30% annually — double the 15% benchmark. At 18 FTEs, that means 3–4 extra departures per year costing $18K each to replace. Conservative. Does not include productivity loss during vacancy.',
        'No formal retention strategy exists. You are finding out why people leave at the exit interview — after the decision has already been made and the cost already incurred.'
      ],
      actions: [
        'Implement stay interviews immediately — ask your current team what would make them consider leaving.',
        'Build a 30/60/90-day onboarding program within 60 days with defined milestones.',
        'Move to documented annual performance reviews with written goals.'
      ],
      calc_table: [
        { input: 'Team size',               value: '18 FTEs',    source: 'Client provided' },
        { input: 'Reported turnover rate',  value: '~30%',       source: 'Assessment answer' },
        { input: 'Benchmark turnover',      value: '15%',        source: 'SHRM 2024 SMB average' },
        { input: 'Extra departures/yr',     value: '3.5',        source: '(30%−15%) × 18 FTEs' },
        { input: 'Replacement cost/person', value: '$18,000',    source: 'SHRM 2024 conservative midpoint' },
        { input: 'Calculated annual loss',  value: '3.5 × $18,000 = $63K', source: '' },
      ]
    },
    {
      module_number: 3, module_name: 'Accounts Receivable & Collections',
      module_score_pct: 59, status_color: 'YELLOW',
      dollar_loss_calculated: 44100, dollar_loss_label: '$44K',
      recommended_offer: 'Agentic Voice Accounts Receivable',
      recommended_offer_description: 'AI-powered collections follow-up, payment reminders, and invoice tracking — without adding headcount.',
      deployment_timeline: '30–45 day deployment',
      expected_impact: 'DSO reduced by 8–15 days; bad debt cut 40–60%. $44K/yr recovered.',
      findings: [
        '~25–35% of invoices are coming in late, pushing DSO above 40 days. At $2.1M revenue you are carrying ~$420K in AR at any time — and paying the carrying cost on every dollar of it.',
        'Bad debt write-off rate is ~3% of AR annually. Combined with carrying cost, that is $44K per year absorbed without being recognized as a recoverable line item.'
      ],
      actions: [
        'Run a full AR aging report this week — every account over 60 days needs a specific action and deadline.',
        'Build a formal collections sequence: 7-day reminder, 14-day follow-up call, 30-day formal notice.',
        'Create a written invoice dispute protocol — acknowledge within 24 hours, resolve within 5 business days.'
      ],
      calc_table: [
        { input: 'Annual revenue',         value: '$2,100K',  source: 'Client provided' },
        { input: 'Average DSO',            value: '~42 days', source: 'Assessment answer (Q3)' },
        { input: 'Estimated AR balance',   value: '~$420K',   source: '$2.1M ÷ 365 × 73-day cycle' },
        { input: 'Bad debt write-off rate',value: '~3%',      source: 'Assessment answer (Q8)' },
        { input: 'Bad debt annual cost',   value: '$12.6K',   source: '$420K × 3%' },
        { input: 'Carrying cost on AR',    value: '$31.5K',   source: '$420K × 7.5%' },
        { input: 'Calculated annual loss', value: '$12.6K + $31.5K = $44K', source: '' },
      ]
    },
    {
      module_number: 4, module_name: 'Manual Tasks & Automation Readiness',
      module_score_pct: 46, status_color: 'RED',
      dollar_loss_calculated: 87360, dollar_loss_label: '$87K',
      recommended_offer: 'Automation for Manual Tasks + Record & Data Consolidation',
      recommended_offer_description: 'Eliminate repetitive workflows and unify fragmented data across systems.',
      deployment_timeline: '45–75 day deployment',
      expected_impact: '15 hrs/wk recovered = $87K/yr redirected from admin to revenue-generating work.',
      findings: [
        'More than half of daily admin work is still manual. At 15 automatable hours per week — conservative for an 18-person team at this manual-intensity level — Smith\'s is spending $87K/yr on labor doing tasks that software handles faster and cheaper.',
        'No task management system is in use. Work lives in email and text messages. Nothing has a visible owner, deadline, or status — things fall through the cracks until they already have.'
      ],
      actions: [
        'Audit your top 10 most frequent admin tasks this week — map your $87K opportunity in 30 minutes.',
        'Implement a team-wide task management system within 30 days.',
        'Automate your top 3 manual workflows within 60 days — start highest-frequency, lowest-complexity.'
      ],
      calc_table: [
        { input: 'Automatable admin hrs/wk', value: '15 hrs',  source: 'Assessment (Q1) — conservative for team size' },
        { input: 'Loaded labor cost/hr',     value: '$28/hr',  source: 'Wages + 40% benefits/overhead' },
        { input: 'Calculated annual loss',   value: '15 × $28 × 52 = $87K', source: 'Labor cost of automatable work' },
      ]
    },
    {
      module_number: 5, module_name: 'Phone Systems & Communication',
      module_score_pct: 55, status_color: 'YELLOW',
      dollar_loss_calculated: 42000, dollar_loss_label: '$42K',
      recommended_offer: 'Agentic Voice Front Desk',
      recommended_offer_description: 'Every inbound call answered. Every lead captured. 24/7.',
      deployment_timeline: '30–45 day deployment',
      expected_impact: 'Zero missed calls — 12+ leads/yr recovered at $3,500 avg value = $42K.',
      findings: [
        'Basic VoIP exists but call analytics are not tracked. You have zero data on answer rate, hold time, or hang-ups. You are managing your highest-volume client touchpoint completely blind.',
        'No call protocols exist — experience varies entirely by who picks up. After-hours calls go to voicemail and are returned next business day, creating an 8–16 hour gap where prospects call competitors.'
      ],
      actions: [
        'Turn on your VoIP call analytics this week — pull 30 days of answer rate and voicemail data.',
        'Write scripted call guides for your top 5 call types within 30 days.',
        'Set up an after-hours response within 45 days — minimum a professional voicemail with guaranteed callback time.'
      ],
      calc_table: [
        { input: 'Est. inbound leads/month',    value: '~25',    source: 'Revenue ÷ avg. transaction value' },
        { input: 'Missed/mishandled call rate', value: '~12%',   source: 'Assessment answers (Q2, Q3, Q5)' },
        { input: 'Lost leads per year',         value: '12',     source: '25 × 12% × 12 months' },
        { input: 'Avg. transaction value',      value: '$3,500', source: '$2.1M ÷ est. 600 annual transactions' },
        { input: 'Calculated annual loss',      value: '12 × $3,500 = $42K', source: '' },
      ]
    },
    {
      module_number: 6, module_name: 'Staff Roles & Org Structure',
      module_score_pct: 70, status_color: 'YELLOW',
      dollar_loss_calculated: 22000, dollar_loss_label: '$22K',
      recommended_offer: 'Operations & Retention Consulting',
      recommended_offer_description: 'Strategic consulting on structure, retention, and operational monitoring.',
      deployment_timeline: 'Ongoing strategic engagement',
      expected_impact: '$22K/yr in manager rework and key-person disruption costs eliminated.',
      findings: [
        'Escalation clarity is inconsistent — not formally documented. 4–5 hours per week of manager time is consumed by issues that a one-page escalation matrix would handle at the front-line level.',
        'Limited cross-training leaves key-person dependency risk. One coverage gap event per year at this team size costs an estimated $10K+ in disruption, rework, and delivery delay.'
      ],
      actions: [
        'Document a one-page escalation matrix for each role within 30 days.',
        'Identify your top 3 single points of failure and build cross-training plans within 60 days.',
        'Audit your management layer\'s actual workload — if stretched, the structure is the problem, not the people.'
      ],
      calc_table: [
        { input: 'Mgmt rework hrs/wk',        value: '4 hrs',  source: 'Assessment (Q3) — escalation inconsistency' },
        { input: 'Manager loaded rate',        value: '$42/hr', source: 'Senior staff rate estimate' },
        { input: 'Annual rework cost',         value: '$8.7K',  source: '4 × $42 × 52 wks' },
        { input: 'Key-person disruption/yr',   value: '$11K',   source: 'Assessment (Q5) — limited cross-training' },
        { input: 'Calculated annual loss',     value: '$8.7K + $11K ≈ $22K', source: '' },
      ]
    },
    {
      module_number: 7, module_name: 'Labor Costs & Workforce Economics',
      module_score_pct: 46, status_color: 'RED',
      dollar_loss_calculated: 68040, dollar_loss_label: '$68K',
      recommended_offer: 'Automation for Manual Tasks + Business Transparency Dashboards',
      recommended_offer_description: 'Reduce labor cost through automation. Track the savings in real time.',
      deployment_timeline: '45–60 day deployment',
      expected_impact: '$68K/yr in labor efficiency recovered — tracked in your dashboard.',
      findings: [
        'Labor is consuming ~45–55% of revenue. Overtime is unplanned and no one is modeling the annual cost — which is almost certainly higher than anyone currently estimates.',
        'Wages have not been benchmarked in over a year. Revenue per FTE calculated once but not tracked. Two omissions that mean labor costs are managed by feel rather than data.'
      ],
      actions: [
        'Calculate your annualized overtime cost this month — total OT hours × loaded rate.',
        'Run a market wage comparison on your top 5 roles within 30 days.',
        'Set revenue per FTE as a monthly KPI reviewed in your leadership meeting.'
      ],
      calc_table: [
        { input: 'Team size',               value: '18 FTEs',   source: 'Client provided' },
        { input: 'Avg loaded cost/FTE',     value: '$52K/yr',   source: 'Wages + benefits + overhead' },
        { input: 'Total annual labor cost', value: '$936K',     source: '18 × $52K' },
        { input: 'Efficiency gap',          value: '7.5%',      source: 'Untracked OT + manual-heavy ops' },
        { input: 'Gross opportunity',       value: '$70.2K',    source: '$936K × 7.5%' },
        { input: 'Non-addressable (23%)',   value: '−$16.2K',   source: 'Fixed structural labor' },
        { input: 'Calculated annual loss',  value: '$68K net',  source: 'Addressable efficiency gap' },
      ]
    },
    {
      module_number: 8, module_name: 'Marketing & Growth',
      module_score_pct: 41, status_color: 'RED',
      dollar_loss_calculated: 195000, dollar_loss_label: '$195K',
      recommended_offer: 'RevScan AI — Full Marketing Audit',
      recommended_offer_description: '60–90 second diagnostic of your digital presence, funnel, and ad spend scored across 15 levers.',
      deployment_timeline: 'Immediate — runs in under 2 minutes',
      expected_impact: '$195K addressable growth gap — highest single lever in this report.',
      findings: [
        'No lead capture mechanism, no paid advertising, no referral system. Smith\'s relies entirely on word of mouth — which means growth is capped at the speed of relationships, not the speed of a real marketing engine.',
        'No formal marketing audit has ever been done. Smith\'s has never had a structured view of what the business looks like to a potential client online — what they find, whether it builds confidence, and where they drop off.'
      ],
      actions: [
        'Deploy a lead capture mechanism on your website within 14 days — lead magnet + automated follow-up.',
        'Build a structured referral outreach program within 30 days — identify top 10 sources, create monthly touchpoints.',
        'Run a RevScan AI audit immediately — 15-lever score of your digital presence in 60 seconds.'
      ],
      calc_table: [
        { input: 'Current annual revenue',          value: '$2,100K', source: 'Client provided' },
        { input: 'Est. growth (word-of-mouth only)', value: '~4%/yr', source: 'Implied by D answers on Q3, Q4' },
        { input: 'Benchmark growth (active mktg)',  value: '~13%/yr', source: 'SMB avg with digital + referral' },
        { input: 'Addressable gap',                 value: '9.3 pts', source: '13% − 4% = 9.3% addressable' },
        { input: 'Calculated annual opportunity',   value: '$2,100K × 9.3% = $195K', source: '' },
      ]
    },
  ],
  phase_1_recommendations: [
    { module: 'Marketing & Growth',    offer: 'RevScan AI + Lead Capture + Referral System', target_outcome: 'First lead capture live, RevScan complete, referral outreach active', dollar_recovery: '$195K' },
    { module: 'Staffing & HR',         offer: 'Stay Interviews + Onboarding Program',         target_outcome: 'Turnover begins declining within 90 days',                          dollar_recovery: '$63K'  },
  ],
  phase_2_recommendations: [
    { module: 'Automation Readiness',  offer: 'Automation for Manual Tasks + Data Consolidation', target_outcome: 'Top 5 manual workflows automated, task system org-wide',      dollar_recovery: '$87K'  },
    { module: 'AR & Collections',      offer: 'Agentic Voice Accounts Receivable',                target_outcome: 'AR aging over 90 days cut 40–60%',                             dollar_recovery: '$44K'  },
  ],
  phase_3_recommendations: [
    { module: 'Financial Health + Labor', offer: 'Business Transparency Dashboards',           target_outcome: 'Real-time margin, labor cost, revenue per FTE in one dashboard', dollar_recovery: '$194K' },
    { module: 'Phone Systems + Org',      offer: 'Agentic Voice Front Desk + Ops Consulting', target_outcome: 'Every call answered, escalation matrix live',                    dollar_recovery: '$64K'  },
  ],
  answers: [
    { module_name: 'Financial Health', question_number: 1, question_text: 'Gross margin tracked by product/service', answer_choice: 'B', answer_points: 3 },
    { module_name: 'Financial Health', question_number: 2, question_text: 'Days to payment after invoicing',         answer_choice: 'B', answer_points: 3 },
    { module_name: 'Financial Health', question_number: 3, question_text: 'Break-even number known',                 answer_choice: 'B', answer_points: 3 },
    { module_name: 'Financial Health', question_number: 4, question_text: 'Financial statements reviewed monthly',   answer_choice: 'B', answer_points: 3 },
    { module_name: 'Financial Health', question_number: 5, question_text: 'Operating margin range',                  answer_choice: 'C', answer_points: 2 },
    { module_name: 'Financial Health', question_number: 6, question_text: '90-day cash flow forecast exists',        answer_choice: 'C', answer_points: 2 },
    { module_name: 'Financial Health', question_number: 7, question_text: 'P&L broken out by segment',              answer_choice: 'C', answer_points: 2 },
    { module_name: 'Staffing & HR',    question_number: 1, question_text: 'Team sized right for workload',           answer_choice: 'C', answer_points: 2 },
    { module_name: 'Staffing & HR',    question_number: 2, question_text: 'Coverage plan when staff calls out',      answer_choice: 'C', answer_points: 2 },
    { module_name: 'Staffing & HR',    question_number: 3, question_text: "Owner's week — leading vs. fires",        answer_choice: 'C', answer_points: 2 },
    { module_name: 'Staffing & HR',    question_number: 4, question_text: 'Annualized turnover rate',                answer_choice: 'C', answer_points: 2 },
    { module_name: 'Staffing & HR',    question_number: 5, question_text: 'Onboarding program quality',             answer_choice: 'C', answer_points: 2 },
    { module_name: 'Staffing & HR',    question_number: 6, question_text: 'Retention strategy in place',            answer_choice: 'D', answer_points: 1 },
    { module_name: 'Staffing & HR',    question_number: 7, question_text: 'HR policies documented',                 answer_choice: 'C', answer_points: 2 },
    { module_name: 'AR & Collections', question_number: 1, question_text: 'Standard payment terms',                 answer_choice: 'B', answer_points: 3 },
    { module_name: 'AR & Collections', question_number: 2, question_text: '% invoices paid on time',                answer_choice: 'C', answer_points: 2 },
    { module_name: 'AR & Collections', question_number: 3, question_text: 'Average days sales outstanding',         answer_choice: 'C', answer_points: 2 },
    { module_name: 'AR & Collections', question_number: 4, question_text: '% AR over 90 days',                     answer_choice: 'B', answer_points: 3 },
    { module_name: 'AR & Collections', question_number: 5, question_text: 'Collections process — documented',       answer_choice: 'C', answer_points: 2 },
    { module_name: 'AR & Collections', question_number: 6, question_text: 'Invoice dispute resolution process',     answer_choice: 'C', answer_points: 2 },
    { module_name: 'AR & Collections', question_number: 7, question_text: 'Payment plan options offered',           answer_choice: 'C', answer_points: 2 },
    { module_name: 'AR & Collections', question_number: 8, question_text: 'Annual bad debt write-off %',            answer_choice: 'B', answer_points: 3 },
    { module_name: 'Automation',       question_number: 1, question_text: '% admin work still manual',              answer_choice: 'C', answer_points: 2 },
    { module_name: 'Automation',       question_number: 2, question_text: 'Task/project management system used',    answer_choice: 'C', answer_points: 2 },
    { module_name: 'Automation',       question_number: 3, question_text: 'Inbound customer call handling',         answer_choice: 'C', answer_points: 2 },
    { module_name: 'Automation',       question_number: 4, question_text: 'New business process — pipeline',        answer_choice: 'C', answer_points: 2 },
    { module_name: 'Automation',       question_number: 5, question_text: 'AI tools evaluated or implemented',      answer_choice: 'D', answer_points: 1 },
    { module_name: 'Automation',       question_number: 6, question_text: 'SOPs for top 10 frequent tasks',         answer_choice: 'C', answer_points: 2 },
    { module_name: 'Phone Systems',    question_number: 1, question_text: 'Phone system type',                      answer_choice: 'B', answer_points: 3 },
    { module_name: 'Phone Systems',    question_number: 2, question_text: '% calls answered live',                  answer_choice: 'B', answer_points: 3 },
    { module_name: 'Phone Systems',    question_number: 3, question_text: 'Scripted call protocols exist',           answer_choice: 'C', answer_points: 2 },
    { module_name: 'Phone Systems',    question_number: 4, question_text: 'After-hours call handling',              answer_choice: 'C', answer_points: 2 },
    { module_name: 'Phone Systems',    question_number: 5, question_text: 'Call analytics tracked and reviewed',    answer_choice: 'D', answer_points: 1 },
    { module_name: 'Org Structure',    question_number: 1, question_text: 'Org chart current and accurate',         answer_choice: 'B', answer_points: 3 },
    { module_name: 'Org Structure',    question_number: 2, question_text: 'Every role has a job description',       answer_choice: 'B', answer_points: 3 },
    { module_name: 'Org Structure',    question_number: 3, question_text: 'Business runs without owner daily',      answer_choice: 'B', answer_points: 3 },
    { module_name: 'Org Structure',    question_number: 4, question_text: 'Data trusted for decisions',             answer_choice: 'B', answer_points: 3 },
    { module_name: 'Org Structure',    question_number: 5, question_text: 'Revenue concentration risk',             answer_choice: 'C', answer_points: 2 },
    { module_name: 'Labor Costs',      question_number: 1, question_text: 'Labor as % of revenue',                  answer_choice: 'C', answer_points: 2 },
    { module_name: 'Labor Costs',      question_number: 2, question_text: 'Revenue per FTE tracked',                answer_choice: 'C', answer_points: 2 },
    { module_name: 'Labor Costs',      question_number: 3, question_text: 'Overtime planned and controlled',        answer_choice: 'C', answer_points: 2 },
    { module_name: 'Labor Costs',      question_number: 4, question_text: 'Wages benchmarked annually',             answer_choice: 'C', answer_points: 2 },
    { module_name: 'Labor Costs',      question_number: 5, question_text: 'Cost-to-hire and time-to-fill tracked',  answer_choice: 'D', answer_points: 1 },
    { module_name: 'Labor Costs',      question_number: 6, question_text: '10% labor reduction modeled',            answer_choice: 'C', answer_points: 2 },
    { module_name: 'Marketing',        question_number: 1, question_text: 'Digital presence quality',               answer_choice: 'C', answer_points: 2 },
    { module_name: 'Marketing',        question_number: 2, question_text: 'Referral system active',                 answer_choice: 'C', answer_points: 2 },
    { module_name: 'Marketing',        question_number: 3, question_text: 'Paid advertising running',               answer_choice: 'D', answer_points: 1 },
    { module_name: 'Marketing',        question_number: 4, question_text: 'Lead capture mechanism on website',      answer_choice: 'D', answer_points: 1 },
    { module_name: 'Marketing',        question_number: 5, question_text: 'Lead follow-up within 24 hours',         answer_choice: 'C', answer_points: 2 },
    { module_name: 'Marketing',        question_number: 6, question_text: 'Acquisition source tracked',             answer_choice: 'C', answer_points: 2 },
    { module_name: 'Marketing',        question_number: 7, question_text: 'Reviews and social proof — active',      answer_choice: 'C', answer_points: 2 },
    { module_name: 'Marketing',        question_number: 8, question_text: 'Formal marketing audit completed',       answer_choice: 'D', answer_points: 1 },
  ],
}

async function generateSamplePDF() {
  console.log("Generating Smith's sample PDF...")

  const html = generateReportHTML(SMITHS_DATA)

  const response = await fetch(
    `https://chrome.browserless.io/pdf?token=${process.env.BLESS_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html,
        options: {
          format: 'A4',
          printBackground: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' }
        }
      })
    }
  )

  if (!response.ok) {
    throw new Error(`Browserless error: ${response.status} ${await response.text()}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const outPath = path.join(process.cwd(), 'public', 'sample-report.pdf')
  fs.writeFileSync(outPath, buffer)

  console.log(`✅ PDF saved to: ${outPath}`)
  console.log(`   File size: ${(buffer.length / 1024).toFixed(0)}KB`)
  console.log(`   Link on site: /sample-report.pdf`)
}

generateSamplePDF().catch(console.error)
```

---

# SECTION 9: BUILD ORDER FOR CURSOR

Tell Claude/Cursor to build in this exact sequence:

```
STEP 1 — Run the Supabase SQL (Section 4). Confirm all 4 tables exist.

STEP 2 — Create /types/report.ts (Section 5). No dependencies.

STEP 3 — Create /lib/scoring.ts (Section 6). No dependencies.

STEP 4 — Copy /lib/finding-text.ts from the "All 52 Finding Strings" document.
         Copy /lib/module-actions.ts from the "Scoring System" document.

STEP 5 — Create /lib/report-template.ts from the "PDF Report HTML Template" document.

STEP 6 — Create /lib/report-builder.ts (Section 7). Depends on Steps 2–5.

STEP 7 — Create /scripts/generate-sample-pdf.ts (Section 8).
         Run: npx ts-node scripts/generate-sample-pdf.ts
         Confirm /public/sample-report.pdf is created.
         Link it from your website: <a href="/sample-report.pdf">View Sample Report</a>

STEP 8 — Build the API routes:
         /api/stripe/webhook/route.ts
         /api/complete-assessment/route.ts
         /api/generate-report-pdf/route.ts

STEP 9 — Build the UI:
         /app/assessment/page.tsx (track selection + Stripe CTA)
         /app/assessment/[session_id]/page.tsx (questions)
         /app/assessment/[session_id]/results/page.tsx (teaser screen)
         /app/admin/reports/page.tsx (Jeff's admin view)
```

---

# SECTION 10: REFERENCE DOCUMENTS

These documents are already built and saved. Claude should reference them for the content they contain:

| Document | What It Contains |
|----------|-----------------|
| EnhancedOps.ninja — All 52 Finding Strings | FINDING_TEXT object — all 104 finding strings |
| EnhancedOps.ninja — Assessment Scoring System | MODULE_ACTIONS and OFFER_MAP objects |
| EnhancedOps.ninja — PDF Report HTML Template | generateReportHTML() full function |
| EnhancedOps.ninja — Full Tech Build Spec | Stripe webhook, email flows, admin view specs |
| SAMPLE — Smith's General Business Report | Content reference for how the final output reads |

---

*EnhancedOps.ninja | Jeff Oldroyd | Powered by Artemis*
*Full Cursor Build Package v1.0*
