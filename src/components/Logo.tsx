import Image from "next/image";

type LogoProps = {
  clair?: boolean;
  taille?: number;
};

export function Logo({ taille = 40 }: LogoProps) {
  return (
    <span className="inline-flex items-center" aria-label="NAXA">
      <Image
        src="/naxa-logo-officiel.svg"
        alt="NAXA"
        width={taille * 4}
        height={taille}
        priority
        className="block h-auto w-auto object-contain"
      />
    </span>
  );
}
