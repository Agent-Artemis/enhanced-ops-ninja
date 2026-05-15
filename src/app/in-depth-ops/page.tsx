"use client";

import { useState } from "react";
import Link from "next/link";

type Track = "healthcare" | "general_business";

export default function InDepthOpsLandingPage() {
  const [track, setTrack] = useState<Track>("general_business");
  const [clientName, setClientName] = useState("");
  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [annualRevenue, setAnnualRevenue] = useState("2100000");
  const [teamSize, setTeamSize] = useState("18");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startCheckout = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/in-depth-ops/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          email,
          organizationName,
          annualRevenue: Number(annualRevenue),
          teamSize: Number(teamSize),
          track,
        }),
      });
      const body = (await res.json().catch(() => null)) as { checkoutUrl?: string; error?: string } | null;
      if (!res.ok || !body?.checkoutUrl) {
        setError(body?.error ?? "Unable to start checkout");
        return;
      }
      window.location.href = body.checkoutUrl;
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-14 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.25em] text-emerald-300/90">In-depth operations assessment</p>
        <h1 className="mt-3 font-semibold text-4xl text-white">52-question diagnostic + automated PDF report</h1>
        <p className="mt-4 text-slate-300">
          This is the paid Enhanced Ops in-depth assessment. After checkout you will answer 52 questions across eight modules. A
          branded PDF report is generated on completion.
        </p>

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-300">
              Full name
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300">
              Work email
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300 sm:col-span-2">
              Organization
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300">
              Annual revenue (USD)
              <input
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={annualRevenue}
                onChange={(e) => setAnnualRevenue(e.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300">
              Team size (FTEs)
              <input
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
              />
            </label>
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-200">Track</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setTrack("general_business")}
                className={`rounded-full px-4 py-2 text-sm ${
                  track === "general_business" ? "bg-emerald-500 text-slate-950" : "border border-slate-700 text-slate-200"
                }`}
              >
                General Business
              </button>
              <button
                type="button"
                onClick={() => setTrack("healthcare")}
                className={`rounded-full px-4 py-2 text-sm ${
                  track === "healthcare" ? "bg-emerald-500 text-slate-950" : "border border-slate-700 text-slate-200"
                }`}
              >
                Healthcare
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={loading || !clientName || !email || !organizationName}
            onClick={startCheckout}
            className="mt-8 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? "Redirecting to Stripe…" : "Continue to secure checkout"}
          </button>
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          <p className="mt-4 text-xs text-slate-500">
            Uses <code className="text-slate-300">STRIPE_PRICE_ID_INDEPTH</code> via Checkout Session API. Free preview assessment
            remains on <Link className="text-emerald-300 underline" href="/assessment">/assessment</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
