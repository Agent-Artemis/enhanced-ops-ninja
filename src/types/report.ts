export interface ModuleResult {
  module_number: number;
  module_name: string;
  module_score_pct: number;
  status_color: "RED" | "YELLOW" | "GREEN";
  dollar_loss_calculated: number;
  dollar_loss_label: string;
  recommended_offer: string;
  recommended_offer_description: string;
  deployment_timeline: string;
  expected_impact: string;
  findings: string[];
  actions: string[];
  calc_table: {
    input: string;
    value: string;
    source: string;
  }[];
}

export interface PhaseItem {
  module: string;
  offer: string;
  target_outcome: string;
  dollar_recovery: string;
}

export interface AnswerRow {
  module_name: string;
  question_number: number;
  question_text: string;
  answer_choice: string;
  answer_points: number;
}

export interface ReportData {
  client_name: string;
  organization_name: string;
  track: "healthcare" | "general_business";
  completed_at: string;
  annual_revenue: number;
  team_size: number;
  overall_score: number;
  overall_status: "RED" | "YELLOW" | "GREEN";
  total_dollar_loss: number;
  total_dollar_loss_label: string;
  executive_narrative: string;
  total_points_earned: number;
  max_possible_points: number;
  priority_1_module: string;
  priority_1_finding: string;
  priority_2_module: string;
  priority_2_finding: string;
  priority_3_module: string;
  priority_3_finding: string;
  modules: ModuleResult[];
  phase_1_recommendations: PhaseItem[];
  phase_2_recommendations: PhaseItem[];
  phase_3_recommendations: PhaseItem[];
  answers: AnswerRow[];
}
