import Image from "next/image";

export function Logo({ clair = true, taille = 40 }: { clair?: boolean; taille?: number }) {
  return (
    <Image
      src={clair ? "/naxa-logo.png" : "/naxa-logo-sombre.png"}
      alt="NAXA"
      width={Math.round(taille * 3.95)}
      height={taille}
      priority
    />
  );
}
