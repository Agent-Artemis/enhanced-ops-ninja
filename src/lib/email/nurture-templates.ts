const FREE_AUDIT_URL = "https://enhancedops.ninja/visibility-audit";
const BOOKING_URL = "https://enhancedops.ninja/book/briefing";
const UNSUBSCRIBE_URL = "https://enhancedops.ninja/unsubscribe";

function e(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function shell(body: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:24px 16px;font-family:ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.6;color:#0f172a;background:#f8fafc;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;border:1px solid #e2e8f0;">
<tr><td>
${body}
<p style="margin:28px 0 0;font-size:12px;color:#94a3b8;">EnhancedOps.ninja &nbsp;·&nbsp; <a href="${UNSUBSCRIBE_URL}" style="color:#94a3b8;">Unsubscribe</a></p>
</td></tr>
</table>
</body></html>`;
}

function primaryBtn(href: string, label: string) {
  return `<p style="margin:20px 0 0;"><a href="${href}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px;">${label}</a></p>`;
}

function bandLabel(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Developing";
  if (score >= 40) return "At Risk";
  return "Critical";
}

// ── Step 0: Results + free Visibility Audit offer ────────────────────────────
export function buildResultsEmail(params: {
  firstName: string;
  overallScore: number;
}) {
  const name = e(params.firstName);
  const score = Math.round(params.overallScore);
  const band = bandLabel(score);
  return {
    subject: `Your Free Operations Assessment Results — ${score}/100`,
    html: shell(`
<p style="margin:0 0 16px;">Hi ${name},</p>
<p style="margin:0 0 16px;">You just completed the EON Free Operations Assessment. Here's where you landed:</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;width:100%;">
  <tr>
    <td style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;text-align:center;">
      <div style="font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;margin:0 0 4px;">Overall Score</div>
      <div style="font-size:36px;font-weight:800;color:#0f172a;line-height:1;">${score}<span style="font-size:18px;font-weight:500;color:#64748b;"> / 100</span></div>
      <div style="margin-top:6px;font-size:13px;font-weight:600;color:#64748b;">${band}</div>
    </td>
  </tr>
</table>
<p style="margin:0 0 14px;">The score flags where disconnected systems are costing you the most — missed revenue, staff hours burned on manual hand-offs, and zero cross-location visibility.</p>
<p style="margin:0 0 14px;"><strong>Next step — free, no pitch:</strong> a Visibility Audit where we map your actual systems, name the exact metrics you're flying blind on, and mock up what your single command center could look like. Owners typically spot $8K–$30K/month in recoverable waste on that first call.</p>
${primaryBtn(FREE_AUDIT_URL, "Claim My Free Visibility Audit →")}
${primaryBtn(BOOKING_URL, "Or Book a 30-min Strategy Call →")}
<p style="margin:20px 0 0;color:#64748b;font-size:14px;">— Jeff Oldroyd, EON</p>
`),
  };
}

// ── Step 1: Day 2 warm-up — social proof + remove the "unproven" objection ──
export function buildDay2Email(params: { firstName: string }) {
  const name = e(params.firstName);
  return {
    subject: `What "one screen for every location" actually looks like`,
    html: shell(`
<p style="margin:0 0 16px;">Hi ${name},</p>
<p style="margin:0 0 16px;">The #1 pushback I hear from multi-location owners: <em>"Sounds great — but is it proven?"</em></p>
<p style="margin:0 0 16px;">Fair question. Here's what the Visibility Audit surfaces in a typical 3–5 location practice:</p>
<ul style="margin:0 0 16px;padding-left:20px;color:#334155;">
  <li style="margin-bottom:8px;"><strong>45% of staff time</strong> lost to swivel-chairing between disconnected tools</li>
  <li style="margin-bottom:8px;"><strong>Zero cross-location revenue view</strong> — owners make pricing and staffing calls blind</li>
  <li style="margin-bottom:8px;"><strong>$18K–$30K/month</strong> in recoverable labor waste in a 20–28 staff operation</li>
</ul>
<p style="margin:0 0 16px;">The audit takes 45 minutes. We map your stack, find your blind spots, and show you the one screen that fixes it. No obligation — the blueprint is yours to keep.</p>
${primaryBtn(FREE_AUDIT_URL, "Claim My Free Visibility Audit →")}
<p style="margin:20px 0 0;color:#64748b;font-size:14px;">— Jeff</p>
`),
  };
}

// ── Step 2: Day 5 — "tech fatigue" angle + the dog-walking line ─────────────
export function buildDay5Email(params: { firstName: string }) {
  const name = e(params.firstName);
  return {
    subject: `Are you walking the dog, or is the dog walking you?`,
    html: shell(`
<p style="margin:0 0 16px;">Hi ${name},</p>
<p style="margin:0 0 16px;">Quick gut-check: right now, who controls your day — you, or your tools?</p>
<p style="margin:0 0 16px;">Most multi-location owners I talk to aren't short on software. They have six tools. The problem is none of them talk to each other, so the owner becomes the integration layer — manually pulling data, chasing reports, and troubleshooting hand-offs that should run themselves.</p>
<p style="margin:0 0 16px;">That's the dog walking you.</p>
<p style="margin:0 0 16px;">The fix isn't another tool. It's a <strong>single command center built on top of the tools you already have</strong> — wired specifically to your stack, not a template. One screen. Every location. Real time.</p>
<p style="margin:0 0 16px;">The Visibility Audit is where we build that map for your business. Free. 45 minutes.</p>
${primaryBtn(FREE_AUDIT_URL, "Book My Visibility Audit →")}
<p style="margin:20px 0 0;color:#64748b;font-size:14px;">— Jeff</p>
`),
  };
}

// ── Step 3: Day 10 — abandonment recovery + risk reversal ────────────────────
export function buildDay10Email(params: { firstName: string }) {
  const name = e(params.firstName);
  return {
    subject: `Last note from me — here's the honest version`,
    html: shell(`
<p style="margin:0 0 16px;">Hi ${name},</p>
<p style="margin:0 0 16px;">I'll keep this short. You took the assessment — that tells me you know something in your ops isn't working the way it should.</p>
<p style="margin:0 0 16px;">If the Visibility Audit hasn't felt worth your 45 minutes, here's the honest version of what it is:</p>
<ul style="margin:0 0 16px;padding-left:20px;color:#334155;">
  <li style="margin-bottom:8px;">We map exactly where your systems break down</li>
  <li style="margin-bottom:8px;">We put a dollar figure on the waste — real math from your numbers</li>
  <li style="margin-bottom:8px;">You leave with a blueprint of your command center, whether we ever work together or not</li>
</ul>
<p style="margin:0 0 16px;">No pitch. No pressure. If we're not the right fit for your situation, I'll tell you that on the call.</p>
${primaryBtn(FREE_AUDIT_URL, "Book the Free Visibility Audit →")}
<p style="margin:16px 0 0;color:#64748b;font-size:14px;">If timing's off or you'd rather I stop reaching out, just reply and let me know. No hard feelings either way.</p>
<p style="margin:8px 0 0;color:#64748b;font-size:14px;">— Jeff</p>
`),
  };
}

export type NurtureStep = 0 | 1 | 2 | 3;

export function buildNurtureEmail(
  step: NurtureStep,
  params: { firstName: string; overallScore?: number },
): { subject: string; html: string } {
  switch (step) {
    case 0: return buildResultsEmail({ firstName: params.firstName, overallScore: params.overallScore ?? 0 });
    case 1: return buildDay2Email(params);
    case 2: return buildDay5Email(params);
    case 3: return buildDay10Email(params);
  }
}

// Days offset from completion for each step
export const NURTURE_SCHEDULE_DAYS: Record<NurtureStep, number> = {
  0: 0,   // immediate (results email)
  1: 2,   // day 2
  2: 5,   // day 5
  3: 10,  // day 10
};
