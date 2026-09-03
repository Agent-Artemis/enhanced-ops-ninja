import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  SECTORS, isSector, getDeckData, stateName, prettyTag, fmtDate, denomWords,
  type DeckData,
} from "@/lib/deck/data";

export const dynamic = "force-dynamic";

type Params = { sector: string; state: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { sector, state } = await params;
  if (!isSector(sector)) return { title: "Survey Snapshot" };
  const st = stateName(state.toUpperCase());
  return {
    title: `${st} ${SECTORS[sector].short} Survey Snapshot`,
    description: `The most-cited ${SECTORS[sector].tagWord}s for ${st} ${SECTORS[sector].noun}, benchmarked against the national rate.`,
    robots: { index: false, follow: false },
  };
}

const CSS = `
:root{--bg:#0A0F1A;--panel:#0E1420;--panel2:#131b2b;--ink:#EEF3FA;--soft:#AEBBCD;--muted:#7E8DA0;
 --line:#243044;--line2:#31415c;--blue:#1A6ECC;--blue2:#3F8AE0;--gold:#F5B301;--green:#22C55E;
 --bebas:'Bebas Neue',Impact,sans-serif;--dm:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--dm);line-height:1.5}
.pg{max-width:800px;margin:0 auto;padding:24px 18px 70px}
.logo{width:min(230px,54vw);display:block;margin-bottom:18px}
.eyebrow{font-family:var(--bebas);font-size:13px;letter-spacing:.18em;color:var(--blue2);margin:0 0 5px}
h1{font-family:var(--bebas);font-size:clamp(30px,6.4vw,46px);line-height:1;margin:0 0 10px}
h1 .hl{color:var(--blue)}
.lede{color:var(--soft);font-size:15.5px;max-width:62ch;margin:0 0 4px}
.stamp{color:var(--muted);font-size:12px;border-top:1px solid var(--line);padding-top:11px;margin-top:13px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:9px;margin:20px 0 0}
.stat{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:10px;padding:12px}
.stat .n{font-family:var(--bebas);font-size:31px;line-height:1;color:var(--blue2)}
.stat .n.warn{color:var(--gold)}
.stat .l{color:var(--soft);font-size:11.5px;margin-top:4px;line-height:1.3}
h2{font-family:var(--bebas);font-size:26px;letter-spacing:.03em;margin:32px 0 7px}
.sec{color:var(--soft);font-size:14.5px;max-width:64ch;margin:0 0 13px}
.find{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);
 border-left:3px solid var(--gold);border-radius:11px;padding:15px 17px;margin:13px 0}
.find.good{border-left-color:var(--green)}
.find h3{margin:0 0 7px;font-size:15.5px}
.find p{margin:0;color:var(--soft);font-size:14.5px}
.find b{color:var(--ink)}
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:11px;margin:14px 0}
table{border-collapse:collapse;width:100%;min-width:560px;font-size:13.5px}
th{background:#0b1220;color:var(--blue2);text-align:left;font-size:10px;letter-spacing:.09em;text-transform:uppercase;
 padding:10px;border-bottom:1px solid var(--line);font-weight:800;white-space:nowrap}
td{padding:10px;border-bottom:1px solid var(--line)}
tr:last-child td{border-bottom:0}
td.tag{font-weight:800;white-space:nowrap}
td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tr.hot td{background:rgba(245,179,1,.06)}
.pill{display:inline-block;font-size:10.5px;font-weight:800;padding:1px 6px;border-radius:5px}
.pill.up{color:var(--gold);background:rgba(245,179,1,.13);border:1px solid rgba(245,179,1,.35)}
.pill.dn{color:var(--green);background:rgba(34,197,94,.11);border:1px solid rgba(34,197,94,.32)}
.pill.flat{color:var(--muted);background:rgba(126,141,160,.12);border:1px solid rgba(126,141,160,.3)}
.ask{background:#0b1220;border:1px solid var(--line2);border-left:3px solid var(--blue);border-radius:9px;
 padding:11px 14px;margin:8px 0;font-size:14px;color:var(--soft)}
.ask b{color:var(--ink)}
.cta{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line2);
 border-radius:13px;padding:22px;margin-top:30px;text-align:center}
.cta h2{margin:0 0 7px}
.cta p{color:var(--soft);font-size:14.5px;max-width:52ch;margin:0 auto 15px}
.btn{display:inline-flex;align-items:center;justify-content:center;background:var(--blue);color:#fff;
 text-decoration:none;font-weight:700;font-size:15px;padding:13px 24px;border-radius:9px;min-height:48px}
.foot{margin-top:24px;color:var(--muted);font-size:11px;border-top:1px solid var(--line);padding-top:13px;line-height:1.55}
@media print{body{background:#fff;color:#000}.cta{break-inside:avoid}}
`;

