import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  SECTORS, isSector, getDeckData, stateName, prettyTag, fmtDate,
  type DeckData, type TagRow,
} from "@/lib/deck/data";
import { DECK_CSS, DECK_SCRIPT } from "./deck-chrome";

export const dynamic = "force-dynamic";

type Params = { sector: string; state: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { sector, state } = await params;
  if (!isSector(sector)) return { title: "Survey Intelligence" };
  const st = stateName(state.toUpperCase());
  return {
    title: `${st} ${SECTORS[sector].short} Survey Intelligence`,
    description: `The most-cited ${SECTORS[sector].tagWord}s among ${st} ${SECTORS[sector].noun} that have a citation on record.`,
    robots: { index: false, follow: false },
  };
}

/** A horizontal comparison bar. Width is a percentage, so no chart library. */
function Bar({ label, pct, ours }: { label: string; pct: number; ours?: boolean }) {
  return (
    <div className="brow">
      <span className="k">{label}</span>
      <span className="tr"><span className={"fl" + (ours ? " ut" : "")} data-w={pct} /></span>
      <span className={"v" + (ours ? " ut" : "")}>{pct}%</span>
    </div>
  );
}

function Slide({
  children, notes, title, className = "",
}: { children: React.ReactNode; notes: string; title?: boolean; className?: string }) {
  return (
    <section className={`slide ${title ? "title " : ""}${className}`} data-notes={notes}>
      {children}
    </section>
  );
}

