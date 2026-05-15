import { NextResponse } from "next/server";
import Stripe from "stripe";

import { createSupabaseAdmin } from "@/lib/ops-report/supabase-admin";

export const dynamic = "force-dynamic";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!webhookSecret || !stripeKey) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const payload = await req.text();
  const stripe = new Stripe(stripeKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const opsSessionId = session.client_reference_id ?? session.metadata?.ops_session_id;
      if (!opsSessionId) {
        return NextResponse.json({ received: true, ignored: true });
      }

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;

      const { data: existing } = await supabase
        .from("ops_assessment_sessions")
        .select("id,stripe_status,stripe_payment_id,status,started_at")
        .eq("id", opsSessionId)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json({ received: true, ignored: true });
      }

      const resolvedPaymentId = paymentIntentId ?? session.id;
      if (existing.stripe_status === "paid" && existing.stripe_payment_id === resolvedPaymentId) {
        return NextResponse.json({ received: true, idempotent: true });
      }

      const nextStatus =
        existing.status === "completed" ? "completed" : existing.status === "not_started" ? "in_progress" : existing.status;

      const { error } = await supabase
        .from("ops_assessment_sessions")
        .update({
          stripe_status: "paid",
          stripe_payment_id: resolvedPaymentId,
          status: nextStatus,
          started_at: existing.started_at ?? new Date().toISOString(),
        })
        .eq("id", opsSessionId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
