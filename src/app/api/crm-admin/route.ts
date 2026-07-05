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
  return NextResponse.json({ error: "Unknown query" }, { status: 400 });
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as
    | { action?: string; email?: string; stage_name?: string } | null;
  if (body?.action !== "set_stage" || !body.email || !body.stage_name) {
    return NextResponse.json({ error: "Expected {action:'set_stage', email, stage_name}" }, { status: 400 });
  }
  const admin = getSupabaseAdmin();

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