export default async function DeckPage({ params }: { params: Promise<Params> }) {
  const { sector: rawSector, state: rawState } = await params;
  if (!isSector(rawSector)) notFound();
  const state = rawState.toUpperCase();

  let d: DeckData | null = null;
  try {
    d = await getDeckData(rawSector, state);
  } catch {
    notFound();
  }
  if (!d) notFound();

  const S = SECTORS[d.sector];
  const st = stateName(state);
  const { headline: h } = d;
  const lead: TagRow | undefined = d.worse[0];
  const second: TagRow | undefined = d.worse[1];
  const win: TagRow | undefined = d.better[0];
  const window = h.fromDate && h.toDate
    ? `${fmtDate(h.fromDate)} – ${fmtDate(h.toDate)}`
    : "all available records";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DECK_CSS }} />
      <div className="stage" id="stage">

        <Slide title notes={`Open by NOT selling. One line on who you are, then straight into the data — the credibility is the work, not the introduction.|SAY: Every citation issued to a ${st} ${S.noun.replace(/s$/, "")} in the last three years — ${h.citations.toLocaleString()} of them, across the ${h.facilities} ${S.noun} that have at least one citation on record. We pulled the federal data and cleaned it. NOTE: this is not a rate across all ${st} ${S.noun} — facilities with no citation are not in the denominator.${h.hasNational ? " The U.S. column IS a true rate: it denominates on facilities surveyed, clean surveys included." : " No national comparison is shown for this sector."}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/ninja-logo.png" alt="EnhancedOps.ninja" />
          <p className="eyebrow">{st.toUpperCase()} · {S.label.toUpperCase()}</p>
          <h1>Survey Intelligence<br /><span className="hl">{new Date().getFullYear()}</span></h1>
          <p className="lede">
            Every citation issued to a {st} {S.noun.replace(/s$/, "")} over three years —
            {d.worse.length ? " and where this state is a genuine outlier." : " and what it means for your buildings."}
          </p>
        </Slide>

        <Slide notes={`Establish the base rate BEFORE the comparison, or the numbers later mean nothing. Do not rush.|SAY: ${h.facilities} ${S.noun} with a citation on record. ${h.avgPer} citations each on average, across those cited. Hold that number — that is the normal ${st} outcome, not a bad one.`}>
          <p className="eyebrow">THE LANDSCAPE</p>
          <h2>Three years of {st} surveys</h2>
          <div className="grid">
            <div className="card"><div className="n">{h.facilities}</div><div className="l">{S.noun} with a citation</div></div>
            <div className="card"><div className="n">{h.citations.toLocaleString()}</div><div className="l">Citations issued</div></div>
            <div className="card"><div className="n">{h.avgPer}</div><div className="l">Average per cited facility</div></div>
            {h.ij > 0
              ? <div className="card"><div className="n warn">{h.ij}</div><div className="l">Most-severe findings</div></div>
              : <div className="card"><div className="n warn">{d.complaintShare}%</div><div className="l">Complaint-driven</div></div>}
          </div>
          <p className="cap" style={{ marginTop: "2.6vh" }}>{S.regime} · {window}</p>
        </Slide>

        {d.complaintShare >= 20 && (
          <Slide notes={`First reframe. Most operators prepare for the annual survey; a large share of exposure does not arrive that way. Pause after the number.|SAY: ${h.complaint.toLocaleString()} of those ${h.citations.toLocaleString()} came from complaint surveys — not routine recertification. ${d.complaintShare} percent. Almost that much of your exposure shows up on a day nobody was preparing for.`}>
            <p className="eyebrow">THE FIRST SURPRISE</p>
            <h2>Not everything came<br />from the annual survey</h2>
            <div style={{ display: "flex", alignItems: "baseline", gap: "2vw", flexWrap: "wrap", marginTop: "1vh" }}>
              <div className="big gold">{d.complaintShare}%</div>
              <p className="cap">
                of {st} citations — <b style={{ color: "var(--ink)" }}>{h.complaint.toLocaleString()} of {h.citations.toLocaleString()}</b> —
                arose from <b style={{ color: "var(--ink)" }}>complaint surveys</b>, not routine recertification.
              </p>
            </div>
            <p className="cap" style={{ marginTop: "2.4vh", maxWidth: "52ch" }}>
              You cannot schedule readiness for a survey you did not know was coming.
            </p>
          </Slide>
        )}

        {lead && (
          <Slide notes={`THE core slide. Let the bars animate, then stop talking for a beat. This is the finding that earns you the room.|SAY: Here is where ${st} separates from the country. ${prettyTag(lead.tag)} — ${lead.descr.slice(0, 90)} — is cited at ${lead.natlPct}% of facilities nationally. In ${st}, ${lead.statePct}.`}>
            <p className="eyebrow">THE FINDING</p>
            <h2>{st} runs <span className="hl">{lead.gap && lead.statePct && lead.natlPct && lead.natlPct > 0 && lead.statePct / lead.natlPct >= 1.6 ? "far above" : "above"}</span><br />the national rate — here</h2>
            <div className="bars">
              <Bar label={`${prettyTag(lead.tag)} ${state}`} pct={lead.statePct ?? 0} ours />
              <Bar label={`${prettyTag(lead.tag)} U.S.`} pct={lead.natlPct ?? 0} />
              {second && <>
                <div style={{ height: "2.4vh" }} />
                <Bar label={`${prettyTag(second.tag)} ${state}`} pct={second.statePct ?? 0} ours />
                <Bar label={`${prettyTag(second.tag)} U.S.`} pct={second.natlPct ?? 0} />
              </>}
            </div>
            <p className="cap" style={{ marginTop: "2.2vh", maxWidth: "58ch" }}>
              <b style={{ color: "var(--ink)" }}>{prettyTag(lead.tag)}</b> — {lead.descr}
              {second && <><br /><b style={{ color: "var(--ink)" }}>{prettyTag(second.tag)}</b> — {second.descr}</>}
            </p>
          </Slide>
        )}

        {win && (
          <Slide notes={`Give the good news. This is what stops it being a fear pitch and it is why they will believe the rest of your numbers. Telling a room where they are FINE is what buys credibility.|SAY: I am not here to tell you ${st} is bad. On ${prettyTag(win.tag)} you run ${Math.abs(win.gap ?? 0)} points BETTER than national.`}>
            <p className="eyebrow">AND WHERE {st.toUpperCase()} LEADS</p>
            <h2>{st} beats the<br />national rate here</h2>
            <div className="bars">
              <Bar label={`${prettyTag(win.tag)} ${state}`} pct={win.statePct ?? 0} ours />
              <Bar label={`${prettyTag(win.tag)} U.S.`} pct={win.natlPct ?? 0} />
              {d.better[1] && <>
                <div style={{ height: "2.2vh" }} />
                <Bar label={`${prettyTag(d.better[1].tag)} ${state}`} pct={d.better[1].statePct ?? 0} ours />
                <Bar label={`${prettyTag(d.better[1].tag)} U.S.`} pct={d.better[1].natlPct ?? 0} />
              </>}
            </div>
            <p className="cap" style={{ marginTop: "2.2vh", maxWidth: "58ch" }}>
              <b style={{ color: "var(--ink)" }}>{prettyTag(win.tag)}</b> — {win.descr}
            </p>
          </Slide>
        )}

        <Slide notes={`Do not read the table aloud. Point at the highlighted rows and let them scan.|SAY: The full ten. The highlighted rows are where ${st} runs above national.`}>
          <p className="eyebrow">THE FULL PICTURE</p>
          <h2>Ten most-cited in {st}</h2>
          {h.hasNational && h.nationalAsOf && (
            <p className="eyebrow" style={{ opacity: 0.7 }}>
              National comparison as of{" "}
              {new Date(h.nationalAsOf).toLocaleDateString("en-US",
                { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
          <table>
            <thead><tr>
              <th>{S.tagWord === "rule" ? "§" : "Tag"}</th><th>Requirement</th>
              <th className="num">Fac.</th><th className="num">{state}</th>
              {h.hasNational && <><th className="num">U.S.</th><th className="num">Gap</th></>}
              {h.ij > 0 && <th className="num">Severe</th>}
            </tr></thead>
            <tbody>
              {d.tags.map((r) => {
                const hot = r.gap !== null && r.gap >= 8;
                const good = r.gap !== null && r.gap <= -8;
                return (
                  <tr key={r.tag + r.descr} className={hot ? "hot" : ""}>
                    <td className="tag">{prettyTag(r.tag)}</td>
                    <td>{r.descr.length > 70 ? r.descr.slice(0, 68) + "…" : r.descr}</td>
                    <td className="num">{r.facilities}</td>
                    <td className="num">{r.statePct}%</td>
                    {h.hasNational && <>
                      <td className="num">{r.natlPct === null ? "—" : `${r.natlPct}%`}</td>
                      <td className="num">
                        {r.gap === null ? "—" :
                          <span className={"pill " + (hot ? "up" : good ? "dn" : "flat")}>
                            {r.gap > 0 ? "+" : ""}{r.gap}
                          </span>}
                      </td>
                    </>}
                    {h.ij > 0 && <td className="num">{r.ij || ""}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="cap" style={{ marginTop: "1.4vh", fontSize: "clamp(11px,1.15vw,15px)" }}>
            Share of {st} {S.noun} <b>with a citation on record</b> — not a rate across all {S.noun}.
            No national comparison is shown: the benchmark previously displayed came from a precomputed
            table whose denominator could not be reconciled, so it has been withdrawn.
          </p>
        </Slide>

        <Slide notes={`Hand them something to use tomorrow. These are questions, NOT your product. Deliver slowly — people write these down, and that is the moment you become useful rather than promotional.|SAY: Take these back to your next leadership meeting. I am not asking you to buy anything to answer them.`}>
          <p className="eyebrow">TAKE THESE TO YOUR NEXT LEADERSHIP MEETING</p>
          <h2>Questions worth asking</h2>
          <div className="qs">
            {d.tags.slice(0, 3).map((r, i) => (
              <div className="q" key={r.tag + i}>
                <b>{i + 1}. {prettyTag(r.tag)} — {r.descr.length > 58 ? r.descr.slice(0, 56) + "…" : r.descr}.</b>{" "}
                Cited at <b>{r.facilities}</b> of the {h.facilities} {S.noun} in your state that have a citation on record.
                Can you show current, documented evidence on this — in every building?
              </div>
            ))}
            <div className="q">
              <b>4.</b> Which of your buildings is drifting <b>right now</b> — and would you know
              before the surveyor, or after?
            </div>
          </div>
        </Slide>

        <Slide notes={`The honest close. Naming the limits of your own data is disarming, it is true, and it sets up the only ask you make.|SAY: Everything I showed you is state-level and historical. It describes ${st}. It cannot tell you where YOUR buildings stand. If that is useful, we do that at no charge.`}>
          <p className="eyebrow">WHAT THIS DATA CANNOT DO</p>
          <h2>It describes {st}.<br />It doesn&apos;t describe <span className="hl">you.</span></h2>
          <ul className="pts">
            <li>State-level and historical — <b>the population, not your buildings</b></li>
            <li>It cannot say whether <b>your</b> documentation holds up</li>
            <li>It cannot rank <b>your</b> buildings against each other</li>
            <li>It cannot tell you which one is drifting <b>this month</b></li>
          </ul>
          <p className="cap" style={{ marginTop: "2.8vh", maxWidth: "52ch" }}>
            That takes a look at your own operation — a{" "}
            <b style={{ color: "var(--ink)" }}>free Visibility Audit</b>, across every building you run.
          </p>
        </Slide>

        <Slide title notes="Stop selling. Take questions. Leave the link up while people file out — that is your follow-up, not a business card.|SAY: Thank you. Questions?">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/ninja-logo.png" alt="EnhancedOps.ninja" />
          <h1>Questions?</h1>
          <p className="lede">
            One-page summary and full methodology:<br />
            <b style={{ color: "var(--blue2)" }}>enhancedops.ninja/onepager/{d.sector}/{state.toLowerCase()}</b>
          </p>
          <p className="cap" style={{ marginTop: "3vh" }}>
            EnhancedOps.Ninja · a dba of Augeo LLC · compiled from public {S.regime.includes("CLIA") ? "CLIA" : "CMS"} survey data
          </p>
        </Slide>

      </div>

      <div className="bar"><i id="prog" /></div>
      <div className="brand">EnhancedOps.Ninja</div>
      <div className="hud">
        <button id="btnNotes" title="Speaker notes (N)">Notes</button>
        <button id="btnFull" title="Fullscreen (F)">Full</button>
        <button id="prev" aria-label="Previous">‹</button>
        <span id="cnt" />
        <button id="next" aria-label="Next">›</button>
      </div>
      <div className="notes" id="notes"><h4>SPEAKER NOTES</h4><div id="notesBody" /></div>
      <script dangerouslySetInnerHTML={{ __html: DECK_SCRIPT }} />
    </>
  );
}
