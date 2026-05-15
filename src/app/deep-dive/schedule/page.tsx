'use client';
import { useRouter } from 'next/navigation';

export default function SchedulePage() {
  const router = useRouter();

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif', padding: '48px 24px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '56px', lineHeight: 1, marginBottom: '12px' }}>
          Book Your Review Call.
        </h1>
        <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.55)', fontWeight: 300, lineHeight: 1.6, marginBottom: '32px' }}>
          Pick a time that works for you. This is your 45-minute 1:1 with us — we&apos;ll walk through your full results and hand you a clear implementation plan.
        </p>
        <div style={{ background: 'rgba(26,110,204,0.08)', border: '1px solid rgba(26,110,204,0.25)', borderRadius: '4px', padding: '20px 24px', marginBottom: '28px' }}>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, fontWeight: 300 }}>
            💡 <strong style={{ color: '#fff' }}>What to expect on the call:</strong> We&apos;ll go through your assessment module by module, show you exactly where your biggest leverage points are, and give you a prioritized action plan you can start using immediately.
          </p>
        </div>
        <iframe
          src="https://cal.com/enhancedopsninja/45-min-with-enhanced-ops-ninja"
          width="100%"
          height="600"
          style={{ border: 'none', borderRadius: '4px', marginBottom: '24px' }}
        />
        <button
          onClick={() => router.push('/deep-dive/confirmation')}
          style={{ width: '100%', background: '#1A6ECC', color: '#fff', border: 'none', padding: '17px 24px', borderRadius: '3px', fontFamily: 'Bebas Neue, sans-serif', fontSize: '20px', letterSpacing: '1px', cursor: 'pointer' }}
        >
          I&apos;ve Scheduled My Call →
        </button>
      </div>
    </div>
  );
}
