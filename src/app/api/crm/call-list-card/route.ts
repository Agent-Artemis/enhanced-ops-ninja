/**
 * Per-person "OCS" button on the public call-list pages (enhancedops.ninja/lists/*).
 * Those pages have no CRM auth session, so they can't insert via the browser client.
 * This route uses the service-role admin client to mint a crm_contacts card that
 * lands in the CRM's "Action Needed" section (is_active + no next_action_date).
 *
 * Guards: same-site origin check, strict name/phone validation, and dedupe by a
 * stable per-person key so repeat taps don't pile up duplicate cards.
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function digitsOnly(s: string): string {
  return (s || "").replace(/\D/g, "");
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  if (origin && !/(^|\/\/|\.)enhancedops\.ninja/.test(origin)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // ── Remove (un-OCS): delete the card this list previously created ──────────
  if (body.action === "remove") {
    const key = String(body.key ?? "").trim().slice(0, 160);
    if (!key) {
      return NextResponse.json({ error: "key required" }, { status: 400 });
    }
    const admin = getSupabaseAdmin();
    // Scoped to call-list cards only, so we can never delete a real contact.
    const { error } = await admin
      .from("crm_contacts")
      .delete()
      .eq("custom_fields->>call_list_key", key)
      .eq("custom_fields->>source", "call-list");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, removed: true });
  }

  const name = String(body.name ?? "").trim();
  const phoneRaw = String(body.phone ?? "").trim();
  const facility = String(body.facility ?? "").trim();
  const city = String(body.city ?? "").trim();
  // Optional, used by the operator-exec list (people-first rows carry an email
  // and a job title). Older lists omit both, so they stay null.
  const emailRaw = String(body.email ?? "").trim().slice(0, 200);
  const email = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(emailRaw) ? emailRaw.toLowerCase() : "";
  const title = String(body.title ?? "").trim().slice(0, 160);
  // Company-level cards. The NAD target list is mostly chains that publish a
  // web form and no executive at all, so a row can be a real, workable target
  // with no person on it. Older lists never send these fields and are
  // unaffected by every branch below.
  const company = String(body.company ?? "").trim().slice(0, 200);
  const route = String(body.route ?? "").trim().slice(0, 400);
  const context = String(body.context ?? "").trim().slice(0, 4000);
  // snf/al is preserved for the three existing lists; anything else is passed
  // through verbatim rather than being silently filed as AL.
  const rawTab = String(body.tab ?? "").trim().slice(0, 40);
  const tab = rawTab === "snf" || rawTab === "al" ? rawTab : rawTab || "al";
  const legacyTab = tab === "snf" || tab === "al";
  const listId = String(body.list ?? "call-list").trim().slice(0, 60);
  const bizTag =
    listId === "nad-targets" ? "nad" : listId === "ma-partners" ? "ma-partners" : "";
  const key = String(body.key ?? "").trim().slice(0, 160);

  // A card needs someone or something to be about, and at least one way in.
  // The old rule (name AND phone) rejected every company-level target.
  const hasWhom = Boolean(name || company);
  const hasRoute = digitsOnly(phoneRaw).length >= 10 || Boolean(email) || Boolean(route);
  if (!hasWhom || !hasRoute) {
    return NextResponse.json(
      { error: "a name or company, plus a phone, email or contact route, are required" },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();

  // Dedupe on the stable per-row key. On the healthcare lists that key is a
  // person; on the NAD list it is the company, because there the company IS
  // the target and the person is an attribute of it.
  //
  // A second click used to return the existing id unchanged. That is wrong for
  // a row Jeff OCS'd as a company card before he knew the buyer's name: the
  // name he learned on the call would never reach the card. It now FILLS IN
  // fields that are still empty and never overwrites one that has a value, so
  // anything typed in the CRM by hand always wins.
  if (key) {
    const { data: existing } = await admin
      .from("crm_contacts")
      .select("id, first_name, last_name, company, phone, email, custom_fields")
      .eq("custom_fields->>call_list_key", key)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      const cf = (existing.custom_fields ?? {}) as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      if (name && !existing.last_name && !cf.title) {
        const np = name.split(/\s+/);
        patch.first_name = np.shift() || name;
        patch.last_name = np.length ? np.join(" ") : null;
      }
      if (!existing.company && (facility || company)) patch.company = facility || company;
      if (!existing.phone && phoneRaw) patch.phone = phoneRaw;
      if (!existing.email && email) patch.email = email;
      const cfPatch: Record<string, unknown> = {};
      if (title && !cf.title) cfPatch.title = title;
      if (route && !cf.contact_route) cfPatch.contact_route = route;
      if (Object.keys(cfPatch).length) patch.custom_fields = { ...cf, ...cfPatch };
      if (Object.keys(patch).length) {
        await admin.from("crm_contacts").update(patch).eq("id", existing.id);
        return NextResponse.json({ ok: true, id: existing.id, updated: true });
      }
      return NextResponse.json({ ok: true, id: existing.id, deduped: true });
    }
  }

  // With no person named, the company carries the card so it is findable.
  const cardName = name || company;
  const parts = cardName.split(/\s+/);
  const firstName = parts.shift() || cardName;
  const lastName = name && parts.length ? parts.join(" ") : null;

  const { data: created, error } = await admin
    .from("crm_contacts")
    .insert({
      first_name: firstName,
      last_name: lastName,
      company: facility || company || null,
      phone: phoneRaw || null,
      email: email || null,
      is_active: true, // → Action Needed
      bucket: "active",
      next_action_date: null,
      // crm_contacts now holds healthcare operators AND supplement white-label
      // targets. Tagging at creation costs nothing; retrofitting hundreds of
      // cards later does.
      tags: ["call-list", listId, ...(bizTag ? [bizTag] : [])],
      custom_fields: {
        source: "call-list",
        call_list: listId,
        call_list_tab: tab,
        call_list_key: key,
        city,
        ...(title ? { title } : {}),
        ...(route ? { contact_route: route } : {}),
      },
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (created?.id) {
    const bits = [
      title && `Title: ${title}`,
      (facility || company) && `${title ? "Operator" : "Company"}: ${facility || company}`,
      city && `City: ${city}`,
      phoneRaw && `Phone: ${phoneRaw}`,
      email && `Email: ${email}`,
      route && `Route: ${route}`,
    ]
      .filter(Boolean)
      .join(" · ");
    // For a row whose only way in is a web form, that URL is the card's entire
    // value, so it leads the note rather than trailing the metadata.
    const routeUrl = (route.match(/https?:\/\/[^\s,;)]+|(?:www\.)?[a-z0-9-]+\.(?:com|health|io|net)(?:\/[^\s,;)]*)?/i) || [])[0] || "";
    const routeLine = routeUrl
      ? `Contact route: ${/^https?:\/\//i.test(routeUrl) ? routeUrl : "https://" + routeUrl}`
      : route
        ? `Contact route: ${route}`
        : "";
    const from = legacyTab
      ? `the ${tab === "snf" ? "SNF" : "AL"} call list (${listId})`
      : `the ${listId} call list${tab ? ` (${tab})` : ""}`;
    // context carries the why and the rest of the bench, so the card still
    // makes sense a week later with this page closed.
    await admin.from("crm_notes").insert({
      contact_id: created.id,
      body: `${routeLine ? routeLine + "\n" : ""}Added from ${from}.${bits ? "\n" + bits : ""}${context ? "\n\n" + context : ""}`,
    });
  }

  return NextResponse.json({ ok: true, id: created?.id });
}
