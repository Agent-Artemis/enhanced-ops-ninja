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
