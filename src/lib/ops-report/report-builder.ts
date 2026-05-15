import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnswerRow, ModuleResult, PhaseItem, ReportData } from "@/types/report";
import { FINDING_TEXT } from "@/lib/ops-report/finding-text";
import { MODULE_ACTIONS, OFFER_MAP, type OpsTrack } from "@/lib/ops-report/module-actions";
import {
  calcModuleDollarLoss,
  getStatus,
  MODULE_CONFIG,
  POINT_MAP,
  type StatusColor,
} from "@/lib/ops-report/scoring";

type OpsSessionRow = {
  id: string;
  client_name: string;
  client_email: string;
  organization_name: string | null;
  annual_revenue: number | string | null;
  team_size: number | null;
  track: string | null;
  completed_at: string | null;
};

type OpsAnswerRow = {
  module_number: number;
  module_name: string;
  question_number: number;
  question_key: string;
  question_text: string | null;
  answer_choice: string | null;
  answer_points: number | null;
};

function toNumber(v: number | string | null | undefined, fallback: number): number {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTrack(track: string | null): OpsTrack {
  return track === "healthcare" ? "healthcare" : "general_business";
}

export async function buildReportData(supabase: SupabaseClient, session_id: string): Promise<ReportData> {
  const { data: session, error: sessionError } = await supabase
    .from("ops_assessment_sessions")
    .select("*")
    .eq("id", session_id)
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? "Session not found");
  }

  const s = session as OpsSessionRow;
  const annualRevenue = toNumber(s.annual_revenue, 2_100_000);
  const teamSize = s.team_size ?? 18;
  const track = normalizeTrack(s.track);

  const { data: answersData, error: answersError } = await supabase
    .from("ops_assessment_answers")
    .select("*")
    .eq("session_id", session_id)
    .order("module_number", { ascending: true })
    .order("question_number", { ascending: true });

  if (answersError) {
    throw new Error(answersError.message);
  }

  const answers = (answersData ?? []) as OpsAnswerRow[];

  const modules: ModuleResult[] = MODULE_CONFIG.map((cfg) => {
    const moduleAnswers = answers.filter((a) => a.module_number === cfg.number);
    const rawPoints = moduleAnswers.reduce((sum, a) => sum + (a.answer_points ?? 0), 0);
    const maxPoints = cfg.maxQuestions * 4;
    const scorePct = maxPoints > 0 ? (rawPoints / maxPoints) * 100 : 0;
    const status: StatusColor = getStatus(scorePct);

    const dollarCalc = calcModuleDollarLoss(
      cfg.number,
      scorePct,
      status,
      annualRevenue,
      teamSize,
      moduleAnswers.map((a) => ({
        question_key: a.question_key,
        answer_points: a.answer_points ?? 0,
      })),
    );

    const weakAnswers = [...moduleAnswers].sort((a, b) => (a.answer_points ?? 4) - (b.answer_points ?? 4)).slice(0, 2);

    const findings = weakAnswers
      .map((a) => FINDING_TEXT[a.question_key]?.[status])
      .filter((x): x is string => typeof x === "string" && x.length > 0);

    const actions = MODULE_ACTIONS[track]?.[cfg.number]?.[status] ?? [];
    const offerMap = OFFER_MAP[track]?.[cfg.number];

    return {
      module_number: cfg.number,
      module_name: cfg.name,
      module_score_pct: scorePct,
      status_color: status,
      dollar_loss_calculated: dollarCalc.amount,
      dollar_loss_label: dollarCalc.label,
      recommended_offer: offerMap?.offer ?? "",
      recommended_offer_description: offerMap?.desc ?? "",
      deployment_timeline: offerMap?.timeline ?? "30–60 day deployment",
      expected_impact: offerMap?.impact ?? "",
      findings,
      actions,
      calc_table: dollarCalc.calcTable,
    };
  });

  const overallScore = modules.reduce((sum, m) => {
    const cfg = MODULE_CONFIG.find((c) => c.number === m.module_number);
    const w = cfg?.weight ?? 0;
    return sum + m.module_score_pct * w;
  }, 0);

  const overallStatus: StatusColor = getStatus(overallScore);

  const totalDollarLoss = modules.reduce((sum, m) => sum + m.dollar_loss_calculated, 0);
  const totalLabel = `$${(totalDollarLoss / 1000).toFixed(0)}K`;

  const orgName = s.organization_name?.trim().length ? s.organization_name : s.client_name;

  const narrativeMap: Record<StatusColor, string> = {
    RED: `${orgName} has significant operational exposure across multiple areas. The findings in this report identify specific gaps currently costing an estimated ${totalLabel} per year. Every gap identified has a clear, implementable solution — the path forward is laid out in detail below.`,
    YELLOW: `${orgName} is functional — and that is exactly the problem. You have built something real. This assessment reveals a business running harder than it needs to on systems sized for an earlier chapter. The ${totalLabel} in this report is not a penalty — it is your roadmap.`,
    GREEN: `${orgName} is running well. A targeted set of improvement opportunities exists, and the recommendations below will help you protect what is working and push toward the next level of growth.`,
  };

  const sortedByDollar = [...modules]
    .filter((m) => m.status_color !== "GREEN")
    .sort((a, b) => b.dollar_loss_calculated - a.dollar_loss_calculated);

  const sortedByImpact = [...modules]
    .filter((m) => m.status_color !== "GREEN")
    .sort((a, b) => {
      if (a.status_color === "RED" && b.status_color !== "RED") return -1;
      if (b.status_color === "RED" && a.status_color !== "RED") return 1;
      return b.dollar_loss_calculated - a.dollar_loss_calculated;
    });

  const toPhaseItem = (m: ModuleResult): PhaseItem => ({
    module: m.module_name,
    offer: m.recommended_offer,
    target_outcome: m.expected_impact,
    dollar_recovery: m.dollar_loss_label,
  });

  const answerRows: AnswerRow[] = answers.map((a) => ({
    module_name: a.module_name,
    question_number: a.question_number,
    question_text: a.question_text ?? "",
    answer_choice: a.answer_choice ?? "",
    answer_points: a.answer_points ?? 0,
  }));

  const completedAtRaw = s.completed_at;
  const completedAt =
    completedAtRaw && !Number.isNaN(Date.parse(completedAtRaw))
      ? new Date(completedAtRaw).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return {
    client_name: s.client_name,
    organization_name: orgName,
    track,
    completed_at: completedAt,
    annual_revenue: annualRevenue,
    team_size: teamSize,
    overall_score: overallScore,
    overall_status: overallStatus,
    total_dollar_loss: totalDollarLoss,
    total_dollar_loss_label: totalLabel,
    executive_narrative: narrativeMap[overallStatus],
    total_points_earned: answers.reduce((acc, a) => acc + (a.answer_points ?? 0), 0),
    max_possible_points: 208,
    priority_1_module: sortedByDollar[0]?.module_name ?? "",
    priority_1_finding: sortedByDollar[0]?.findings[0] ?? "",
    priority_2_module: sortedByDollar[1]?.module_name ?? "",
    priority_2_finding: sortedByDollar[1]?.findings[0] ?? "",
    priority_3_module: sortedByDollar[2]?.module_name ?? "",
    priority_3_finding: sortedByDollar[2]?.findings[0] ?? "",
    modules,
    phase_1_recommendations: sortedByImpact.slice(0, 2).map(toPhaseItem),
    phase_2_recommendations: sortedByImpact.slice(2, 4).map(toPhaseItem),
    phase_3_recommendations: sortedByImpact.slice(4).map(toPhaseItem),
    answers: answerRows,
  };
}

export function pointsForChoice(choice: string): number | null {
  const upper = choice.trim().toUpperCase();
  if (upper !== "A" && upper !== "B" && upper !== "C" && upper !== "D") return null;
  return POINT_MAP[upper] ?? null;
}
