import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Lazy singleton — created on first call so the auth session written to
// localStorage in page.tsx's useEffect is already present when this client
// initializes and reads its session.
let _client: SupabaseClient | null = null;

export function getCrmClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(url, key, {
      auth: { detectSessionInUrl: false, persistSession: true },
    });
  }
  return _client;
}

// Proxy so callers can still write `crmSupabase.from(...)` etc.
export const crmSupabase = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const client = getCrmClient();
    const val = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  },
});
