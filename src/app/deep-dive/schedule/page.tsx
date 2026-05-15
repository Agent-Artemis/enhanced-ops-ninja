'use client';

import { useRouter } from 'next/navigation';

const CAL_EMBED_SRC =
  'https://cal.com/enhancedopsninja/45-min-with-enhanced-ops-ninja';

export default function DeepDiveSchedulePage() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#000',
        color: '#fff',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        padding: '40px 20px 48px',
      }}
    >
      <main style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1
          style={{
            margin: '0 0 16px',
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 56,
            fontWeight: 400,
            lineHeight: 1.05,
            color: '#fff',
          }}
        >
          Book Your Review Call.
        </h1>

        <p
          style={{
            margin: '0 0 28px',
            maxWidth: 640,
            fontSize: 16,
            lineHeight: 1.65,
            color: 'rgba(255, 255, 255, 0.55)',
          }}
        >
          Pick a time that works for you. This is your 45-minute 1:1 with us —
          we&apos;ll walk through your full results and hand you a clear
          implementation plan.
        </p>

        <div
          style={{
            marginBottom: 28,
            maxWidth: 640,
            padding: '20px 22px',
            borderRadius: 12,
            border: '1px solid rgba(26, 110, 204, 0.25)',
            backgroundColor: 'rgba(26, 110, 204, 0.14)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.65,
              color: 'rgba(255, 255, 255, 0.92)',
            }}
          >
            <span aria-hidden="true">💡 </span>
            <strong style={{ color: '#fff' }}>
              What to expect on the call:
            </strong>{' '}
            We&apos;ll walk you through your results module by module, explain
            what each finding means in plain language, and hand you a prioritized
            action plan so you know exactly what to tackle first.
          </p>
        </div>

        <iframe
          src={CAL_EMBED_SRC}
          title="Book a 45-minute review call with Enhanced Ops Ninja"
          width="100%"
          height={600}
          style={{
            width: '100%',
            height: 600,
            border: 'none',
            borderRadius: 12,
            display: 'block',
            marginBottom: 24,
          }}
        />

        <button
          type="button"
          onClick={() => router.push('/deep-dive/confirmation')}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            backgroundColor: '#1A6ECC',
            color: '#fff',
            padding: '17px 24px',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          I&apos;ve Scheduled My Call →
        </button>
      </main>
    </div>
  );
}
