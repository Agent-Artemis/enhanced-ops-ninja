import Link from "next/link";
import { headers } from "next/headers";

import { createSupabaseAdmin } from "@/lib/ops-report/supabase-admin";

export const dynamic = "force-dynamic";

type SessionListRow = {
  id: string;
  created_at: string;
  client_name: string;
  client_email: string;
  organization_name: string | null;
  status: string;
  stripe_status: string;
  report_url: string | null;
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ secret?: string }>;
}) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return <main className="p-8 text-slate-100">ADMIN_SECRET is not configured.</main>;
  }

  const hdrs = await headers();
  const headerSecret = hdrs.get("x-admin-secret");
  const query = await searchParams;
  const querySecret = query.secret ?? "";
  if (headerSecret !== adminSecret && querySecret !== adminSecret) {
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-slate-100">
        <h1 className="text-xl font-semibold text-white">Unauthorized</h1>
        <p className="mt-2 text-sm text-slate-400">Provide header x-admin-secret or query ?secret= matching ADMIN_SECRET.</p>
      </main>
    );
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("ops_assessment_sessions")
    .select("id,created_at,client_name,client_email,organization_name,status,stripe_status,report_url")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <main className="p-8 text-rose-200">
        Failed to load sessions: {error.message}
      </main>
    );
  }

  const rows = (data ?? []) as SessionListRow[];

  const { data: reports } = await supabase
    .from("ops_assessment_reports")
    .select("session_id,pdf_url")
    .order("generated_at", { ascending: false })
    .limit(200);

  const pdfBySession = new Map<string, string | null>();
  for (const r of reports ?? []) {
    const row = r as { session_id: string; pdf_url: string | null };
    if (!pdfBySession.has(row.session_id)) {
      pdfBySession.set(row.session_id, row.pdf_url);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-semibold text-white">In-depth ops sessions</h1>
        <p className="mt-2 text-sm text-slate-400">Showing latest 50 rows from ops_assessment_sessions.</p>

        <div className="mt-8 overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Org</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Stripe</th>
                <th className="px-3 py-2">PDF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const pdf = s.report_url ?? pdfBySession.get(s.id) ?? null;
                return (
                  <tr key={s.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-300">{new Date(s.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-white">{s.client_name}</div>
                      <div className="text-xs text-slate-400">{s.client_email}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{s.organization_name ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-200">{s.status}</td>
                    <td className="px-3 py-2 text-slate-200">{s.stripe_status}</td>
                    <td className="px-3 py-2">
                      {pdf ? (
                        <a className="text-emerald-300 underline" href={pdf} target="_blank" rel="noreferrer">
                          Open PDF
                        </a>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                      <div className="text-xs text-slate-500">
                        <Link className="underline" href={`/in-depth-ops/${s.id}`}>
                          session
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
