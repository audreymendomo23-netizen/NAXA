type IllustrationPageClientProps = { src: string; alt: string; titre: string };

/** Carte éditoriale avec photo en arrière-plan et texte superposé, dans le style Achats / Réservations / Commandes. */
export function IllustrationPageClient({ src, alt, titre }: IllustrationPageClientProps) {
  return (
    <section
      aria-label={titre}
      className="relative isolate mb-4 flex min-h-[116px] items-end overflow-hidden rounded-2xl border border-[#DCE9DF] bg-[#0B3D26] shadow-sm sm:min-h-[144px]"
    >
      <img
        src={src}
        alt={alt}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover"
        onError={(event) => {
          // Keep the editorial card legible if an asset is missing in a deployment.
          event.currentTarget.style.display = "none";
        }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#062E1D]/95 via-[#0B3D26]/70 to-[#0B3D26]/15" />
      <h2 className="relative z-10 max-w-[85%] px-4 py-4 text-base font-extrabold leading-tight text-white drop-shadow sm:px-5 sm:py-5 sm:text-lg">
        {titre}
      </h2>
    </section>
  );
}
