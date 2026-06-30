'use client';

import { useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy singleton — avoids module-level createClient call that breaks prerendering
let _sb: SupabaseClient | null = null;
function getSb() {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _sb;
}

export default function CrmLogin() {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const allowed = email.endsWith('@enhancedops.ninja') || email === 'jeff@augeo-hq.com';
    if (!allowed) { setError('Access restricted to @enhancedops.ninja accounts.'); return; }
    setLoading(true);
    const { error: err } = await getSb().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'https://crm.enhancedops.ninja' },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#1f2937',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 440,
        backgroundColor: '#111111', borderRadius: 16,
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)', padding: 48,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ninja.png" alt="Ninja CRM" style={{ height: 80, objectFit: 'contain', marginBottom: 12 }} />
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Ninja CRM — Team Access</p>
        </div>

        {sent ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            backgroundColor: '#E8F0FF', color: '#1A6BF9',
            borderRadius: 8, padding: '14px 16px', fontSize: 14, fontWeight: 500,
          }}>
            📬 Check your email for your access link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@enhancedops.ninja"
              required
              style={{
                width: '100%', height: 44, padding: '0 14px',
                backgroundColor: '#1f2937', border: '1px solid #374151',
                borderRadius: 8, fontSize: 14, color: '#FFFFFF',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            {error && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>}
            <button
              type="submit" disabled={loading || !email}
              style={{
                width: '100%', height: 44, background: '#1A6BF9', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Sending…' : 'Send Magic Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
