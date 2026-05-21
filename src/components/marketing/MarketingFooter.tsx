import Image from "next/image";

const NINJA_PARADE = [
  { src: "/Ninja_Meditation-transparent.png", alt: "Ninja meditating" },
  { src: "/Ninja_Flip_Tuck-rtransparent.png", alt: "Ninja flip tuck" },
  { src: "/Ninja_Flying_Side_Kick-Transparent.png", alt: "Ninja flying side kick" },
  { src: "/Ninja_horse_stance-transparent.png", alt: "Ninja horse stance" },
  { src: "/Ninja_Shurikan-removebg-preview.png", alt: "Ninja with shuriken" },
  { src: "/Ninja_Squatting-transparent.png", alt: "Ninja squatting" },
  { src: "/Ninja_with_sword-removebg-preview.png", alt: "Ninja with sword" },
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-t border-[rgb(255_255_255/0.06)] bg-[#060606] px-6 pb-6 pt-12">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-8 flex w-full items-end justify-evenly">
          {NINJA_PARADE.map((ninja) => (
            <Image
              key={ninja.src}
              src={ninja.src}
              alt={ninja.alt}
              width={100}
              height={100}
              className="h-[90px] w-auto max-w-[100px] object-contain"
            />
          ))}
        </div>
        <div className="border-t border-[rgb(255_255_255/0.08)] pt-6 text-center">
          <p className="mb-2 text-xs text-[rgb(255_255_255/0.25)]">© 2026 Enhanced Ops Ninja. All rights reserved.</p>
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
