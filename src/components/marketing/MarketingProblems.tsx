export function MarketingProblems() {
  return (
    <section className="relative bg-eon-off-black px-6 py-16" id="problems">
      <div className="mx-auto mb-12 max-w-[1100px] text-center">
        <h2 className="mb-2 font-[family-name:var(--font-bebas)] text-[42px] uppercase tracking-[0.04em]">
          THE PROBLEMS <span className="text-eon-blue">WE SOLVE</span>
        </h2>
        <p className="text-[15px] text-[rgb(255_255_255/0.55)]">
          Whether you are in healthcare or business, these pain points drain revenue and kill your
          team&apos;s morale
        </p>
      </div>
      <div className="mx-auto grid max-w-[1100px] gap-12 md:grid-cols-2">
        <div>
          <h3 className="mb-6 font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em]">
            🏥 <span className="text-eon-blue">HEALTHCARE</span>
          </h3>
          <ProblemCard
            icon="📋"
            title="Drowning in paperwork"
            body="Front desk buried in manual scheduling, intake, insurance verification — revenue lost while staff spends 4+ hours/day on data entry"
          />
          <ProblemCard
            icon="📞"
            title="Missed calls & no-shows"
            body="Patients can&apos;t reach you. They don&apos;t get reminders. Cancellations cost you 15%+ of potential revenue every month"
          />
          <ProblemCard
            icon="💰"
            title="AR bleeding money"
            body="Insurance claims sit for weeks. Patient balances never get followed up. You&apos;re leaving $50K–$200K on the table annually"
          />
          <ProblemCard
            icon="🔍"
            title="Zero visibility into your practice"
            body="You don&apos;t know which services are profitable, who your best patients are, or where to invest next"
          />
        </div>
        <div>
          <h3 className="mb-6 font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em]">
            🏢 <span className="text-eon-blue">BUSINESS</span>
          </h3>
          <ProblemCard
            icon="📋"
            title="Drowning in repetitive work"
            body="Your team spends 20+ hours per week on data entry, follow-ups, and manual workflows that could be automated"
          />
          <ProblemCard
            icon="📞"
            title="Missed revenue opportunities"
            body="Leads don&apos;t get contacted fast enough. Follow-ups fall through the cracks. Renewals get missed. Customers churn preventably"
          />
          <ProblemCard
            icon="💰"
            title="Cash flow problems"
            body="Invoices never get followed up on. Customers aren&apos;t reminded. Collections are reactive, not proactive. Cash sits in AR"
          />
          <ProblemCard
            icon="🔍"
            title="You're flying blind"
            body="No real-time dashboard. You can&apos;t see revenue pipeline, customer health, or team productivity without pulling reports manually"
          />
        </div>
      </div>
    </section>
  );
}

function ProblemCard(props: { icon: string; title: string; body: string }) {
  return (
    <div className="mb-4 rounded-[10px] border border-[rgb(255_255_255/0.08)] bg-eon-dark p-5">
      <div className="mb-2 text-2xl">{props.icon}</div>
      <h4 className="mb-1 text-sm font-semibold">{props.title}</h4>
      <p className="text-[13px] text-[rgb(255_255_255/0.55)]">{props.body}</p>
    </div>
  );
}
