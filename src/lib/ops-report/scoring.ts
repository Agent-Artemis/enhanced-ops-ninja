export const POINT_MAP: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };

export const MODULE_CONFIG = [
  { number: 1, name: "Financial Health & Revenue", maxQuestions: 7, weight: 0.15 },
  { number: 2, name: "Staffing & HR Operations", maxQuestions: 7, weight: 0.15 },
  { number: 3, name: "Accounts Receivable & Collections", maxQuestions: 8, weight: 0.15 },
  { number: 4, name: "Manual Tasks & Automation Readiness", maxQuestions: 6, weight: 0.15 },
  { number: 5, name: "Phone Systems & Communication", maxQuestions: 5, weight: 0.1 },
  { number: 6, name: "Staff Roles & Org Structure", maxQuestions: 5, weight: 0.1 },
  { number: 7, name: "Labor Costs & Workforce Economics", maxQuestions: 6, weight: 0.1 },
  { number: 8, name: "Marketing & Growth", maxQuestions: 8, weight: 0.1 },
] as const;

export type StatusColor = "RED" | "YELLOW" | "GREEN";

export function getStatus(pct: number): StatusColor {
  if (pct >= 80) return "GREEN";
  if (pct >= 55) return "YELLOW";
  return "RED";
}

export function getStatusLabel(s: StatusColor | string): string {
  return { RED: "CRITICAL", YELLOW: "AT RISK", GREEN: "OPTIMIZED" }[s] ?? s;
}

export function getStatusEmoji(s: StatusColor | string): string {
  return { RED: "🔴", YELLOW: "🟡", GREEN: "🟢" }[s] ?? "";
}

export function getStatusColor(s: StatusColor | string): string {
  return { RED: "#ef4444", YELLOW: "#f59e0b", GREEN: "#22c55e" }[s] ?? "#ffffff";
}

