import Image from "next/image";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[rgb(255_255_255/0.06)] bg-[#060606] px-6 pb-6 pt-12">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-8">
          <Image
            src="/Ninja_Transparent.png"
            alt="Enhanced Ops"
            width={80}
            height={80}
            className="h-auto w-20 object-contain"
          />
        </div>
        <div className="border-t border-[rgb(255_255_255/0.08)] pt-6 text-center">
          <p className="mb-2 text-xs text-[rgb(255_255_255/0.25)]">© 2026 Enhanced Ops. All rights reserved.</p>
          <p className="text-xs text-[rgb(255_255_255/0.25)]">An Augeo LLC Company</p>
          <p className="text-xs text-[rgb(255_255_255/0.25)]">Powered by Artemis</p>
          <p className="mt-4 text-[11px] text-[rgb(255_255_255/0.15)]">
            Healthcare services are delivered in compliance with HIPAA. Information submitted on this site is encrypted and never sold or shared with third parties. | Powered by Artemis
          </p>
        </div>
      </div>
    </footer>
  );
}
