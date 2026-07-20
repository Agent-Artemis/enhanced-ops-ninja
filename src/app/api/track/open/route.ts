/**
 * Per-lead open-tracking pixel for hosted one-pagers.
 *
 * GET /api/track/open?p=<page-slug>&c=<contact-id|token>&t=<cache-buster>
 * Always returns a 1x1 transparent GIF — a DB failure must never fail the beacon.
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

const BOT_RE =
  /bot|crawl|spider|slurp|preview|slack|whatsapp|facebookexternalhit|linkedinbot|telegrambot|twitterbot|discordbot|embedly|skypeuripreview|redditbot|bingbot|googlebot|monitor|curl|wget|headless/i;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pixelResponse(): Response {
  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const page = url.searchParams.get("p") || "unknown";
    const c = url.searchParams.get("c"); // contact id / token (optional)

    const referrer = req.headers.get("referer");
    const userAgent = req.headers.get("user-agent") || "";
    const isBot = BOT_RE.test(userAgent);

    // Resolve contact: only a valid UUID that exists in crm_contacts becomes contact_id.
    let contactId: string | null = null;
    const admin = getSupabaseAdmin();
    if (c && UUID_RE.test(c)) {
      const { data: contact } = await admin
        .from("crm_contacts")
        .select("id")
        .eq("id", c)
        .maybeSingle();
      if (contact?.id) contactId = c;
    }

    await admin.from("page_opens").insert({
      page,
      token: c || null,
      contact_id: contactId,
      referrer,
      user_agent: userAgent || null,
      is_bot: isBot,
    });
  } catch {
    // Swallow — the beacon must always return the pixel.
  }

  return pixelResponse();
}
