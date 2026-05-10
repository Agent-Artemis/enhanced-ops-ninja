import Image from "next/image";
import Link from "next/link";

export function MarketingHeader(props: { onBookCall: () => void }) {
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
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/assessment"
            className="cursor-pointer rounded-md border border-eon-blue bg-transparent px-5 py-2.5 text-[13px] font-medium text-eon-blue no-underline transition hover:bg-[rgb(26_110_204/0.1)]"
          >
            Take Free Assessment
          </Link>
          <button
            type="button"
            className="cursor-pointer rounded-md border-none bg-eon-blue px-5 py-2.5 text-[13px] font-medium text-white transition hover:bg-[#1562b8]"
            onClick={props.onBookCall}
          >
            Book Strategy Call
          </button>
        </div>
      </div>
    </header>
  );
}