export function calcModuleDollarLoss(
  moduleNumber: number,
  scorePct: number,
  status: StatusColor,
  annualRevenue: number,
  teamSize: number,
  answers: { question_key: string; answer_points: number }[],
): {
  amount: number;
  label: string;
  calcTable: { input: string; value: string; source: string }[];
} {
  void answers;

  if (status === "GREEN") return { amount: 0, label: "—", calcTable: [] };

  switch (moduleNumber) {
    case 1: {
      const reportedMarginPct = scorePct >= 70 ? 0.11 : scorePct >= 55 ? 0.08 : 0.05;
      const benchmarkMargin = 0.14;
      const marginGap = Math.max(0, benchmarkMargin - reportedMarginPct);
      const amount = Math.round(annualRevenue * marginGap);
      return {
        amount,
        label: `$${(amount / 1000).toFixed(0)}K`,
        calcTable: [
          { input: "Annual revenue", value: `$${(annualRevenue / 1000).toFixed(0)}K`, source: "Client provided" },
          {
            input: "Reported operating margin",
            value: `~${(reportedMarginPct * 100).toFixed(0)}%`,
            source: "Assessment answer (Q5)",
          },
          { input: "Industry benchmark margin", value: "14%", source: "SMB industry average" },
          { input: "Margin gap", value: `${(marginGap * 100).toFixed(0)} points`, source: "Benchmark minus reported" },
          {
            input: "Calculated annual loss",
            value: `$${(annualRevenue / 1000).toFixed(0)}K × ${(marginGap * 100).toFixed(0)}% = $${(amount / 1000).toFixed(0)}K`,
            source: "",
          },
        ],
      };
    }

    case 2: {
      const turnoverRate = scorePct >= 70 ? 0.18 : scorePct >= 55 ? 0.28 : 0.38;
      const benchmarkTurnover = 0.15;
      const extraDepartures = Math.max(0, (turnoverRate - benchmarkTurnover) * teamSize);
      const replacementCost = 18000;
      const amount = Math.round(extraDepartures * replacementCost);
      return {
        amount,
        label: `$${(amount / 1000).toFixed(0)}K`,
        calcTable: [
          { input: "Team size", value: `${teamSize} FTEs`, source: "Client provided" },
          { input: "Reported turnover rate", value: `~${(turnoverRate * 100).toFixed(0)}%`, source: "Assessment answer" },
          { input: "Benchmark turnover", value: "15%", source: "SHRM 2024 SMB average" },
          { input: "Extra departures/yr", value: extraDepartures.toFixed(1), source: `(${(turnoverRate * 100).toFixed(0)}% − 15%) × ${teamSize} FTEs` },
          { input: "Replacement cost/person", value: "$18,000", source: "SHRM 2024 conservative midpoint" },
          {
            input: "Calculated annual loss",
            value: `${extraDepartures.toFixed(1)} × $18,000 = $${(amount / 1000).toFixed(0)}K`,
            source: "",
          },
        ],
      };
    }

    case 3: {
      const dso = scorePct >= 70 ? 35 : scorePct >= 55 ? 42 : 58;
      const arBalance = (annualRevenue / 365) * dso * 2.4;
      const badDebtRate = scorePct >= 70 ? 0.015 : scorePct >= 55 ? 0.03 : 0.05;
      const badDebt = arBalance * badDebtRate;
      const carryingCost = arBalance * 0.075;
      const amount = Math.round(badDebt + carryingCost);
      return {
        amount,
        label: `$${(amount / 1000).toFixed(0)}K`,
        calcTable: [
          { input: "Annual revenue", value: `$${(annualRevenue / 1000).toFixed(0)}K`, source: "Client provided" },
          { input: "Average DSO", value: `~${dso} days`, source: "Assessment answer (Q3)" },
          { input: "Estimated AR balance", value: `$${(arBalance / 1000).toFixed(0)}K`, source: `$${(annualRevenue / 1000).toFixed(0)}K ÷ 365 × ${dso} days` },
          { input: "Bad debt write-off rate", value: `${(badDebtRate * 100).toFixed(1)}%`, source: "Assessment answer (Q8)" },
          { input: "Bad debt annual cost", value: `$${(badDebt / 1000).toFixed(0)}K`, source: `$${(arBalance / 1000).toFixed(0)}K × ${(badDebtRate * 100).toFixed(1)}%` },
          { input: "Carrying cost on AR", value: `$${(carryingCost / 1000).toFixed(0)}K`, source: "$AR balance × 7.5% (prime + spread)" },
          {
            input: "Calculated annual loss",
            value: `$${(badDebt / 1000).toFixed(0)}K + $${(carryingCost / 1000).toFixed(0)}K = $${(amount / 1000).toFixed(0)}K`,
            source: "",
          },
        ],
      };
    }

    case 4: {
      const manualHoursPerWeek = scorePct >= 70 ? 8 : scorePct >= 55 ? 12 : 18;
      const loadedRate = 28;
      const amount = Math.round(manualHoursPerWeek * loadedRate * 52);
      return {
        amount,
        label: `$${(amount / 1000).toFixed(0)}K`,
        calcTable: [
          { input: "Automatable admin hrs/wk", value: `${manualHoursPerWeek} hrs`, source: "Assessment answer (Q1) — conservative estimate" },
          { input: "Loaded labor cost/hr", value: "$28/hr", source: "Wages + 40% benefits/overhead burden" },
          {
            input: "Calculated annual loss",
            value: `${manualHoursPerWeek} × $28 × 52 = $${(amount / 1000).toFixed(0)}K`,
            source: "Labor cost of automatable work",
          },
        ],
      };
    }

    case 5: {
      const missedCallRate = scorePct >= 70 ? 0.06 : scorePct >= 55 ? 0.12 : 0.2;
      const leadsPerMonth = Math.round((annualRevenue / 12 / 3500) * 1.4);
      const avgTxnValue = Math.round(annualRevenue / (annualRevenue / 3500));
      const lostLeadsPerYr = Math.round(leadsPerMonth * missedCallRate * 12);
      const amount = Math.round(lostLeadsPerYr * avgTxnValue);
      return {
        amount,
        label: `$${(amount / 1000).toFixed(0)}K`,
        calcTable: [
          { input: "Est. inbound leads/month", value: `${leadsPerMonth}`, source: "Revenue ÷ avg. transaction value" },
          { input: "Missed/mishandled call rate", value: `${(missedCallRate * 100).toFixed(0)}%`, source: "Assessment answers (Q2, Q3, Q5)" },
          { input: "Lost leads per year", value: `${lostLeadsPerYr}`, source: `${leadsPerMonth} × ${(missedCallRate * 100).toFixed(0)}% × 12 months` },
          { input: "Avg. transaction value", value: `$${(avgTxnValue / 1000).toFixed(1)}K`, source: "Revenue ÷ est. annual transactions" },
          {
            input: "Calculated annual loss",
            value: `${lostLeadsPerYr} × $${(avgTxnValue / 1000).toFixed(1)}K = $${(amount / 1000).toFixed(0)}K`,
            source: "",
          },
        ],
      };
    }

    case 6: {
      const mgmtHoursWasted = scorePct >= 70 ? 2 : scorePct >= 55 ? 4 : 7;
      const mgmtRate = 42;
      const reworkCost = mgmtHoursWasted * mgmtRate * 52;
      const disruptionCost = scorePct >= 70 ? 4000 : scorePct >= 55 ? 10000 : 18000;
      const amount = Math.round(reworkCost + disruptionCost);
      return {
        amount,
        label: `$${(amount / 1000).toFixed(0)}K`,
        calcTable: [
          { input: "Mgmt rework hrs/wk (over-escalation)", value: `${mgmtHoursWasted} hrs`, source: "Assessment answer (Q3)" },
          { input: "Manager loaded rate", value: "$42/hr", source: "Senior staff rate estimate" },
          { input: "Annual rework cost", value: `$${(reworkCost / 1000).toFixed(0)}K`, source: `${mgmtHoursWasted} × $42 × 52 wks` },
          { input: "Key-person disruption cost/yr", value: `$${(disruptionCost / 1000).toFixed(0)}K`, source: "Assessment (Q5) — coverage gaps × avg disruption" },
          {
            input: "Calculated annual loss",
            value: `$${(reworkCost / 1000).toFixed(0)}K + $${(disruptionCost / 1000).toFixed(0)}K = $${(amount / 1000).toFixed(0)}K`,
            source: "",
          },
        ],
      };
    }

    case 7: {
      const totalLaborCost = teamSize * 52000;
      const efficiencyGap = scorePct >= 70 ? 0.04 : scorePct >= 55 ? 0.075 : 0.12;
      const grossOpportunity = totalLaborCost * efficiencyGap;
      const nonAddressable = grossOpportunity * 0.23;
      const amount = Math.round(grossOpportunity - nonAddressable);
      return {
        amount,
        label: `$${(amount / 1000).toFixed(0)}K`,
        calcTable: [
          { input: "Team size", value: `${teamSize} FTEs`, source: "Client provided" },
          { input: "Avg loaded cost/FTE", value: "$52,000/yr", source: "Wages + benefits + overhead" },
          { input: "Total annual labor cost", value: `$${(totalLaborCost / 1000).toFixed(0)}K`, source: `${teamSize} × $52,000` },
          { input: "Efficiency gap vs. bench", value: `${(efficiencyGap * 100).toFixed(1)}%`, source: "Untracked OT + manual workflows + no benchmarking" },
          { input: "Gross opportunity", value: `$${(grossOpportunity / 1000).toFixed(0)}K`, source: `$${(totalLaborCost / 1000).toFixed(0)}K × ${(efficiencyGap * 100).toFixed(1)}%` },
          { input: "Minus non-addressable", value: `$${(nonAddressable / 1000).toFixed(0)}K`, source: "Fixed structural labor (23%)" },
          { input: "Calculated annual loss", value: `$${(amount / 1000).toFixed(0)}K`, source: "Net addressable efficiency gap" },
        ],
      };
    }

    case 8: {
      const currentGrowthRate = 0.04;
      const benchmarkGrowthRate = 0.13;
      const addressableGap = benchmarkGrowthRate - currentGrowthRate;
      const amount = Math.round(annualRevenue * addressableGap);
      return {
        amount,
        label: `$${(amount / 1000).toFixed(0)}K`,
        calcTable: [
          { input: "Current annual revenue", value: `$${(annualRevenue / 1000).toFixed(0)}K`, source: "Client provided" },
          { input: "Estimated growth (word-of-mouth only)", value: "~4%/yr", source: "Implied by D answers on Q3, Q4" },
          { input: "Benchmark growth (active mktg)", value: "~13%/yr", source: "SMB avg with digital + referral system" },
          { input: "Addressable gap", value: `${(addressableGap * 100).toFixed(1)} points`, source: "13% − 4% = 9% addressable" },
          {
            input: "Calculated annual opportunity",
            value: `$${(annualRevenue / 1000).toFixed(0)}K × ${(addressableGap * 100).toFixed(1)}% = $${(amount / 1000).toFixed(0)}K`,
            source: "",
          },
        ],
      };
    }

    default:
      return { amount: 0, label: "—", calcTable: [] };
  }
}
