'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CrmLogin() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const allowed =
      email.endsWith('@enhancedops.ninja') || email === 'jeff@augeo-hq.com';
    if (!allowed) {
      setError('Access restricted to @enhancedops.ninja accounts.');
      return;
    }

    setLoading(true);
    const { error: err } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'https://crm.enhancedops.ninja' },
    });
    setLoading(false);

    if (err) { setError(err.message); return; }
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-8">
          <div className="text-3xl mb-2">🥷</div>
          <h1 className="text-xl font-bold text-slate-800">EON CRM</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to continue</p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="text-4xl mb-4">📬</div>
            <p className="text-slate-700 font-medium">Check your email</p>
            <p className="text-sm text-slate-500 mt-2">
              We sent a magic link to <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@enhancedops.ninja"
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-[#1A6ECC] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#155fb3] disabled:opacity-40 transition-colors"
            >
              {loading ? 'Sending…' : 'Send Magic Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
