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
