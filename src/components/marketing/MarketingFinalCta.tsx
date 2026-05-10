import Image from "next/image";
import Link from "next/link";

export function MarketingFinalCta(props: { onBookCall: () => void }) {
  return (
    <section className="bg-eon-blue px-6 py-16 text-center">
      <Image
        src="/ninja-character.jpg"
        alt="Ninja confident"
        width={140}
        height={140}
        className="mx-auto mb-6 opacity-85"
      />
      <h2 className="mx-auto mb-4 max-w-[900px] font-[family-name:var(--font-bebas)] text-[36px] uppercase leading-tight tracking-[0.04em] md:text-[52px]">
        YOUR COMPETITION IS
        <br />
        ALREADY AUTOMATING.
      </h2>
      <p className="mx-auto mb-8 max-w-[500px] text-[15px] opacity-90">
        Get your free assessment and find out exactly where you&apos;re losing time and money —
        before it costs you more.
      </p>
      <div className="flex flex-col items-center justify-center gap-4 md:flex-row">
        <Link
          href="/assessment"
          className="inline-flex cursor-pointer items-center justify-center rounded-lg border-none bg-white px-7 py-3.5 text-[15px] font-medium text-eon-blue no-underline transition hover:opacity-90"
        >
          Get My Free Assessment →
        </Link>
        <button
          type="button"
          className="cursor-pointer rounded-lg border border-white bg-transparent px-7 py-3.5 text-[15px] font-medium text-white transition hover:bg-[rgb(255_255_255/0.1)]"
          onClick={props.onBookCall}
        >
          Book a Strategy Call
        </button>
      </div>
    </section>
  );
}
