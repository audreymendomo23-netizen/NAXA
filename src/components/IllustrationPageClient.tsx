import Image from "next/image";

type IllustrationPageClientProps = { src: string; alt: string; titre: string };

/** Illustration locale discrète pour les pages du compte client. */
export function IllustrationPageClient({ src, alt, titre }: IllustrationPageClientProps) {
  return (
    <figure className="mb-4 overflow-hidden rounded-2xl border border-[#DCE9DF] bg-white shadow-sm">
      <Image src={src} alt={alt} width={1200} height={360} sizes="(max-width: 640px) 100vw, 640px" className="h-28 w-full object-cover sm:h-36" />
      <figcaption className="px-4 py-2 text-sm font-bold text-[#0B3D26]">{titre}</figcaption>
    </figure>
  );
}
