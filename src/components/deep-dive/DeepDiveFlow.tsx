"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  basePricing,
  DEEP_DIVE_BASE_USD,
  formatUsd,
  resolveDiscountOrAffiliateCode,
  type AppliedPricing,
  type BusinessTrack,
} from "@/lib/deep-dive/pricing";
import { DEEP_DIVE_LS, writeLocalStorage, writeLocalStorageIfEmpty } from "@/lib/deep-dive/assessment-storage";

type Step = 0 | 1 | 2;

type CheckoutForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  orgName: string;
};

type CreatePaymentIntentSuccess = {
  clientSecret: string;
  assessmentId: string;
};

type CreatePaymentIntentError = {
  error: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCreatePaymentIntentJson(json: unknown): CreatePaymentIntentSuccess | CreatePaymentIntentError {
  if (!isRecord(json)) {
    return { error: "Unexpected response from server." };
  }
  if (typeof json.error === "string") {
    return { error: json.error };
  }
  const clientSecret = json.clientSecret;
  const assessmentId = json.assessmentId;
  if (typeof clientSecret === "string" && typeof assessmentId === "string") {
    return { clientSecret, assessmentId };
  }
  return { error: "Invalid payment response." };
}

function buildPaymentPayload(
  form: CheckoutForm,
  businessType: BusinessTrack,
  pricing: AppliedPricing,
): Record<string, string | number> {
  const body: Record<string, string | number> = {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    orgName: form.orgName.trim(),
    businessType,
    amountPaid: pricing.amountPaid,
  };
  if (pricing.kind === "discount") {
    body.discountCode = pricing.discountCode;
  }
  if (pricing.kind === "affiliate") {
    body.affiliate = pricing.affiliate;
  }
  return body;
}

const cardShellClass =
  "flex cursor-pointer flex-col rounded-xl border border-[rgb(26_110_204/0.3)] bg-eon-card p-8 text-left transition hover:border-[rgb(26_110_204/0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A6ECC]";

const inputClass =
  "w-full rounded-lg border border-[rgb(255_255_255/0.12)] bg-[rgb(10_10_10)] px-3 py-2.5 text-[15px] text-white placeholder:text-[rgb(255_255_255/0.35)] focus:border-[#1A6ECC] focus:outline-none";

const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-[rgb(255_255_255/0.55)]";

function StepProgress(props: { step: Step }) {
  const human = props.step + 1;
  return (
    <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(255_255_255/0.45)]">
      Step {human} of 3
    </p>
  );
}

function HealthcareSalesCopy() {
  return (
    <ul className="mb-8 list-none space-y-3 text-[15px] leading-relaxed text-[rgb(255_255_255/0.72)]">
      <li>
        <span className="font-semibold text-[#1A6ECC]">✓ </span>
        Operations deep dive tuned for clinics, groups, and healthcare services organizations.
      </li>
      <li>
        <span className="font-semibold text-[#1A6ECC]">✓ </span>
        Domain scores, rollups, and a leadership-ready PDF aligned with how you deliver care and
        run the business.
      </li>
      <li>
        <span className="font-semibold text-[#1A6ECC]">✓ </span>
        Plan on <strong className="text-white">about 45–60 minutes</strong> to complete the full
        questionnaire after checkout.
      </li>
      <li>
        <span className="font-semibold text-[#1A6ECC]">✓ </span>
        Next: secure checkout — card on file, receipt to your email.
      </li>
    </ul>
  );
}

function GeneralBusinessSalesCopy() {
  return (
    <ul className="mb-8 list-none space-y-3 text-[15px] leading-relaxed text-[rgb(255_255_255/0.72)]">
      <li>
        <span className="font-semibold text-[#1A6ECC]">✓ </span>
        End-to-end operational assessment for teams ready to standardize, automate, and scale.
      </li>
      <li>
        <span className="font-semibold text-[#1A6ECC]">✓ </span>
        Clear domain scores plus an overall health score and a polished PDF for stakeholders.
      </li>
      <li>
        <span className="font-semibold text-[#1A6ECC]">✓ </span>
        Plan on <strong className="text-white">about 45–60 minutes</strong> to complete the full
        questionnaire after checkout.
      </li>
      <li>
        <span className="font-semibold text-[#1A6ECC]">✓ </span>
        Next: secure checkout — card on file, receipt to your email.
      </li>
    </ul>
  );
}

