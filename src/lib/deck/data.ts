import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Data layer for the presentation generator.
 *
 * Five datasets, two regimes:
 *   snf / lab / home_health / hospice — federal tag regimes. Every state is
 *     surveyed against the same tags, so a national benchmark is meaningful and
 *     the "vs U.S." column is the most interesting thing on the slide.
 *   assisted_living — licensed state by state under each state's own rules.
 *     Utah's rule set is not Oregon's, so a national rate would be comparing
 *     unlike things. `hasNational` is false for AL and the deck drops the
 *     comparison entirely rather than printing a number that means nothing.
 */

export const SECTORS = {
  snf: {
    label: "Skilled Nursing",
    short: "SNF",
    noun: "skilled nursing facilities",
    tagWord: "F-tag",
    regime: "CMS federal survey data",
  },
  assisted_living: {
    label: "Assisted Living",
    short: "AL",
    noun: "assisted living communities",
    tagWord: "rule",
    regime: "state licensing survey data",
  },
  home_health: {
    label: "Home Health",
    short: "HH",
    noun: "home health agencies",
    tagWord: "G-tag",
    regime: "CMS federal survey data",
  },
  hospice: {
    label: "Hospice",
    short: "Hospice",
    noun: "hospice agencies",
    tagWord: "L-tag",
    regime: "CMS federal survey data",
  },
  lab: {
    label: "Clinical Laboratory",
    short: "Lab",
    noun: "clinical laboratories",
    tagWord: "D-tag",
    regime: "CLIA federal survey data",
  },
} as const;

export type Sector = keyof typeof SECTORS;
export const SECTOR_KEYS = Object.keys(SECTORS) as Sector[];
export function isSector(v: string): v is Sector {
  return (SECTOR_KEYS as string[]).includes(v);
}

export const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",
  CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",
  HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",
  LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",
  MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",
  NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",
  OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",PR:"Puerto Rico",RI:"Rhode Island",
  SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",
  VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
  GU:"Guam",VI:"Virgin Islands",AS:"American Samoa",MP:"Northern Mariana Islands",
};
export const stateName = (c: string) => STATE_NAMES[c] ?? c;

export interface Headline {
  facilities: number; citations: number; avgPer: number;
  ij: number; complaint: number;
  fromDate: string | null; toDate: string | null;
  hasNational: boolean;
  /** When the national rates were last rebuilt, so a client-facing page can
   *  always answer "as of when?" about the national column. Null when the
   *  sector has no national comparison. */
  nationalAsOf: string | null;
}
export interface TagRow {
  tag: string; descr: string;
  facilities: number; citations: number;
  ij: number; complaint: number;
  statePct: number | null; natlPct: number | null;
  /** statePct − natlPct; null when the sector has no valid national benchmark. */
  gap: number | null;
}
export interface DeckData {
  sector: Sector; state: string;
  headline: Headline; tags: TagRow[];
  /** Tags where the state is materially WORSE than national — the story. */
  worse: TagRow[];
  /** Tags where the state is materially BETTER — credibility, not filler. */
  better: TagRow[];
  complaintShare: number;
}

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export async function listStates(sector: Sector): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin().rpc("deck_states", { p_sector: sector });
  if (error) throw new Error(`deck_states(${sector}): ${error.message}`);
  return (data ?? []).map((r: { state: string }) => r.state).filter(Boolean);
}

