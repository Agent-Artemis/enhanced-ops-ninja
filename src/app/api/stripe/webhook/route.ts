import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Resend } from "resend";

import { createSupabaseAdmin } from "@/lib/ops-report/supabase-admin";

export const dynamic = "force-dynamic";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

const PRODUCT_LABEL: Record<string, string> = { snf: "Skilled Nursing", al: "Assisted Living" };
const TIER_LABEL: Record<string, string> = {
  rr: "Survey Review & Readiness",
  os: "Ninja Operating System",
  cc: "Command Center",
};

function complianceWelcomeEmail(productLabel: string, tierLabel: string, actionLink: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0A0F1A;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#EEF3FA">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <img src="https://enhancedops.ninja/logo-ninja.png" alt="EnhancedOps.ninja" style="height:44px;margin-bottom:20px">
    <h1 style="font-size:22px;margin:0 0 8px">You're in. 🥷</h1>
    <p style="color:#AEBBCD;font-size:15px;line-height:1.55;margin:0 0 6px">Your <b style="color:#EEF3FA">${productLabel} — ${tierLabel}</b> account is ready.</p>
    <p style="color:#AEBBCD;font-size:15px;line-height:1.55;margin:0 0 22px">Tap below to set your password and open your command center.</p>
    <a href="${actionLink}" style="display:inline-block;background:#1A6ECC;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 26px;border-radius:10px">Set my password &amp; log in</a>
    <p style="color:#7E8DA0;font-size:12.5px;line-height:1.5;margin:24px 0 0">This link signs you in once and lets you choose a password. If it expires, request a fresh login link from the site. Questions? Just reply to this email.</p>
  </div></body></html>`;
}

/**
 * A compliance product (SNF/AL) was purchased via a Payment Link (subscription mode).
 * Create/invite the buyer's Supabase login, record the entitlement, and email a
 * one-time set-password link to the right product site. Best-effort throughout —
 * a failure here must still 200 the webhook so Stripe doesn't retry-storm.
 */
async function provisionComplianceAccount(
  stripe: Stripe,
  supabase: ReturnType<typeof createSupabaseAdmin>,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  if (!email) return;

  // product (snf/al) + tier (rr/os/cc) from the payment link metadata
  let vert = "";
  let tier = "";
  const plId = typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id ?? null;
  if (plId) {
    try {
      const pl = await stripe.paymentLinks.retrieve(plId);
      vert = (pl.metadata?.vert as string) ?? "";
      tier = (pl.metadata?.plan as string) ?? "";
    } catch {
      /* fall through with defaults */
    }
  }
  const product = vert === "al" ? "al" : "snf";
  const site = product === "al" ? "https://al.enhancedops.ninja" : "https://snf.enhancedops.ninja";
  const redirectTo = `${site}/welcome`;

  // create the user (invite) or, if they exist, a magic link — either logs them in once
  let actionLink = `${site}/welcome`;
  try {
    const { data } = await supabase.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = (data as any)?.properties?.action_link as string | undefined;
    if (link) actionLink = link;
  } catch {
    try {
      const { data } = await supabase.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const link = (data as any)?.properties?.action_link as string | undefined;
      if (link) actionLink = link;
    } catch {
      /* keep the plain site link */
    }
  }

  // record the entitlement (one row per email+product)
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  try {
    await supabase.from("compliance_entitlements").upsert(
      {
        email,
        product,
        tier: tier || null,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,product" },
    );
  } catch {
    /* best-effort */
  }

  // email the set-password / access link
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "jeff@enhancedops.ninja",
        to: email,
        subject: `Your EnhancedOps ${PRODUCT_LABEL[product]} access is ready`,
        html: complianceWelcomeEmail(PRODUCT_LABEL[product], TIER_LABEL[tier] ?? "Command Center", actionLink),
      });
    } catch {
      /* best-effort */
    }
  }
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

      // Compliance product purchase — monthly/annual (subscription) OR "OWN IT" (one-time).
      // Detect via our payment link's vert/plan metadata so it works for any mode and
      // does NOT catch the ops-assessment checkout (which comes from no such link).
      const plId =
        typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id ?? null;
      if (plId) {
        let plMeta: Record<string, string> = {};
        try {
          const pl = await stripe.paymentLinks.retrieve(plId);
          plMeta = (pl.metadata as Record<string, string>) ?? {};
        } catch {
          /* ignore */
        }
        if (plMeta.vert && plMeta.plan) {
          await provisionComplianceAccount(stripe, supabase, session);
          return NextResponse.json({ received: true, provisioned: true });
        }
      }

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
