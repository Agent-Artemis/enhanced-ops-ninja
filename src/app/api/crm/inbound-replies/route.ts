/**
 * Inbound-replies queue for the CRM Social tab.
 *
 * These are LinkedIn/email replies that couldn't be tied to a single lead card
 * (zero or multiple name matches) — surfaced so Jeff can still see "someone
 * messaged you" and go reply on LinkedIn.
 *
 * GET  → { replies: [...] }  unhandled rows, newest first, limit 50.
 * POST { id } → mark that row handled (handled=true, handled_at=now).
 *
 * Headers: Authorization: Bearer <supabase-jwt>  (an @enhancedops.ninja / Jeff user)
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isAllowed(email: string) {
  return email.endsWith("@enhancedops.ninja") || email === "jeff@augeo-hq.com";
}

async function authUser(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const admin = getSupabaseAdmin();
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);
  if (authError || !user?.email || !isAllowed(user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { admin };
}

export async function GET(req: Request) {
  const { admin, error } = await authUser(req);
  if (error) return error;

  const { data, error: dbError } = await admin!
    .from("inbound_replies")
    .select("id, name, source, snippet, received_at")
    .eq("handled", false)
    .order("received_at", { ascending: false })
    .limit(50);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ replies: data ?? [] });
}

export async function POST(req: Request) {
  const { admin, error } = await authUser(req);
  if (error) return error;

  const body: unknown = await req.json().catch(() => null);
  const id = body && typeof body === "object" ? (body as { id?: unknown }).id : undefined;
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "Invalid body — expected { id }" }, { status: 400 });
  }

  const { error: dbError } = await admin!
    .from("inbound_replies")
    .update({ handled: true, handled_at: new Date().toISOString() })
    .eq("id", id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
