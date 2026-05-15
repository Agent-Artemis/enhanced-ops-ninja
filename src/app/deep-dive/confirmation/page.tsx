import Link from 'next/link';

const checklistItems = [
  {
    title: 'Payment receipt — $1,500',
    desc: "We've recorded your $1,500 payment. You'll get a receipt by email, and that deposit reserves your deep dive with the team.",
  },
  {
    title: 'Assessment score',
    desc: "Your scores are saved in our system. On your call we'll walk through what they mean and where you have the most leverage.",
  },
  {
    title: 'Appointment confirmation',
    desc: "Watch your inbox for the calendar invite and meeting link. If you don't see it within a few minutes, check spam or promotions.",
  },
] as const;

export default function DeepDiveConfirmationPage() {
  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif', padding: '48px 24px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <p style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1A6ECC', marginBottom: '12px' }}>
          You&apos;re all set
        </p>
        <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '56px', lineHeight: 1, marginBottom: '16px' }}>
          {"You're All Set."}
        </h1>
        <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.55)', fontWeight: 300, lineHeight: 1.6, marginBottom: '28px' }}>
          {"Here's what we have on file before your review call — if anything looks off, reply to your confirmation email and we'll fix it."}
        </p>
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '4px',
            padding: '20px 24px',
            marginBottom: '32px',
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          {checklistItems.map((item, index) => (
            <div
              key={item.title}
              style={{
                paddingTop: index === 0 ? '0' : '16px',
                paddingBottom: '16px',
                borderBottom: index < checklistItems.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              }}
            >
              <h4 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '4px', marginTop: 0, color: '#fff' }}>{item.title}</h4>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, fontWeight: 300, margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: '28px' }}>
          {"We'll see you on the call — bring your questions and we'll map practical next steps together."}
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.45)',
            textDecoration: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.2)',
            paddingBottom: '2px',
            fontWeight: 400,
          }}
        >
          Return to Enhanced Ops
        </Link>
      </div>
    </div>
  );
}