export default async function OnePager({ params }: { params: Promise<Params> }) {
  const { sector: rawSector, state: rawState } = await params;
  if (!isSector(rawSector)) notFound();
  const state = rawState.toUpperCase();

  let d: DeckData | null = null;
  try { d = await getDeckData(rawSector, state); } catch { notFound(); }
  if (!d) notFound();

  const S = SECTORS[d.sector];

  const DW = denomWords(S.denomKind, S.noun);
  const st = stateName(state);
  const h = d.headline;
  const lead = d.worse[0];
  const win = d.better[0];
  const window = h.fromDate && h.toDate ? `${fmtDate(h.fromDate)} – ${fmtDate(h.toDate)}` : "all available records";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/ninja-logo.png" alt="EnhancedOps.ninja" />
        <p className="eyebrow">{st.toUpperCase()} · {S.label.toUpperCase()} · SURVEY SNAPSHOT</p>
        <h1>The {d.tags.length} {S.tagWord}s {st}<br />{S.noun} are <span className="hl">actually</span> cited on</h1>
        <p className="lede">
          Every citation issued to a {st} {S.nounOne} over the last three years,
          ranked by how many were cited{h.hasNational ? " — and compared against the national rate." : "."}
        </p>

        <div className="stats">
          <div className="stat"><div className="n">{h.facilities}</div><div className="l">{S.noun} with a citation</div></div>
          <div className="stat"><div className="n">{h.citations.toLocaleString()}</div><div className="l">Citations</div></div>
          <div className="stat"><div className="n">{h.avgPer}</div><div className="l">Avg per cited facility</div></div>
          <div className="stat"><div className="n warn">{h.ij > 0 ? h.ij : `${d.complaintShare}%`}</div>
            <div className="l">{h.ij > 0 ? "Most-severe findings" : "Complaint-driven"}</div></div>
        </div>
        <p className="stamp">
          Source: {S.regime} · {window} · {h.facilities} {S.noun} with at least one citation in {st}
          {h.hasNational ? ` · national comparison as of ${h.nationalAsOf ? new Date(h.nationalAsOf).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—"}` : ""} · compiled by EnhancedOps.Ninja
        </p>

        {(lead || win) && <>
          <h2>What stands out</h2>
          {lead && (
            <div className="find">
              <h3>{st} runs {lead.gap} points above the national rate on {prettyTag(lead.tag)}</h3>
              <p>
                <b>{prettyTag(lead.tag)} — {lead.descr}</b> is cited at <b>{lead.statePct}%</b> of {st}{" "}
                {S.noun} against <b>{lead.natlPct}%</b> nationally
                {lead.ij > 0 && <> , and carried <b>{lead.ij}</b> of the state&apos;s most-severe findings</>}.
                {d.worse[1] && <> {prettyTag(d.worse[1].tag)} shows the same pattern at {d.worse[1].statePct}% against {d.worse[1].natlPct}%.</>}
              </p>
            </div>
          )}
          {win && (
            <div className="find good">
              <h3>And where {st} is ahead</h3>
              <p>
                <b>{prettyTag(win.tag)} — {win.descr}</b> is cited at <b>{win.statePct}%</b> here against{" "}
                <b>{win.natlPct}%</b> nationally — <b>{Math.abs(win.gap ?? 0)} points better</b> than the country.
              </p>
            </div>
          )}
        </>}

        {d.complaintShare >= 20 && (
          <div className="find" style={{ borderLeftColor: "var(--blue)" }}>
            <h3>{d.complaintShare}% did not come from the annual survey</h3>
            <p><b>{h.complaint.toLocaleString()} of {h.citations.toLocaleString()}</b> citations arose from complaint
              surveys rather than routine recertification. You cannot schedule readiness for a survey you did not know was coming.</p>
          </div>
        )}

        <h2>The most-cited {S.tagWord}s</h2>
        <p className="sec">{DW.body}</p>
        <div className="tw"><table>
          <thead><tr>
            <th>{S.tagWord === "rule" ? "§" : "Tag"}</th><th>Requirement</th>
            <th className="num">Fac.</th><th className="num">{DW.columnHeader}</th>
            {h.hasNational && <><th className="num">U.S.</th><th className="num">Gap</th></>}
          </tr></thead>
          <tbody>
            {d.tags.map((r) => {
              const hot = r.gap !== null && r.gap >= 8;
              const good = r.gap !== null && r.gap <= -8;
              return (
                <tr key={r.tag + r.descr} className={hot ? "hot" : ""}>
                  <td className="tag">{prettyTag(r.tag)}</td>
                  <td>{r.descr.length > 62 ? r.descr.slice(0, 60) + "…" : r.descr}</td>
                  <td className="num">{r.facilities}</td>
                  <td className="num">{r.statePct}%</td>
                  {h.hasNational && <>
                    <td className="num">{r.natlPct === null ? "—" : `${r.natlPct}%`}</td>
                    <td className="num">{r.gap === null ? "—" :
                      <span className={"pill " + (hot ? "up" : good ? "dn" : "flat")}>{r.gap > 0 ? "+" : ""}{r.gap}</span>}</td>
                  </>}
                </tr>
              );
            })}
          </tbody>
        </table></div>
        {/* Only renders when there IS no benchmark. It previously rendered
            unconditionally, so a page showing a full U.S. column also carried a
            paragraph saying the comparison had been withdrawn — the numbers and
            the words contradicting each other on the same sheet. */}
        {!h.hasNational && (
          <p className="sec" style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {S.denomKind === "cited"
              ? `No national comparison is shown for ${S.noun}: we hold no survey roster for this sector, so there is no population to measure a national rate against. These figures are ${st} measured against itself.`
              : `No national comparison is shown for ${S.noun}: each state runs its own rulebook, so a national rate would compare unlike things. These figures are ${st} measured against itself.`}
          </p>
        )}

        <h2>What this cannot tell you</h2>
        <p className="sec">This is state-level and historical. It describes the population, not your buildings. The questions it raises:</p>
        {d.tags.slice(0, 3).map((r, i) => (
          <div className="ask" key={r.tag + i}>
            <b>{prettyTag(r.tag)} — {r.descr.length > 56 ? r.descr.slice(0, 54) + "…" : r.descr}.</b>{" "}
            Cited at {r.facilities} of the {h.facilities} {S.noun} that have a citation on record. Can you show current documented evidence — in every building?
          </div>
        ))}
        <div className="ask"><b>Across all {S.tagWord}s.</b> Which of your buildings is drifting right now — and would you know before the surveyor, or after?</div>

        <div className="cta">
          <h2>Is your building exposed?</h2>
          <p>This describes {st}. It cannot tell you where <em>you</em> stand — that takes a look at your own operation, across every building you run.</p>
          <a className="btn" href="/book">Book a 30-minute call →</a>
        </div>

        <div className="foot">
          Prepared by <b>EnhancedOps.Ninja</b> — a dba of Augeo LLC. Compiled from public {S.regime}. Ranked by distinct
          facilities cited; {DW.footnote}{"."} No facility is named. Provided for operational and educational purposes; not legal or regulatory advice
          and not a substitute for official survey records.
        </div>
      </div>
    </>
  );
}
