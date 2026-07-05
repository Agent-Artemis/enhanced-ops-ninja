/**
 * Diagnostics: returns Resend domain verification status + required DNS
 * records. Secret-protected; used to recover lost DNS records.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.LEADS_API_SECRET;
  if (!secret || req.headers.get("x-leads-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "No RESEND_API_KEY" }, { status: 503 });

  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${key}` },
  });
  const list = await res.json();

  // Fetch full record details per domain
  const domains = [];
  for (const d of list?.data ?? []) {
    const dr = await fetch(`https://api.resend.com/domains/${d.id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    domains.push(await dr.json());
  }
  return NextResponse.json({ ok: true, domains });
}

/** Create the sending domain (idempotent-ish: 409/validation if it exists). */
export async function POST(req: Request) {
  const secret = process.env.LEADS_API_SECRET;
  if (!secret || req.headers.get("x-leads-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "No RESEND_API_KEY" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" && body.name ? body.name : "enhancedops.ninja";
  const action = typeof body?.verify === "string" ? body.verify : null;

  if (action) {
    // body.verify = domain id → trigger verification check
    const vr = await fetch(`https://api.resend.com/domains/${action}/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
    });
    return NextResponse.json({ ok: vr.ok, result: await vr.json().catch(() => null) });
  }

  const res = await fetch("https://api.resend.com/domains", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return NextResponse.json({ ok: res.ok, result: await res.json().catch(() => null) });
}
