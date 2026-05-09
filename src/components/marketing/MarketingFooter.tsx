export function MarketingFooter() {
  return (
    <footer className="border-t border-[rgb(255_255_255/0.06)] bg-[#060606] px-6 pb-6 pt-12">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xl" aria-hidden>
                ⚔
              </span>
              <div className="font-[family-name:var(--font-bebas)] text-base tracking-[0.1em] text-white">
                ENHANCED <span className="text-eon-blue">OPS</span>
              </div>
            </div>
            <ul className="list-none space-y-2">
              <li>
                <a className="text-[13px] text-[rgb(255_255_255/0.55)] no-underline hover:text-eon-blue" href="#about">
                  About Enhanced Ops
                </a>
              </li>
              <li>
                <a className="text-[13px] text-[rgb(255_255_255/0.55)] no-underline hover:text-eon-blue" href="#services">
                  Our Services
                </a>
              </li>
              <li>
                <span className="text-[13px] text-[rgb(255_255_255/0.55)]">Case Studies (coming soon)</span>
              </li>
              <li>
                <span className="text-[13px] text-[rgb(255_255_255/0.55)]">Blog (coming soon)</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 font-[family-name:var(--font-bebas)] text-[13px] uppercase tracking-[0.08em] text-white">
              Legal
            </h3>
            <ul className="list-none space-y-2">
              <li>
                <span className="text-[13px] text-[rgb(255_255_255/0.55)]">Privacy Policy</span>
              </li>
              <li>
                <span className="text-[13px] text-[rgb(255_255_255/0.55)]">Terms of Service</span>
              </li>
              <li>
                <span className="text-[13px] text-[rgb(255_255_255/0.55)]">HIPAA Notice</span>
              </li>
              <li>
                <a className="text-[13px] text-[rgb(255_255_255/0.55)] no-underline hover:text-eon-blue" href="mailto:hello@enhancedops.com">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 font-[family-name:var(--font-bebas)] text-[13px] uppercase tracking-[0.08em] text-white">
              Connect
            </h3>
            <ul className="list-none space-y-2">
              <li>
                <a
                  className="text-[13px] text-[rgb(255_255_255/0.55)] no-underline hover:text-eon-blue"
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <span className="text-[13px] text-[rgb(255_255_255/0.55)]">Schedule a Call</span>
              </li>
              <li>
                <a className="text-[13px] text-[rgb(255_255_255/0.55)] no-underline hover:text-eon-blue" href="mailto:hello@enhancedops.com">
                  Email
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[rgb(255_255_255/0.08)] pt-6 text-center">
          <p className="mb-2 text-xs text-[rgb(255_255_255/0.25)]">© 2026 Enhanced Ops. All rights reserved.</p>
          <p className="text-xs text-[rgb(255_255_255/0.25)]">An Augeo LLC Company</p>
          <p className="mt-4 text-[11px] text-[rgb(255_255_255/0.15)]">
            Healthcare services are delivered in compliance with HIPAA. Information submitted on this site is encrypted and never sold or shared with third parties. | Powered by Artemis
          </p>
        </div>
      </div>
    </footer>
  );
}
