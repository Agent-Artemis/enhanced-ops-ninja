/**
 * Client portal data endpoint.
 *
 * The eon-app (mission.enhancedops.ninja) calls this with the client's
 * Supabase JWT. We verify it here using the service role, then return
 * everything the client needs to render their mission portal.
 *
 * GET /api/client-portal/data
 * Headers: Authorization: Bearer <supabase-jwt>
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const CORS_ORIGINS = [
  "https://mission.enhancedops.ninja",
  "https://dojo.enhancedops.ninja",
  "http://localhost:5173",
  "http://localhost:5174",
];

function corsHeaders(origin: string | null) {
  const allowed = origin && CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(req: Request) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  const admin = getSupabaseAdmin();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);

  if (authError || !user?.email) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401, headers });
  }

  const email = user.email;

  // ── Assessment ─────────────────────────────────────────────────────────────
  const { data: assessment } = await admin
    .from("deep_dive_assessments")
    .select("assessment_score, module_scores, assessment_completed_at, business_type, first_name, appointment_scheduled_at")
    .eq("email", email)
    .not("assessment_completed_at", "is", null)
    .order("assessment_completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!assessment) {
    return NextResponse.json({ error: "No completed assessment found for this account" }, { status: 404, headers });
  }

  // ── Client CRM record ──────────────────────────────────────────────────────
  const { data: client } = await admin
    .from("clients")
    .select("id, name, pipeline_stage, primary_contact_name")
    .eq("primary_contact_email", email)
    .maybeSingle();

  // ── Briefing (if client record exists) ────────────────────────────────────
  let briefing = null;
  if (client?.id) {
    const { data: b } = await admin
      .from("briefings")
      .select("status, custom_staff_story, custom_financial_story, custom_patient_story")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    briefing = b;
  }

  // ── Mission Map (live only) ────────────────────────────────────────────────
  let missionMap = null;
  if (client?.id) {
    const { data: map } = await admin
      .from("mission_maps")
      .select("id, status, client_initials")
      .eq("client_id", client.id)
      .eq("status", "live")
      .maybeSingle();

    if (map) {
      // Columns + tasks
      const { data: columns } = await admin
        .from("map_columns")
        .select("id, title, sort_order")
        .eq("mission_map_id", map.id)
        .order("sort_order", { ascending: true });

      const { data: tasks } = await admin
        .from("map_tasks")
        .select("id, column_id, title, completed, sort_order")
        .eq("mission_map_id", map.id)
        .order("sort_order", { ascending: true });

      missionMap = {
        status: map.status,
        clientInitials: map.client_initials,
        columns: (columns ?? []).map((col) => ({
          id: col.id,
          title: col.title,
          tasks: (tasks ?? [])
            .filter((t) => t.column_id === col.id)
            .sort((a, b) => a.sort_order - b.sort_order),
        })),
      };
    }
  }

  return NextResponse.json(
    {
      assessment: {
        overallScore: assessment.assessment_score,
        moduleScores: assessment.module_scores,
        completedAt: assessment.assessment_completed_at,
        businessType: assessment.business_type,
        firstName: assessment.first_name,
        appointmentScheduledAt: assessment.appointment_scheduled_at,
      },
      client: client
        ? {
            id: client.id,
            name: client.name,
            pipelineStage: client.pipeline_stage,
            contactName: client.primary_contact_name,
          }
        : null,
      briefing: briefing
        ? {
            status: briefing.status,
            staffStory: briefing.custom_staff_story,
            financialStory: briefing.custom_financial_story,
            patientStory: briefing.custom_patient_story,
          }
        : null,
      missionMap,
    },
    { status: 200, headers },
  );
}
