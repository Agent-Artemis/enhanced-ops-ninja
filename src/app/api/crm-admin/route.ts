/**
 * CRM admin utilities for Artemis (secret-protected).
 *
 * GET  ?what=stages            → list pipeline stages
 * POST {action:"set_stage", email, stage_name} → move a contact to a stage
 */
import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.LEADS_API_SECRET;
  return Boolean(secret && req.headers.get("x-leads-secret") === secret);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const what = new URL(req.url).searchParams.get("what");
  const admin = getSupabaseAdmin();

  if (what === "stages") {
    const { data, error } = await admin.from("crm_stages").select("id, name, position, color").order("position");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, stages: data });
  }

  // eon-app dojo pipeline (clients table, shared Supabase project)
  if (what === "client") {
    const email = new URL(req.url).searchParams.get("email") ?? "";
    const { data, error } = await admin.from("clients").select("*").ilike("primary_contact_email", email).limit(5);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, clients: data });
  }
  if (what === "client_stages") {
    const { data, error } = await admin.from("clients").select("pipeline_stage").limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const counts: Record<string, number> = {};
    for (const r of data ?? []) counts[String(r.pipeline_stage)] = (counts[String(r.pipeline_stage)] ?? 0) + 1;
    return NextResponse.json({ ok: true, stages: counts });
  }
  if (what === "assessment") {
    const email = new URL(req.url).searchParams.get("email") ?? "";
    const { data, error } = await admin
      .from("deep_dive_assessments")
      .select("id, email, business_type, assessment_score, module_scores, assessment_completed_at, appointment_scheduled_at, amount_paid")
      .ilike("email", email)
      .limit(3);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, assessments: data });
  }
  if (what === "briefings") {
    const email = new URL(req.url).searchParams.get("email") ?? "";
    const { data: client } = await admin
      .from("clients").select("id").ilike("primary_contact_email", email).limit(1).maybeSingle();
    if (!client?.id) return NextResponse.json({ ok: true, briefings: [], note: "no client row" });
    const { data, error } = await admin.from("briefings").select("*").eq("client_id", client.id).limit(3);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, briefings: data });
  }
  return NextResponse.json({ error: "Unknown query" }, { status: 400 });
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as
    | { action?: string; email?: string; stage_name?: string; stage?: string } | null;
  const admin = getSupabaseAdmin();

  // Bridge a completed funnel assessment onto the dojo Deep Dive tab by seeding
  // the eon-app `assessments` row (which that tab reads by client_id). Maps the
  // score summary into raw_notes so the coach starts from the funnel result
  // instead of a blank worksheet.
  const seedBody = body as { action?: string; email?: string } | null;
  if (seedBody?.action === "seed_dojo_assessment" && seedBody.email) {
    const email = seedBody.email;
    const { data: client } = await admin
      .from("clients").select("id, name").ilike("primary_contact_email", email).limit(1).maybeSingle();
    if (!client?.id) return NextResponse.json({ error: "no client row for email" }, { status: 404 });

    const { data: dd } = await admin
      .from("deep_dive_assessments")
      .select("assessment_score, module_scores, assessment_completed_at, business_type")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!dd) return NextResponse.json({ error: "no funnel assessment for email" }, { status: 404 });

    const moduleSummary = Object.entries((dd.module_scores as Record<string, number>) ?? {})
      .map(([m, s]) => `${m}: ${s}%`).join(" · ");
    const rawNotes =
      `FUNNEL DEEP-DIVE RESULT (auto-imported)\n` +
      `Overall score: ${dd.assessment_score}%\n` +
      `Module scores: ${moduleSummary}\n` +
      `Business type: ${dd.business_type ?? "n/a"}\n` +
      `Completed: ${(dd.assessment_completed_at ?? "").slice(0, 10)}`;

    // One assessments row per client — update if one already exists, else insert.
    const { data: existing } = await admin
      .from("assessments").select("id").eq("client_id", client.id).limit(1).maybeSingle();
    let result;
    if (existing?.id) {
      result = await admin.from("assessments")
        .update({ practice_name: client.name, assessment_date: (dd.assessment_completed_at ?? "").slice(0, 10), raw_notes: rawNotes })
        .eq("id", existing.id).select("id").maybeSingle();
    } else {
      result = await admin.from("assessments")
        .insert([{ client_id: client.id, status: "draft", practice_name: client.name, assessment_date: (dd.assessment_completed_at ?? "").slice(0, 10), raw_notes: rawNotes }])
        .select("id").maybeSingle();
    }
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, assessmentId: result.data?.id, seeded: rawNotes });
  }

  // Write notes text onto an eon-app dojo client card
  const notesBody = body as { action?: string; email?: string; notes?: string } | null;
  if (notesBody?.action === "set_client_notes" && notesBody.email && notesBody.notes) {
    const { data: updated, error } = await admin
      .from("clients")
      .update({ notes: notesBody.notes })
      .ilike("primary_contact_email", notesBody.email)
      .select("id, name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated });
  }

  // Move an eon-app dojo client to a different pipeline stage
  if (body?.action === "set_client_stage" && body.email && body.stage) {
    const { data: updated, error } = await admin
      .from("clients")
      .update({ pipeline_stage: body.stage })
      .ilike("primary_contact_email", body.email)
      .select("id, name, pipeline_stage");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated });
  }

  if (body?.action !== "set_stage" || !body.email || !body.stage_name) {
    return NextResponse.json({ error: "Expected {action:'set_stage', email, stage_name}" }, { status: 400 });
  }

  const { data: stage } = await admin
    .from("crm_stages").select("id, name").ilike("name", `%${body.stage_name}%`).limit(1).maybeSingle();
  if (!stage?.id) return NextResponse.json({ error: `No stage matching '${body.stage_name}'` }, { status: 404 });

  const { data: updated, error } = await admin
    .from("crm_contacts")
    .update({ stage_id: stage.id })
    .ilike("email", body.email)
    .select("id, first_name, last_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, stage: stage.name, updated });
}