export async function getDeckData(sector: Sector, state: string): Promise<DeckData | null> {
  const sb = getSupabaseAdmin();
  const [h, t, ns] = await Promise.all([
    sb.rpc("deck_headline", { p_sector: sector, p_state: state }),
    sb.rpc("deck_top_tags", { p_sector: sector, p_state: state, p_limit: 10 }),
    sb.rpc("edu_natl_rates_status"),
  ]);
  if (h.error) throw new Error(`deck_headline: ${h.error.message}`);
  if (t.error) throw new Error(`deck_top_tags: ${t.error.message}`);

  // edu_natl_tag_rates is a TABLE, not a view. If the SNF loader has run since
  // it was last rebuilt, the national column is stale — right-looking and
  // quietly wrong. Treat stale as NO national rather than show a number we
  // cannot stand behind. The loader refreshes it, so this should never fire;
  // it exists because "should never fire" is how the last two silent-wrong
  // bugs got shipped.
  const stat = (ns.data ?? [])[0] as
    { as_of?: string; is_stale?: boolean } | undefined;
  const natlFresh = Boolean(stat) && stat!.is_stale === false;
  const nationalAsOf = natlFresh ? (stat!.as_of ?? null) : null;
  if (ns.error) console.error("edu_natl_rates_status:", ns.error.message);

  const hr = (h.data ?? [])[0];
  // No surveyed facilities means no honest deck — the caller renders a 404
  // rather than a page of zeroes that looks like a data failure.
  if (!hr || n(hr.facilities) === 0) return null;

  const headline: Headline = {
    facilities: n(hr.facilities), citations: n(hr.citations), avgPer: n(hr.avg_per),
    ij: n(hr.ij), complaint: n(hr.complaint),
    fromDate: hr.from_date ?? null, toDate: hr.to_date ?? null,
    // National comparison RESTORED 2026-08-18, for SNF only.
    // deck_top_tags now sources natl_pct from edu_natl_tag_rates, whose
    // denominator is snf_surveys for the inspection cycle (clean surveys
    // included) — the same denominator the state figure uses, so the two are
    // comparable. Verified at parity with the education generator across
    // UT/CA/TX/FL/NY/OH before restoring.
    // Still false for every other sector: AL has 50 rulebooks and no national
    // regime, and lab/home health/hospice have no surveyed-population
    // denominator, so a national rate for them would be invented.
    hasNational: sector === "snf" && natlFresh,
    nationalAsOf: sector === "snf" && natlFresh ? nationalAsOf : null,
  };

  const tags: TagRow[] = (t.data ?? []).map((r: Record<string, unknown>) => {
    const statePct = r.state_pct === null ? null : n(r.state_pct);
    // National comparison restored 2026-08-18. It was suppressed because
    // natl_pct came from deck_natl_rates, whose denominators reconciled with
    // nothing — for lab it reported 7,687 against 28,028 distinct cited
    // facilities and a 681,059 roster, and could not be reproduced.
    //
    // deck_top_tags now reads edu_natl_tag_rates instead, built from
    // snf_surveys per inspection cycle. The function returns natl_pct for SNF
    // and NULL for every other sector, so nothing here needs to gate by
    // sector: a null still nulls `gap` and empties worse/better, exactly as
    // the suppression did.
    const natlPct =
      !natlFresh || r.natl_pct === null || r.natl_pct === undefined ? null : n(r.natl_pct);
    return {
      tag: String(r.tag ?? ""),
      descr: String(r.descr ?? ""),
      facilities: n(r.facilities), citations: n(r.citations),
      ij: n(r.ij), complaint: n(r.complaint),
      statePct, natlPct,
      gap: statePct !== null && natlPct !== null ? statePct - natlPct : null,
    };
  });

  // 8 points is the threshold for "worth standing on stage and saying". Below
  // that the gap is inside the noise of a small state's survey cycle and
  // presenting it as a finding would be overclaiming.
  const MATERIAL = 8;
  const worse = tags.filter((x) => x.gap !== null && x.gap >= MATERIAL)
                    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0));
  const better = tags.filter((x) => x.gap !== null && x.gap <= -MATERIAL)
                     .sort((a, b) => (a.gap ?? 0) - (b.gap ?? 0));

  return {
    sector, state, headline, tags, worse, better,
    complaintShare: headline.citations
      ? Math.round((headline.complaint / headline.citations) * 100) : 0,
  };
}

/** "F0689" → "F689" — how the industry actually writes tags. */
export function prettyTag(tag: string): string {
  const m = /^([A-Z])0*(\d+)$/.exec(tag);
  return m ? `${m[1]}${m[2]}` : tag;
}

export function fmtDate(d: string | null): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", year: "numeric",
  });
}