type PaySectionProps = {
  assessmentId: string;
  amountLabel: string;
  track: BusinessTrack;
  email: string;
  firstName: string;
  onPaid: () => void;
};

function InnerPaySection(props: PaySectionProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elementReady, setElementReady] = useState(false);
  const [elementComplete, setElementComplete] = useState(false);

  const onElementChange = useCallback((e: { complete: boolean }) => {
    setElementComplete(e.complete);
  }, []);

  const handleSubmit = async () => {
    if (!stripe || !elements) {
      setErrorMessage("Payment form is still loading. Try again in a moment.");
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    const origin = window.location.origin;
    const returnUrl = `${origin}/deep-dive/assessment?deepDiveAssessmentId=${encodeURIComponent(props.assessmentId)}`;
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });
    setBusy(false);
    if (error) {
      setErrorMessage(error.message ?? "Payment could not be completed.");
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      writeLocalStorage(DEEP_DIVE_LS.assessmentId, props.assessmentId);
      writeLocalStorageIfEmpty(DEEP_DIVE_LS.businessType, props.track);
      writeLocalStorageIfEmpty(DEEP_DIVE_LS.email, props.email.trim());
      writeLocalStorageIfEmpty(DEEP_DIVE_LS.firstName, props.firstName.trim());
      props.onPaid();
    }
  };

  const payDisabled = !stripe || !elements || busy || !elementReady || !elementComplete;

  return (
    <div className="mt-8 space-y-4 rounded-xl border border-[rgb(26_110_204/0.25)] bg-[rgb(10_10_10)] p-5">
      <h3 className="font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white">
        Card payment
      </h3>
      <PaymentElement
        onReady={() => setElementReady(true)}
        onChange={onElementChange}
        options={{
          layout: "tabs",
        }}
      />
      {errorMessage ? (
        <p className="text-sm text-red-400" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <button
        type="button"
        className="w-full rounded-lg bg-[#1A6ECC] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-[#1562b8] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={payDisabled}
        onClick={() => void handleSubmit()}
      >
        {busy ? "Processing…" : `Pay ${props.amountLabel}`}
      </button>
    </div>
  );
}

export function DeepDiveFlow() {
  const router = useRouter();
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  const stripePromise = useMemo(() => {
    if (!publishableKey) return null;
    return loadStripe(publishableKey);
  }, [publishableKey]);

  const [step, setStep] = useState<Step>(0);
  const [track, setTrack] = useState<BusinessTrack | null>(null);
  const [form, setForm] = useState<CheckoutForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    orgName: "",
  });
  const [codeInput, setCodeInput] = useState("");
  const [pricing, setPricing] = useState<AppliedPricing>(() => basePricing());
  const [codeFeedback, setCodeFeedback] = useState<string | null>(null);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const goBack = () => {
    if (step === 0) return;
    if (step === 2) {
      setClientSecret(null);
      setAssessmentId(null);
      setPrepareError(null);
    }
    setStep((s) => (s > 0 ? ((s - 1) as Step) : s));
  };

  const selectTrack = (next: BusinessTrack) => {
    setTrack(next);
    setStep(1);
  };

  const goCheckout = () => {
    if (!track) return;
    setStep(2);
  };

  const applyCode = () => {
    const raw = codeInput;
    if (!raw.trim()) {
      setPricing(basePricing());
      setCodeFeedback(null);
      return;
    }
    const result = resolveDiscountOrAffiliateCode(raw);
    if (!result.ok) {
      setCodeFeedback(result.message);
      return;
    }
    setPricing(result.pricing);
    setCodeFeedback(result.pricing.kind === "base" ? null : result.pricing.summary);
  };

  const updateField = (key: keyof CheckoutForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const validateForm = (): string | null => {
    if (!form.firstName.trim()) return "First name is required.";
    if (!form.lastName.trim()) return "Last name is required.";
    if (!form.email.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Enter a valid email.";
    if (!form.phone.trim()) return "Phone is required.";
    if (!form.orgName.trim()) return "Business name is required.";
    return null;
  };

  const preparePayment = async () => {
    if (!track) return;
    const v = validateForm();
    if (v) {
      setPrepareError(v);
      return;
    }
    if (!publishableKey || !stripePromise) {
      setPrepareError("Stripe is not configured (missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).");
      return;
    }
    setPreparing(true);
    setPrepareError(null);
    try {
      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPaymentPayload(form, track, pricing)),
      });
      const json: unknown = await res.json().catch(() => null);
      const parsed = parseCreatePaymentIntentJson(json);
      if ("error" in parsed) {
        setPrepareError(parsed.error);
        setClientSecret(null);
        setAssessmentId(null);
        return;
      }
      setClientSecret(parsed.clientSecret);
      setAssessmentId(parsed.assessmentId);
    } catch {
      setPrepareError("Network error. Check your connection and try again.");
      setClientSecret(null);
      setAssessmentId(null);
    } finally {
      setPreparing(false);
    }
  };

  const amountLabel = formatUsd(pricing.amountPaid);

  return (
    <div className="min-h-screen bg-[#000000] text-white">
      <header className="border-b border-[rgb(255_255_255/0.08)] px-6 py-5">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-medium text-[rgb(255_255_255/0.65)] no-underline hover:text-white">
            ← Enhanced Ops × Ninja
          </Link>
          {step > 0 ? (
            <button
              type="button"
              className="text-sm font-medium text-[#1A6ECC] hover:underline"
              onClick={goBack}
            >
              Back
            </button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <StepProgress step={step} />

        {step === 0 ? (
          <>
            <h1 className="mb-3 text-center font-[family-name:var(--font-bebas)] text-[44px] uppercase leading-none tracking-[0.04em] md:text-[52px]">
              Deep dive <span className="text-[#1A6ECC]">assessment</span>
            </h1>
            <p className="mx-auto mb-12 max-w-xl text-center text-[15px] leading-relaxed text-[rgb(255_255_255/0.6)]">
              Choose your track. You&apos;ll review what&apos;s included, then complete secure checkout.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <button type="button" className={cardShellClass} onClick={() => selectTrack("healthcare")}>
                <span className="mb-3 inline-block w-fit rounded-md border border-[rgb(26_110_204/0.3)] bg-[rgb(26_110_204/0.2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#1A6ECC]">
                  Healthcare
                </span>
                <span className="font-[family-name:var(--font-bebas)] text-3xl uppercase tracking-[0.03em]">
                  Clinics & care delivery
                </span>
                <span className="mt-3 text-[14px] leading-relaxed text-[rgb(255_255_255/0.55)]">
                  Operational assessment with language and examples tuned for patient-facing and
                  back-office healthcare.
                </span>
              </button>
              <button type="button" className={cardShellClass} onClick={() => selectTrack("business")}>
                <span className="mb-3 inline-block w-fit rounded-md border border-[rgb(26_110_204/0.3)] bg-[rgb(26_110_204/0.2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#1A6ECC]">
                  General business
                </span>
                <span className="font-[family-name:var(--font-bebas)] text-3xl uppercase tracking-[0.03em]">
                  Teams & operators
                </span>
                <span className="mt-3 text-[14px] leading-relaxed text-[rgb(255_255_255/0.55)]">
                  Full operational pass for services, distribution, and multi-department operators
                  outside clinical care models.
                </span>
              </button>
            </div>
          </>
        ) : null}

        {step === 1 && track ? (
          <div className="rounded-xl border border-[rgb(26_110_204/0.2)] bg-[rgb(8_8_8)] p-8 md:p-10">
            <h2 className="mb-2 font-[family-name:var(--font-bebas)] text-[40px] uppercase leading-none tracking-[0.04em] text-[#1A6ECC]">
              What you get
            </h2>
            <p className="mb-6 text-[14px] uppercase tracking-[0.12em] text-[rgb(255_255_255/0.4)]">
              {track === "healthcare" ? "Healthcare track" : "General business track"}
            </p>
            {track === "healthcare" ? <HealthcareSalesCopy /> : <GeneralBusinessSalesCopy />}
            <button
              type="button"
              className="w-full rounded-lg bg-[#1A6ECC] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-[#1562b8] md:w-auto"
              onClick={goCheckout}
            >
              Continue to checkout →
            </button>
          </div>
        ) : null}

        {step === 2 && track ? (
          <div>
            <h2 className="mb-2 text-center font-[family-name:var(--font-bebas)] text-[40px] uppercase leading-none tracking-[0.04em] text-[#1A6ECC]">
              Checkout
            </h2>
            <p className="mb-10 text-center text-[15px] text-[rgb(255_255_255/0.55)]">
              {track === "healthcare" ? "Healthcare" : "General business"} · Total due {amountLabel}
            </p>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="dd-first">
                  First name
                </label>
                <input
                  id="dd-first"
                  className={inputClass}
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="dd-last">
                  Last name
                </label>
                <input
                  id="dd-last"
                  className={inputClass}
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass} htmlFor="dd-email">
                  Email
                </label>
                <input
                  id="dd-email"
                  type="email"
                  className={inputClass}
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass} htmlFor="dd-phone">
                  Phone
                </label>
                <input
                  id="dd-phone"
                  type="tel"
                  className={inputClass}
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass} htmlFor="dd-org">
                  Business name
                </label>
                <input
                  id="dd-org"
                  className={inputClass}
                  autoComplete="organization"
                  value={form.orgName}
                  onChange={(e) => updateField("orgName", e.target.value)}
                />
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-[rgb(255_255_255/0.1)] bg-[rgb(10_10_10)] p-5">
              <label className={labelClass} htmlFor="dd-code">
                Discount or affiliate code
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="dd-code"
                  className={inputClass}
                  placeholder="Optional"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-[rgb(26_110_204/0.5)] px-5 py-2.5 text-[14px] font-semibold text-[#1A6ECC] transition hover:bg-[rgb(26_110_204/0.15)]"
                  onClick={applyCode}
                >
                  Apply
                </button>
              </div>
              {codeFeedback ? (
                <p className="mt-3 text-sm text-[rgb(255_255_255/0.75)]" role="status">
                  {codeFeedback}
                </p>
              ) : null}
              <div className="mt-4 flex flex-col gap-1 border-t border-[rgb(255_255_255/0.08)] pt-4 text-sm">
                <div className="flex justify-between text-[rgb(255_255_255/0.55)]">
                  <span>Base price</span>
                  <span>{formatUsd(DEEP_DIVE_BASE_USD)}</span>
                </div>
                {pricing.kind !== "base" ? (
                  <div className="flex justify-between text-[#1A6ECC]">
                    <span>Adjustment</span>
                    <span>{pricing.summary}</span>
                  </div>
                ) : null}
                <div className="flex justify-between pt-2 text-base font-semibold text-white">
                  <span>Due today</span>
                  <span>{amountLabel}</span>
                </div>
              </div>
            </div>

            {prepareError ? (
              <p className="mt-4 text-center text-sm text-red-400" role="alert">
                {prepareError}
              </p>
            ) : null}

            {!clientSecret || !assessmentId ? (
              <button
                type="button"
                className="mt-8 w-full rounded-lg bg-[#1A6ECC] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-[#1562b8] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={preparing || !publishableKey}
                onClick={() => void preparePayment()}
              >
                {preparing ? "Preparing secure payment…" : "Continue to secure payment"}
              </button>
            ) : null}

            {!publishableKey ? (
              <p className="mt-4 text-center text-sm text-amber-400">
                Missing Stripe publishable key. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your environment.
              </p>
            ) : null}

            {clientSecret && assessmentId && stripePromise ? (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "night",
                    variables: {
                      colorPrimary: "#1A6ECC",
                      borderRadius: "8px",
                    },
                  },
                }}
              >
                <InnerPaySection
                  assessmentId={assessmentId}
                  amountLabel={amountLabel}
                  track={track}
                  email={form.email}
                  firstName={form.firstName}
                  onPaid={() => router.push("/deep-dive/assessment")}
                />
              </Elements>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
