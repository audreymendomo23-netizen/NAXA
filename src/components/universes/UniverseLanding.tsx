import Link from "next/link";
import { MenuUnivers } from "@/components/universes/MenuUnivers";

type UniverseKey = "parapharmacie" | "bebe-maman" | "examens" | "prestations" | "suivi" | "aide";

type Universe = {
  title: string;
  slogan: string;
  description: string;
  route: string;
  color: string;
  soft: string;
  border: string;
  icon: string;
  bullets: string[];
};

const universes: Record<UniverseKey, Universe> = {
  parapharmacie: {
    title: "Parapharmacie", slogan: "Votre allié santé",
    description: "Hygiène, soin et bien-être auprès des partenaires NAXA.",
    route: "/parapharmacie", color: "#0B7F85", soft: "#E6F7F6", border: "#BFE6E4", icon: "✳",
    bullets: ["Produits d’hygiène et de soin", "Disponibilités confirmées par les partenaires", "Réservation et retrait auprès du partenaire"],
  },
  "bebe-maman": {
    title: "Bébé & Maman", slogan: "Votre allié santé",
    description: "Un espace dédié aux besoins de la maman et de l’enfant.",
    route: "/bebe-maman", color: "#C93774", soft: "#FDEEF4", border: "#F7CADC", icon: "♡",
    bullets: ["Sélection dédiée à la maternité et à la petite enfance", "Informations produits claires", "Réservation et retrait auprès du partenaire"],
  },
  examens: {
    title: "Examens médicaux", slogan: "Votre allié santé",
    description: "Découvrez les examens proposés par les centres partenaires.",
    route: "/examens", color: "#6D3FD0", soft: "#F1EBFD", border: "#D9CCF7", icon: "＋",
    bullets: ["Catalogue des examens et des packs", "Tarifs communiqués par les centres", "Rendez-vous selon les disponibilités du centre"],
  },
  prestations: {
    title: "Prestations à domicile", slogan: "Votre allié santé",
    description: "Découvrez les services proposés par des professionnels vérifiés.",
    route: "/prestations", color: "#D4402B", soft: "#FFEFEA", border: "#FAD0C6", icon: "⌂",
    bullets: ["Services et zones d’intervention", "Demandes de réservation", "Adresse protégée jusqu’à confirmation"],
  },
  suivi: {
    title: "Dispositifs médicaux", slogan: "Mon suivi santé connecté",
    description: "Un espace personnel pour enregistrer vos mesures, retrouver vos appareils et suivre l’évolution de vos données de santé, avec votre consentement.",
    route: "/suivi", color: "#1D4ED8", soft: "#EAF2FE", border: "#C7DAFB", icon: "＋",
    bullets: ["Ajoutez les appareils que vous utilisez au quotidien", "Saisissez, scannez ou synchronisez les mesures compatibles", "Consultez votre historique et partagez certaines données avec un professionnel vérifié"],
  },
  aide: {
    title: "Aide NAXA", slogan: "Nous sommes là pour vous guider",
    description: "Repères pour utiliser NAXA et accéder aux ressources utiles.",
    route: "/aide", color: "#0B7F85", soft: "#E6F7F6", border: "#BFE6E4", icon: "?",
    bullets: ["Comprendre les espaces NAXA", "Trouver les informations disponibles", "Accéder aux ressources d’urgence"],
  },
};

const universeOrder: UniverseKey[] = ["parapharmacie", "bebe-maman", "examens", "suivi", "prestations", "aide"];

export function UniverseLanding({ universe, comingSoon = false }: { universe: UniverseKey; comingSoon?: boolean }) {
  const item = universes[universe];
  return (
    <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-[#1F2937]">
      <div className="mx-auto max-w-5xl pt-4 sm:pt-6">
<div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 font-bold text-[#064B2A] transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#064B2A]" aria-label="Retour à l’accueil Pharmacie">
            <span aria-hidden="true">←</span> NAXA · Accueil
          </Link>
          <MenuUnivers />
        </div>

        <section className="mt-4 overflow-hidden rounded-3xl border bg-white shadow-sm" style={{ borderColor: item.border }}>
          <div className="p-6 sm:p-9" style={{ backgroundColor: item.soft }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm" style={{ color: item.color }} aria-hidden="true">{item.icon}</div>
              {comingSoon && universe !== "suivi" && <span className="inline-flex min-h-9 items-center rounded-full border border-white/80 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm">Bientôt disponible</span>}
            </div>
            <p className="mt-5 text-sm font-extrabold uppercase tracking-[0.12em]" style={{ color: item.color }}>{item.slogan}</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{item.title}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">{item.description}</p>
          </div>

          <div className="grid gap-6 p-5 sm:grid-cols-[1.1fr_0.9fr] sm:p-7">
            <section aria-labelledby="universe-features">
              <h2 id="universe-features" className="text-lg font-extrabold">Dans cet espace</h2>
              <ul className="mt-4 space-y-3">
                {item.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3 text-sm leading-6 text-slate-700">
                    <span className="mt-0.5 font-black" style={{ color: item.color }} aria-hidden="true">✓</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              {universe === "suivi" && (
                <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
                  <p className="font-extrabold">Vos données restent sous votre contrôle.</p>
                  <p className="mt-1">Les images illustrent les catégories d’appareils. Elles ne représentent pas une marque et ne garantissent pas la compatibilité de votre modèle.</p>
                  <Link href="/suivi" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 font-bold text-white hover:bg-blue-800">Ouvrir mon suivi santé</Link>
                </div>
              )}
              {universe === "aide" && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="font-extrabold text-red-900">Urgence médicale ?</p>
                  <p className="mt-1 text-sm leading-6 text-red-900">N’utilisez pas la messagerie NAXA pour une urgence. Contactez directement les services d’urgence locaux.</p>
                  <a href="tel:119" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-red-700 px-4 font-bold text-white transition hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">Appeler le 119</a>
                  <p className="mt-2 text-xs leading-5 text-red-800">La disponibilité et la couverture de ce numéro peuvent varier selon la zone.</p>
                </div>
              )}
            </section>

            <aside className="rounded-2xl border border-slate-200 bg-[#F8FAF9] p-4 sm:p-5" aria-labelledby="other-universes">
              <h2 id="other-universes" className="text-base font-extrabold">Explorer les espaces NAXA</h2>
              <p className="mt-1 text-sm leading-5 text-slate-600">Passez d’un univers à l’autre sans perdre votre chemin.</p>
              <nav className="mt-3 space-y-2" aria-label="Autres espaces NAXA">
                {universeOrder.filter((key) => key !== universe).map((key) => {
                  const other = universes[key];
                  return (
                    <Link key={key} href={other.route} className="flex min-h-11 items-center gap-3 rounded-xl border border-transparent bg-white px-3 py-2 text-sm font-bold transition hover:border-slate-200 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#064B2A]">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg" style={{ backgroundColor: other.soft, color: other.color }} aria-hidden="true">{other.icon}</span>
                      <span>{other.title}</span>
                      <span className="ml-auto text-slate-400" aria-hidden="true">›</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        </section>
        <p className="mx-auto mt-5 max-w-3xl px-2 text-center text-xs leading-5 text-slate-500">{universe === "suivi" ? "Les appareils sont des éléments de suivi personnel. NAXA ne vend pas ces appareils dans cet espace et ne pose aucun diagnostic." : "Les services affichés dépendent de leur activation et de la disponibilité des partenaires. NAXA ne confirme pas une réservation tant qu’une confirmation explicite n’a pas été fournie."}</p>
      </div>
    </main>
  );
}
