/**
 * Retell API helpers for the voice conversation-intelligence pipeline (Layer 2).
 *
 * Thin wrappers over Retell's v2 REST API. Server-side only — the API key lives
 * in RETELL_API_KEY (already configured in Vercel for this project) and must
 * never reach the client.
 */
import "server-only";

// The outbound voice agent whose calls we analyze (Ava — Stone EG Investor Warm-Up).
export const VOICE_AGENT_ID = "agent_a07f941df931687380b4b42d60";

const RETELL_BASE = "https://api.retellai.com";

export type RetellWord = { word?: string; start?: number; end?: number };
export type RetellTurn = {
  role?: string; // "agent" | "user"
  content?: string;
  words?: RetellWord[];
};

export type RetellCall = {
  call_id?: string;
  agent_id?: string;
  to_number?: string;
  from_number?: string;
  start_timestamp?: number;
  duration_ms?: number;
  call_status?: string;
  disconnection_reason?: string;
  transcript?: string;
  transcript_object?: RetellTurn[];
  recording_url?: string;
  call_analysis?: Record<string, unknown> | null;
};

function retellKey(): string {
  const key = process.env.RETELL_API_KEY;
  if (!key) throw new Error("RETELL_API_KEY not configured");
  return key;
}

/** POST /v2/list-calls — most recent N calls, newest first. */
export async function retellListCalls(limit = 20): Promise<RetellCall[]> {
  const res = await fetch(`${RETELL_BASE}/v2/list-calls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${retellKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ limit, sort_order: "descending" }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Retell list-calls failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as RetellCall[];
  return Array.isArray(data) ? data : [];
}

/**
 * POST /v2/create-phone-call — place an OUTBOUND call with an agent.
 *
 * Used by the AI Call List ("Jason") to dial a prospect. This is the integration
 * point only — the calling route keeps it GATED behind JASON_DIALING_ENABLED, so
 * no call is placed until Jeff explicitly turns dialing on.
 *
 * Requires RETELL_FROM_NUMBER (a Retell-provisioned number) and the agent id.
 */
export async function retellCreatePhoneCall(opts: {
  toNumber: string;
  fromNumber: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ call_id?: string }> {
  const body: Record<string, unknown> = {
    from_number: opts.fromNumber,
    to_number: opts.toNumber,
  };
  if (opts.agentId) body.override_agent_id = opts.agentId;
  if (opts.metadata) body.metadata = opts.metadata;

  const res = await fetch(`${RETELL_BASE}/v2/create-phone-call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${retellKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Retell create-phone-call failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as { call_id?: string };
}

/** GET /v2/get-call/{id} — full call incl. transcript_object + recording_url. */
export async function retellGetCall(callId: string): Promise<RetellCall> {
  const res = await fetch(`${RETELL_BASE}/v2/get-call/${encodeURIComponent(callId)}`, {
    headers: { Authorization: `Bearer ${retellKey()}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Retell get-call failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as RetellCall;
}
