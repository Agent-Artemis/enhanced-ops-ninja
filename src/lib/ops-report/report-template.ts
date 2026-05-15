import type { ReportData } from "@/types/report";
import { getStatusColor, getStatusEmoji, getStatusLabel } from "@/lib/ops-report/scoring";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function section(title: string, inner: string): string {
  return `
  <section class="page">
    <h2>${esc(title)}</h2>
    ${inner}
  </section>`;
}

function table(headers: string[], rows: string[][]): string {
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function generateReportHTML(data: ReportData): string {
  const brand = "EnhancedOps.ninja";
  const statusColor = getStatusColor(data.overall_status);
  const statusLabel = getStatusLabel(data.overall_status);
  const statusEmoji = getStatusEmoji(data.overall_status);

  const moduleSections = data.modules
    .map((m) => {
      const color = getStatusColor(m.status_color);
      const findings = m.findings.map((f) => `<li>${esc(f)}</li>`).join("");
      const actions = m.actions.map((a) => `<li>${esc(a)}</li>`).join("");
      const calcRows = m.calc_table.map((row) => [row.input, row.value, row.source]);
      const calcHtml =
        calcRows.length > 0
          ? table(["Input", "Value", "Source / Notes"], calcRows)
          : `<p class="muted">No dollar-loss table for optimized modules.</p>`;

      return section(
        `Module ${m.module_number}: ${m.module_name}`,
        `
        <div class="status-pill" style="border-color:${color};color:${color}">
          ${esc(m.status_color)} · ${esc(getStatusLabel(m.status_color))} · Score ${m.module_score_pct.toFixed(1)}%
        </div>
        <p><strong>Estimated annual impact:</strong> ${esc(m.dollar_loss_label)} (${esc(String(m.dollar_loss_calculated))})</p>
        <p><strong>Recommended offer:</strong> ${esc(m.recommended_offer)}</p>
        <p class="muted">${esc(m.recommended_offer_description)}</p>
        <p><strong>Deployment:</strong> ${esc(m.deployment_timeline)} · <strong>Expected impact:</strong> ${esc(m.expected_impact)}</p>
        <h3>Findings</h3>
        <ul>${findings || "<li>No material weak signals in sampled answers.</li>"}</ul>
        <h3>Recommended actions</h3>
        <ul>${actions}</ul>
        <h3>Dollar math</h3>
        ${calcHtml}
      `,
      );
    })
    .join("\n");

  const phaseBlock = (title: string, items: typeof data.phase_1_recommendations) => {
    const rows = items.map((p) => [p.module, p.offer, p.target_outcome, p.dollar_recovery]);
    return section(title, table(["Module", "Offer / program", "Target outcome", "Est. recovery"], rows));
  };

  const appendixRows = data.answers.map((a) => [
    a.module_name,
    String(a.question_number),
    a.question_text,
    a.answer_choice,
    String(a.answer_points),
  ]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(data.organization_name)} — Operations Assessment</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 12.5px;
      line-height: 1.55;
    }
    .page {
      page-break-after: always;
      padding: 8px 4px 28px;
    }
    .page:last-child { page-break-after: auto; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: -0.02em; }
    h2 { font-size: 18px; margin: 18px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
    h3 { font-size: 14px; margin: 14px 0 8px; color: #334155; }
    .muted { color: #64748b; }
    .hero {
      min-height: 70vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 12px;
    }
    .brand { font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #0f172a; }
    .score {
      font-size: 56px;
      font-weight: 900;
      line-height: 1;
      color: ${statusColor};
    }
    .pill {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid ${statusColor};
      color: ${statusColor};
      font-weight: 700;
      font-size: 12px;
    }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px;
      background: #f8fafc;
    }
    table.data {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 11.5px;
    }
    table.data th, table.data td {
      border: 1px solid #e2e8f0;
      padding: 8px;
      vertical-align: top;
    }
    table.data th {
      background: #f1f5f9;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #475569;
    }
    ul { margin: 8px 0 0 18px; }
    li { margin: 6px 0; }
    .status-pill {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 10px;
      border: 2px solid #e2e8f0;
      font-weight: 800;
      margin: 8px 0 10px;
    }
    .footer {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      color: #64748b;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <section class="page">
    <div class="hero">
      <div class="brand">${esc(brand)}</div>
      <h1>Operations Health Report</h1>
      <p class="muted" style="font-size:16px;margin:0;">Prepared for <strong>${esc(data.client_name)}</strong> · ${esc(
        data.organization_name,
      )}</p>
      <p class="muted" style="margin:0;">Completed ${esc(data.completed_at)} · Track: ${esc(data.track)}</p>
      <div style="margin-top:18px;">
        <div class="score">${data.overall_score.toFixed(1)}</div>
        <div class="pill">${esc(statusEmoji)} ${esc(statusLabel)} overall</div>
      </div>
      <div class="grid2" style="margin-top:18px;">
        <div class="card">
          <div class="muted">Annual revenue</div>
          <div style="font-size:20px;font-weight:800;">$${(data.annual_revenue / 1000).toFixed(0)}K</div>
        </div>
        <div class="card">
          <div class="muted">Team size</div>
          <div style="font-size:20px;font-weight:800;">${data.team_size} FTEs</div>
        </div>
      </div>
      <p style="margin-top:18px;max-width:72ch;"><strong>Total modeled exposure:</strong> ${esc(
        data.total_dollar_loss_label,
      )} (${esc(String(data.total_dollar_loss))})</p>
      <div class="footer">Confidential — prepared for internal planning and discussion with Enhanced Ops.</div>
    </div>
  </section>

  ${section(
    "Executive summary",
    `<p>${esc(data.executive_narrative)}</p>
     <div class="grid2" style="margin-top:12px;">
       <div class="card">
         <div class="muted">Points earned</div>
         <div style="font-size:18px;font-weight:800;">${data.total_points_earned} / ${data.max_possible_points}</div>
       </div>
       <div class="card">
         <div class="muted">Top priorities</div>
         <ol style="margin:8px 0 0 18px;">
           <li><strong>${esc(data.priority_1_module)}</strong> — ${esc(data.priority_1_finding)}</li>
           <li><strong>${esc(data.priority_2_module)}</strong> — ${esc(data.priority_2_finding)}</li>
           <li><strong>${esc(data.priority_3_module)}</strong> — ${esc(data.priority_3_finding)}</li>
         </ol>
       </div>
     </div>`,
  )}

  ${section(
    "How to read this report",
    `<p>This report converts assessment signals into directional dollar ranges using conservative SMB benchmarks. Figures are planning tools — not audits — and should be validated against your books.</p>
     <ul>
       <li><strong style="color:#ef4444">RED</strong> — material gap vs. benchmark; prioritize within 30 days.</li>
       <li><strong style="color:#f59e0b">YELLOW</strong> — partial controls; risk rises with growth.</li>
       <li><strong style="color:#22c55e">GREEN</strong> — strong discipline; protect while scaling.</li>
     </ul>`,
  )}

  ${section(
    "Overall scoring model",
    table(
      ["Concept", "Detail"],
      [
        ["Weighted module score", "Each module contributes based on operational risk weighting."],
        ["Dollar loss modules", "GREEN modules contribute $0 to modeled annual loss totals."],
        ["Findings", "Based on lowest-scoring answers within each module for narrative focus."],
      ],
    ),
  )}

  ${moduleSections}

  ${phaseBlock("90-day roadmap — Phase 1", data.phase_1_recommendations)}
  ${phaseBlock("90-day roadmap — Phase 2", data.phase_2_recommendations)}
  ${phaseBlock("90-day roadmap — Phase 3", data.phase_3_recommendations)}

  ${section(
    "Appendix — full answer log",
    table(["Module", "#", "Question", "Choice", "Points"], appendixRows),
  )}

  <section class="page">
    <h2>Closing</h2>
    <p>You now have a prioritized operational picture: where money leaks, where risk concentrates, and what to do first.</p>
    <p class="muted">Generated by ${esc(brand)} · ${esc(data.completed_at)}</p>
    <div class="footer">© ${new Date().getFullYear()} Enhanced Ops — Jeff Oldroyd</div>
  </section>
</body>
</html>`;
}
