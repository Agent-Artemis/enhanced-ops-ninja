import Image from "next/image";
import Link from "next/link";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-[1000] border-b border-[rgb(26_110_204/0.3)] bg-eon-black px-6 py-4">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <Image
            src="/ninja-logo.png"
            alt="Enhanced Ops"
            width={300}
            height={80}
            className="h-auto max-h-14 w-auto max-w-[220px] object-contain md:max-w-[300px]"
            priority
          />
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-[13px] text-white">Enter Secret Mission</span>
          <Link
            href="#"
            className="inline-flex cursor-pointer items-center justify-center rounded-lg border-none bg-eon-blue px-7 py-3.5 text-[15px] font-medium text-white no-underline transition hover:bg-[#1562b8]"
          >
            Login
          </Link>
        </div>
      </div>
    </header>
  );
}
