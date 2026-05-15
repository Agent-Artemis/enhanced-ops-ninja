/**
 * Deep-dive checkout: creates a Stripe PaymentIntent and inserts into `deep_dive_assessments`.
 * A Supabase migration defining `deep_dive_assessments` is required (not present in this repo yet).
 */
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().min(1).max(40),
  orgName: z.string().trim().min(1).max(200),
  businessType: z.string().trim().min(1).max(200),
  discountCode: z.string().trim().max(64).optional(),
  affiliate: z.string().trim().max(120).optional(),
  amountPaid: z.number().finite().positive(),
});

type ConfigCheck =
  | { ok: true; stripeKey: string; supabaseUrl: string; supabaseServiceKey: string }
  | { ok: false; message: string };

function checkRequiredEnv(): ConfigCheck {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
    const missing: string[] = [];
    if (!stripeKey) missing.push("STRIPE_SECRET_KEY");
    if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    return {
      ok: false,
      message: `Missing required environment variables: ${missing.join(", ")}`,
    };
  }
  return { ok: true, stripeKey, supabaseUrl, supabaseServiceKey };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

export async function POST(req: Request) {
  const cfg = checkRequiredEnv();
  if (!cfg.ok) {
    return NextResponse.json({ error: cfg.message }, { status: 503 });
  }

  const json: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    orgName,
    businessType,
    discountCode,
    affiliate,
    amountPaid,
  } = parsed.data;

  const affiliateResolved = affiliate && affiliate.trim().length > 0 ? affiliate.trim() : "";
  const discountCodeValue =
    discountCode && discountCode.length > 0 ? discountCode : null;

  const stripe = new Stripe(cfg.stripeKey);
  const supabase = createClient(cfg.supabaseUrl, cfg.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountPaid * 100),
      currency: "usd",
      receipt_email: email,
      metadata: {
        firstName,
        lastName,
        email,
        phone,
        orgName,
        businessType,
        discountCode: discountCodeValue ?? "",
        affiliate: affiliateResolved,
        amountPaid: String(amountPaid),
      },
    });

    const clientSecret = paymentIntent.client_secret;
    if (!clientSecret) {
      return NextResponse.json(
        { error: "Payment intent did not return a client secret" },
        { status: 500 },
      );
    }

    const { data, error } = await supabase
      .from("deep_dive_assessments")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        org_name: orgName,
        business_type: businessType,
        discount_code: discountCodeValue,
        affiliate: affiliateResolved,
        amount_paid: amountPaid,
        stripe_payment_intent_id: paymentIntent.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create assessment record" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      clientSecret,
      assessmentId: data.id,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
