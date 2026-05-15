import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

import { createSupabaseAdmin } from "@/lib/ops-report/supabase-admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  clientName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  organizationName: z.string().trim().min(1).max(240),
  annualRevenue: z.number().finite().positive(),
  teamSize: z.number().int().min(1).max(500_000),
  track: z.enum(["healthcare", "general_business"]),
});

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID_INDEPTH;
  if (!stripeKey || !priceId) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID_INDEPTH" },
      { status: 503 },
    );
  }

  const json: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { clientName, email, organizationName, annualRevenue, teamSize, track } = parsed.data;

  try {
    const supabase = createSupabaseAdmin();
    const { data: row, error: insertError } = await supabase
      .from("ops_assessment_sessions")
      .insert({
        client_name: clientName,
        client_email: email,
        organization_name: organizationName,
        annual_revenue: annualRevenue,
        team_size: teamSize,
        track,
        status: "not_started",
        stripe_status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !row) {
      return NextResponse.json({ error: insertError?.message ?? "Failed to create session" }, { status: 500 });
    }

    const sessionId = row.id as string;
    const stripe = new Stripe(stripeKey);
    const base = siteUrl();

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      client_reference_id: sessionId,
      metadata: { ops_session_id: sessionId },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/in-depth-ops/${sessionId}?checkout=success`,
      cancel_url: `${base}/in-depth-ops?checkout=cancel`,
    });

    if (!checkout.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 });
    }

    return NextResponse.json({ checkoutUrl: checkout.url, sessionId });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
