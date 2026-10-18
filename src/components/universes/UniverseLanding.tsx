import Link from "next/link";

type UniverseKey = "parapharmacie" | "bebe-maman" | "examens" | "prestations" | "suivi" | "aide";

const universes: Record<UniverseKey, { title: string; slogan: string; description: string; theme: string; accent: string; icon: string; bullets: string[] }> = {
  parapharmacie: { title: "Parapharmacie", slogan: "Votre allié santé", description: "Hygiène, soin et bien-être auprès des partenaires NAXA.", theme: "bg-teal-50", accent: "text-teal-800", icon: "✳", bullets: ["Produits d’hygiène et de soin", "Disponibilités communiquées par les partenaires", "Retrait auprès du partenaire — pas de livraison"] },
  "bebe-maman": { title: "Bébé & Maman", slogan: "Votre allié santé", description: "Un espace dédié aux besoins de la maman et de l’enfant.", theme: "bg-pink-50", accent: "text-pink-800", icon: "♡", bullets: ["Sélection adaptée à l’univers bébé et maternité", "Informations produits claires", "Retrait auprès du partenaire — pas de livraison"] },
  examens: { title: "Examens médicaux", slogan: "Votre allié santé", description: "Retrouvez les examens proposés par les centres partenaires.", theme: "bg-violet-50", accent: "text-violet-800", icon: "＋", bullets: ["Catalogue des examens", "Tarifs communiqués par les centres", "Prise de rendez-vous bientôt disponible"] },
  prestations: { title: "Prestations à domicile", slogan: "Votre allié santé", description: "Découvrez les services proposés par des professionnels vérifiés.", theme: "bg-orange-50", accent: "text-orange-800", icon: "⌂", bullets: ["Services et zones d’intervention", "Demande de réservation", "Coordonnées privées jusqu’à confirmation"] },
  suivi: { title: "Suivi santé", slogan: "Votre allié santé", description: "Un espace de suivi personnel, sans diagnostic ni interprétation médicale par NAXA.", theme: "bg-blue-50", accent: "text-blue-800", icon: "♡", bullets: ["Mesures personnelles", "Partage contrôlé avec un professionnel invité", "Alertes informatives — ne remplace pas les urgences"] },
  aide: { title: "Aide NAXA", slogan: "Votre allié santé", description: "Trouvez de l’aide pour utiliser NAXA et accéder aux ressources urgentes.", theme: "bg-emerald-50", accent: "text-emerald-800", icon: "?", bullets: ["Aide à l’utilisation de NAXA", "Échange avec un pharmacien selon disponibilité", "En cas d’urgence au Cameroun, appelez le 119"] },
};

export function UniverseLanding({ universe, comingSoon = true }: { universe: UniverseKey; comingSoon?: boolean }) {
  const item = universes[universe];
  return (
    <main className="min-h-screen bg-white px-4 pb-24 text-slate-900">
      <div className="mx-auto max-w-3xl pt-5">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 font-bold text-[#064B2A] hover:bg-emerald-50" aria-label="Retour à l’accueil Pharmacie">
          <span aria-hidden="true">←</span> NAXA · Accueil
        </Link>
        <section className={`mt-5 rounded-3xl p-6 sm:p-9 ${item.theme}`}>
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm ${item.accent}`} aria-hidden="true">{item.icon}</div>
          <p className={`mt-5 text-sm font-bold uppercase tracking-wide ${item.accent}`}>{item.slogan}</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{item.title}</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-700">{item.description}</p>
          {comingSoon && <p className="mt-5 inline-flex min-h-10 items-center rounded-full bg-white px-4 text-sm font-bold text-slate-700 shadow-sm">Bientôt disponible</p>}
        </section>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-extrabold">Dans cet espace</h2>
          <ul className="mt-4 space-y-3">
            {item.bullets.map((bullet) => <li key={bullet} className="flex gap-3 text-sm leading-6 text-slate-700"><span className={`mt-0.5 font-black ${item.accent}`} aria-hidden="true">✓</span><span>{bullet}</span></li>)}
          </ul>
          {universe === "suivi" && <p className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-950">Ce service ne constitue pas un dispositif d’urgence. En cas de symptôme inquiétant, contactez un professionnel de santé ou les services d’urgence.</p>}
          {universe === "aide" && <a href="https://wa.me/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#064B2A] px-4 font-bold text-white">Options de contact</a>}
        </section>
      </div>
    </main>
  );
}
