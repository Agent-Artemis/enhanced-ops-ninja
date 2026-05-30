/**
 * Deep-dive checkout: creates a Stripe PaymentIntent and inserts into `deep_dive_assessments`.
 * A Supabase migration defining `deep_dive_assessments` is required (not present in this repo yet).
 */
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { insertDeepDiveAssessment } from "@/lib/deep-dive/insert-deep-dive-assessment";

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
  amountPaid: z.number().finite().min(0),
});

type SupabaseConfigCheck =
  | { ok: true; supabaseUrl: string; supabaseServiceKey: string }
  | { ok: false; message: string };

type ConfigCheck =
  | { ok: true; stripeKey: string; supabaseUrl: string; supabaseServiceKey: string }
  | { ok: false; message: string };

function checkSupabaseEnv(): SupabaseConfigCheck {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    return {
      ok: false,
      message: `Missing required environment variables: ${missing.join(", ")}`,
    };
  }
  return { ok: true, supabaseUrl, supabaseServiceKey };
}

function checkRequiredEnv(): ConfigCheck {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabase = checkSupabaseEnv();
  if (!supabase.ok) {
    return supabase;
  }
  if (!stripeKey) {
    return {
      ok: false,
      message: "Missing required environment variables: STRIPE_SECRET_KEY",
    };
  }
  return { ok: true, stripeKey, supabaseUrl: supabase.supabaseUrl, supabaseServiceKey: supabase.supabaseServiceKey };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

type AssessmentInsertFields = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  orgName: string;
  businessType: string;
  discountCodeValue: string | null;
  affiliateResolved: string;
  amountPaid: number;
};

async function insertAssessmentRecord(
  supabaseUrl: string,
  supabaseServiceKey: string,
  fields: AssessmentInsertFields,
  payment: { stripePaymentIntentId: string; paymentStatus?: string },
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const row: Record<string, string | number | null> = {
    first_name: fields.firstName,
    last_name: fields.lastName,
    email: fields.email,
    phone: fields.phone,
    org_name: fields.orgName,
    business_type: fields.businessType,
    discount_code: fields.discountCodeValue,
    affiliate: fields.affiliateResolved,
    amount_paid: fields.amountPaid,
    stripe_payment_intent_id: payment.stripePaymentIntentId,
  };
  if (payment.paymentStatus) {
    row.payment_status = payment.paymentStatus;
  }

  const result = await insertDeepDiveAssessment(supabase, row, {
    lookupIdOnDuplicate: true,
    email: fields.email,
  });

  if (!result.ok) {
    return { data: null, error: { message: result.error.message, code: result.error.code } };
  }

  if (!result.id) {
    return { data: null, error: { message: "Failed to create assessment record" } };
  }

  return { data: { id: result.id }, error: null };
}

export async function POST(req: Request) {
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

  const insertFields: AssessmentInsertFields = {
    firstName,
    lastName,
    email,
    phone,
    orgName,
    businessType,
    discountCodeValue,
    affiliateResolved,
    amountPaid,
  };

  if (amountPaid === 0) {
    const cfg = checkSupabaseEnv();
    if (!cfg.ok) {
      return NextResponse.json({ error: cfg.message }, { status: 503 });
    }

    try {
      const { data, error } = await insertAssessmentRecord(cfg.supabaseUrl, cfg.supabaseServiceKey, insertFields, {
        stripePaymentIntentId: "BYPASS",
        paymentStatus: "paid",
      });

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message ?? "Failed to create assessment record" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        clientSecret: null,
        assessmentId: data.id,
        bypass: true,
      });
    } catch (err: unknown) {
      return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
    }
  }

  const cfg = checkRequiredEnv();
  if (!cfg.ok) {
    return NextResponse.json({ error: cfg.message }, { status: 503 });
  }

  const stripe = new Stripe(cfg.stripeKey);

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

    const { data, error } = await insertAssessmentRecord(
      cfg.supabaseUrl,
      cfg.supabaseServiceKey,
      insertFields,
      {
        stripePaymentIntentId: paymentIntent.id,
      },
    );

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
