import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ NAXA — Questions fréquentes",
  description: "Réponses aux questions fréquentes sur les six espaces, les services et les parcours Client de NAXA.",
};

const sections = [
  {
    title: "NAXA et les six espaces",
    items: [
      { question: "Quels sont les six espaces proposés par NAXA ?", answer: "Pharmacie, Parapharmacie, Bébé & Maman, Dispositifs connectés, Examens médicaux et Soins & Prestations à domicile." },
      { question: "Pourquoi Bébé & Maman et Dispositifs connectés sont-ils des espaces connectés ?", answer: "Ce sont des parcours complémentaires reliés aux autres espaces. Bébé & Maman regroupe des offres publiées par les propriétaires de stock Pharmacie ou Parapharmacie. Dispositifs connectés concerne le suivi connecté ; ce n’est pas un catalogue commercial autonome d’appareils." },
      { question: "Pourquoi un espace reste-t-il visible mais verrouillé ?", answer: "Les six espaces restent visibles afin que chacun puisse comprendre l’offre NAXA. Leur ouverture dépend toutefois de leur activation effective par l’administration. La visibilité d’une carte ne signifie pas que l’accès est autorisé." },
    ],
  },
  {
    title: "Compte, offres et paiements",
    items: [
      { question: "L’accès Client NAXA est-il payant ?", answer: "Non. L’accès à l’espace Client NAXA est gratuit. Les prix des produits, examens ou prestations sont ceux communiqués par l’établissement qui propose le service." },
      { question: "NAXA encaisse-t-elle le paiement d’une commande dans l’espace Client ?", answer: "Non. L’espace Client NAXA ne réalise pas de transaction financière. Les modalités de paiement, la disponibilité et la livraison sont traitées directement avec la pharmacie ou la structure concernée." },
      { question: "Qui est responsable des fiches, des prix et des stocks publiés ?", answer: "Chaque pharmacie ou partenaire reste responsable des informations qu’il publie et de son stock. NAXA met les offres en relation et les affiche ; elle ne certifie pas les fiches déclarées par les établissements." },
    ],
  },
  {
    title: "Assistance",
    items: [
      { question: "Comment poser une question à une pharmacie ?", answer: "L’espace d’assistance permet d’envoyer une question écrite à une pharmacie du répertoire. Les réponses dépendent de la disponibilité de son équipe et ne sont pas instantanées." },
      { question: "Le chat remplace-t-il un diagnostic ou une urgence médicale ?", answer: "Non. Ce canal ne fournit pas de diagnostic et ne remplace pas un examen médical. En cas d’urgence, contactez immédiatement les services d’urgence locaux." },
    ],
  },
];

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-[#F7FAF8] px-4 pb-12 pt-[max(24px,env(safe-area-inset-top,0px))] text-slate-900">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 rounded-3xl bg-[#064B2A] p-6 text-white shadow-sm sm:p-8">
          <Link href="/" className="inline-flex min-h-10 items-center rounded-full border border-white/30 px-3 text-sm font-semibold hover:bg-white/10">← Retour à NAXA</Link>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.18em] text-[#FFE23D]">Centre d’information NAXA</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Questions fréquentes</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">Retrouvez les réponses essentielles sur les six espaces NAXA, leur fonctionnement et l’assistance Client.</p>
        </header>
        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-3 text-lg font-extrabold text-[#064B2A]">{section.title}</h2>
              <div className="divide-y divide-slate-100">
                {section.items.map((item) => (
                  <details key={item.question} className="group py-3">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-bold text-slate-800 marker:hidden">
                      <span>{item.question}</span><span aria-hidden="true" className="shrink-0 text-xl text-[#0B7378] transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="max-w-2xl pb-2 pr-7 text-sm leading-6 text-slate-600">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
        <section className="mt-6 rounded-2xl border border-[#FFE23D] bg-white p-5">
          <h2 className="text-lg font-extrabold text-[#064B2A]">Besoin d’une aide humaine ?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Pour poser une question écrite à une pharmacie, ouvrez l’espace d’assistance dédié.</p>
          <Link href="/aide" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#064B2A] px-4 py-2 text-sm font-bold text-white hover:bg-[#0A6B3A]">Parler à une pharmacie</Link>
        </section>
      </div>
    </main>
  );
}
