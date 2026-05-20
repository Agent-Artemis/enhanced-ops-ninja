import type { ReactNode } from "react";

type StatItem = {
  icon: ReactNode;
  title: string;
  subtitle: string;
};

const iconClass = "mb-[5px] h-[19px] w-[19px] text-[rgba(255,255,255,0.8)]";

function IconClock() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function IconPigMoney() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 11v.01" />
      <path d="M16 5v.01" />
      <path d="M8 5v.01" />
      <path d="M8 9v.01" />
      <path d="M8 15v.01" />
      <path d="M8 19v.01" />
      <path d="M16 15v2" />
      <path d="M8 11v.01" />
      <path d="M19 11a7 7 0 0 0 -14 0v3a3 3 0 0 0 3 3h8a3 3 0 0 0 3 -3v-3z" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
      <path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <path d="M21 21v-2a4 4 0 0 0 -3 -3.85" />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
    </svg>
  );
}

const stats: StatItem[] = [
  { icon: <IconClock />, title: "TIME", subtitle: "Reclaim your hours" },
  { icon: <IconPigMoney />, title: "FINANCES", subtitle: "Stop leaving money behind" },
  { icon: <IconUsers />, title: "STAFFING", subtitle: "Do more with your team" },
  { icon: <IconHeart />, title: "PATIENT & CLIENT CARE", subtitle: "Deliver a better experience" },
];

export function MarketingStats() {
  return (
    <section className="flex w-full flex-row items-stretch bg-eon-blue px-10 py-6">
      <div className="flex flex-[1.1] flex-col justify-center">
        <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-white opacity-70">WE FOCUS ON</p>
        <p className="text-[26px] font-bold text-white">LEVERAGE</p>
      </div>

      <div className="mx-7 w-px shrink-0 self-stretch bg-[rgba(255,255,255,0.25)]" aria-hidden />

      {stats.map((item) => (
        <div key={item.title} className="flex flex-1 flex-col items-center justify-center px-1.5 text-center">
          {item.icon}
          <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-white">{item.title}</p>
          <p className="text-[11px] leading-[1.3] text-white opacity-65">{item.subtitle}</p>
        </div>
      ))}
    </section>
  );
}
