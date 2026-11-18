"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Question = { question: string; answer: string };
type FaqSection = { id: string; title: string; description: string; questions: Question[] };

const sections: FaqSection[] = [
  {
    id: "naxa",
    title: "Comprendre NAXA",
    description: "La plateforme, son rôle et les responsabilités de chacun",
    questions: [
      { question: "Qu’est-ce que NAXA ?", answer: "NAXA est une plateforme de mise en relation qui aide les Clients à découvrir les pharmacies, établissements et professionnels partenaires, leurs offres et les services qu’ils proposent." },
      { question: "NAXA est-elle une pharmacie ou un établissement de santé ?", answer: "Non. NAXA n’est ni une pharmacie ni un établissement de soins. Les produits, examens et prestations sont proposés et réalisés sous la responsabilité des établissements et professionnels concernés." },
      { question: "L’accès à l’espace Client est-il payant ?", answer: "Non. L’accès à l’espace Client NAXA est gratuit. Les produits et prestations éventuellement proposés restent soumis aux prix et conditions de l’établissement qui les fournit." },
      { question: "NAXA garantit-elle les informations publiées par les pharmacies ?", answer: "Non. Chaque pharmacie est responsable des fiches, prix, stocks, lots, disponibilités et informations qu’elle crée et publie. NAXA facilite leur visibilité et la mise en relation, sans certifier les déclarations des établissements." },
    ],
  },
  {
    id: "ecosystemes",
    title: "Les six espaces NAXA",
    description: "À quoi servent les écosystèmes et pourquoi certains sont connectés",
    questions: [
      { question: "Quels sont les six espaces proposés ?", answer: "Pharmacie, Parapharmacie, Bébé & Maman, Dispositifs connectés, Examens médicaux et Soins & Prestations à domicile." },
      { question: "À quoi sert l’espace Pharmacie ?", answer: "Il permet notamment de rechercher des pharmacies, consulter les offres publiées et découvrir les services proposés par les pharmacies partenaires." },
      { question: "À quoi sert l’espace Parapharmacie ?", answer: "Il regroupe les offres de parapharmacie publiées par les partenaires concernés, sous leur propre responsabilité." },
      { question: "Pourquoi Bébé & Maman est-il un espace connecté ?", answer: "Cet espace regroupe des offres liées à la maman et au bébé publiées par les propriétaires de stock Pharmacie ou Parapharmacie. Il ne constitue pas un écosystème professionnel autonome séparé." },
      { question: "Que signifie Dispositifs connectés ?", answer: "Cet espace concerne le suivi et les services associés aux dispositifs compatibles. Il ne s’agit pas d’un catalogue commercial autonome d’appareils." },
      { question: "Que trouve-t-on dans Examens médicaux et Soins à domicile ?", answer: "Ces espaces facilitent la découverte des examens proposés par les centres partenaires et des soins ou prestations à domicile proposés par les professionnels concernés. La disponibilité doit être confirmée auprès du prestataire." },
      { question: "Pourquoi un espace est-il visible mais verrouillé ?", answer: "Les six espaces restent visibles pour présenter l’offre NAXA. Leur accès dépend de leur activation effective. Si un espace est verrouillé, la notification affichée par NAXA indique que l’accès n’est pas disponible." },
    ],
  },
  {
    id: "recherche",
    title: "Recherche et offres",
    description: "Comprendre les prix, les stocks et les disponibilités affichés",
    questions: [
      { question: "Pourquoi un médicament apparaît-il sans prix ou sans disponibilité ?", answer: "Un médicament peut être présent dans le référentiel même si aucune pharmacie partenaire n’a publié de stock disponible. NAXA distingue les informations de référence des offres réelles des pharmacies." },
      { question: "Les prix et les stocks sont-ils garantis en temps réel ?", answer: "Les prix et quantités affichés proviennent des informations publiées par les pharmacies. Comme ils peuvent évoluer, confirme toujours le prix et la disponibilité auprès de la pharmacie avant de te déplacer." },
      { question: "Qui corrige une fiche produit incorrecte ?", answer: "La pharmacie qui a créé et publié la fiche est responsable de sa correction et de sa mise à jour. Tu peux également signaler à NAXA un problème d’affichage ou d’utilisation de la plateforme." },
    ],
  },
  {
    id: "commandes",
    title: "Commandes, paiements et livraisons",
    description: "Le rôle de la pharmacie et les parcours de réservation",
    questions: [
      { question: "Puis-je payer mes achats directement à NAXA ?", answer: "Non. L’espace Client ne réalise pas de transaction financière. Le paiement, le retrait et, le cas échéant, la livraison sont organisés directement avec la pharmacie ou le prestataire concerné." },
      { question: "Qui confirme une commande ou une disponibilité ?", answer: "La pharmacie ou l’établissement concerné confirme la disponibilité et les modalités de traitement. Une information affichée sur NAXA ne remplace pas cette confirmation." },
      { question: "Comment suivre mes réservations et commandes ?", answer: "Retrouve tes réservations et commandes dans les onglets correspondants de ton espace Client. Les informations visibles dépendent des événements transmis par l’établissement." },
    ],
  },
  {
    id: "compte",
    title: "Compte et sécurité",
    description: "Connexion, données personnelles et bonnes pratiques",
    questions: [
      { question: "Que faire si je n’arrive plus à me connecter ?", answer: "Vérifie l’adresse e-mail ou le numéro utilisé et les informations saisies. Utilise la procédure de récupération du mot de passe proposée sur l’écran de connexion. En cas de blocage persistant, écris à l’équipe NAXA." },
      { question: "Comment protéger mon compte ?", answer: "Ne partage jamais ton mot de passe ni un code de validation à usage unique. Évite d’envoyer des coordonnées bancaires ou des documents personnels dans les conversations d’assistance." },
      { question: "Comment signaler un problème de confidentialité ?", answer: "Ouvre une demande auprès de l’équipe NAXA en sélectionnant la catégorie « Confidentialité et données personnelles ». N’inclus pas de mot de passe ni de code OTP dans le message." },
    ],
  },
  {
    id: "assistance",
    title: "Assistance et contacts",
    description: "Choisir le bon interlocuteur et obtenir une réponse",
    questions: [
      { question: "Qui peut contacter directement l’assistance NAXA ?", answer: "Tous les Clients et tous les comptes professionnels actifs peuvent écrire individuellement à NAXA, quel que soit leur rôle ou leur écosystème : Promoteur, Responsable, Pharmacien, Gestionnaire de stock, Caissier, Comptable, Livreur ou autre professionnel autorisé. Il n’est pas nécessaire de passer par un Responsable ou un Promoteur." },
      { question: "Mon Responsable ou mon Promoteur peut-il lire mes conversations avec NAXA ?", answer: "Non. Chaque dossier est personnel au compte qui l’a ouvert. Les autres membres de la structure ne peuvent pas lire tes échanges ; seuls les agents NAXA autorisés à traiter l’assistance y ont accès." },
      { question: "Comment écrire directement à NAXA ?", answer: "Utilise le widget jaune canari d’assistance ou la page Assistance NAXA. Ton échange est enregistré dans un dossier avec un numéro de référence ; tu peux retrouver l’historique et les réponses dans ton espace." },
      { question: "Quand faut-il contacter une pharmacie plutôt que NAXA ?", answer: "Pour une question sur un prix, un stock, une disponibilité, un produit, un retrait ou une livraison propre à une pharmacie, contacte directement la pharmacie. NAXA traite les questions relatives à la plateforme et à ton compte." },
      { question: "Le widget est-il un service d’urgence médicale ?", answer: "Non. Le chat NAXA aide pour l’utilisation de la plateforme et le suivi des demandes. Il ne fournit aucun diagnostic et ne remplace pas les services d’urgence ou un professionnel de santé." },
      { question: "Que se passe-t-il si l’équipe NAXA n’est pas disponible ?", answer: "Tu peux tout de même laisser un message. Il est conservé dans ton dossier et tu peux revenir plus tard : les réponses apparaîtront dans la même conversation." },
    ],
  },
];

const allCount = sections.reduce((total, section) => total + section.questions.length, 0);

export function FaqInteractive() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("tout");
  const [expanded, setExpanded] = useState<string | null>(null);
  const normalized = query.trim().toLocaleLowerCase("fr-FR");

  const visibleSections = useMemo(() => sections
    .filter((section) => category === "tout" || section.id === category)
    .map((section) => ({
      ...section,
      questions: section.questions.filter((item) =>
        !normalized || (item.question + " " + item.answer).toLocaleLowerCase("fr-FR").includes(normalized),
      ),
    }))
    .filter((section) => section.questions.length > 0),
  [category, normalized]);

  const visibleCount = visibleSections.reduce((total, section) => total + section.questions.length, 0);

  return (
    <main className="min-h-screen bg-[#F7FAF8] px-4 pb-14 pt-[max(20px,env(safe-area-inset-top,0px))] text-slate-900">
      <div className="mx-auto w-full max-w-4xl">
        <header className="overflow-hidden rounded-3xl bg-[#064B2A] p-6 text-white shadow-sm sm:p-8">
          <Link href="/" className="inline-flex min-h-10 items-center rounded-full border border-white/30 px-3 text-sm font-semibold hover:bg-white/10">← Retour à NAXA</Link>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.18em] text-[#FFE23D]">NAXA · Centre d’aide</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Comment pouvons-nous t’aider ?</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">Clients et professionnels : retrouve les réponses aux questions fréquentes, puis écris directement à l’équipe NAXA si tu as besoin d’aide.</p>
          <label className="mt-6 flex min-h-12 items-center gap-3 rounded-xl bg-white px-4 text-[#123D28] shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setExpanded(null); }}
              type="search"
              placeholder="Rechercher une question ou un sujet…"
              aria-label="Rechercher dans les questions fréquentes"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
            {query && <button type="button" onClick={() => { setQuery(""); setExpanded(null); }} aria-label="Effacer la recherche" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xl">×</button>}
          </label>
          <p className="mt-2 text-xs text-white/70">{allCount} réponses disponibles · recherche par mot-clé</p>
        </header>

        <nav aria-label="Catégories de la FAQ" className="-mx-4 mt-4 overflow-x-auto bg-[#F7FAF8]/95 px-4 py-2">
          <div className="flex min-w-max gap-2">
            <button type="button" onClick={() => { setCategory("tout"); setExpanded(null); }} aria-pressed={category === "tout"} className={"min-h-10 rounded-full px-4 text-xs font-extrabold " + (category === "tout" ? "bg-[#064B2A] text-white" : "border border-emerald-100 bg-white text-[#064B2A]")}>Tout</button>
            {sections.map((section) => (
              <button key={section.id} type="button" onClick={() => { setCategory(section.id); setExpanded(null); }} aria-pressed={category === section.id} className={"min-h-10 rounded-full px-4 text-xs font-extrabold " + (category === section.id ? "bg-[#064B2A] text-white" : "border border-emerald-100 bg-white text-[#064B2A]")}>{section.title}</button>
            ))}
          </div>
        </nav>

        <div className="mt-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold text-[#064B2A]">{normalized || category !== "tout" ? "Résultats" : "Questions fréquentes"}</h2>
          <span className="text-xs text-slate-500">{visibleCount} question(s)</span>
        </div>

        {visibleSections.length === 0 ? (
          <section className="mt-3 rounded-2xl border border-dashed border-emerald-200 bg-white p-6 text-center">
            <p className="font-extrabold text-[#064B2A]">Aucune réponse trouvée</p>
            <p className="mt-1 text-sm text-slate-600">Essaie un autre mot-clé ou écris directement à l’équipe NAXA.</p>
            <Link href="/assistance" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#064B2A] px-4 text-sm font-bold text-white">Écrire à NAXA</Link>
          </section>
        ) : (
          <div className="mt-3 space-y-4">
            {visibleSections.map((section) => (
              <section key={section.id} className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
                <div className="border-b border-emerald-50 px-4 py-4 sm:px-5">
                  <h3 className="text-base font-extrabold text-[#064B2A]">{section.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{section.description}</p>
                </div>
                <div className="divide-y divide-slate-100 px-4 sm:px-5">
                  {section.questions.map((item, index) => {
                    const id = section.id + "-" + index;
                    const isOpen = expanded === id;
                    return (
                      <article key={item.question} className="py-1">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => setExpanded(isOpen ? null : id)}
                          className="flex min-h-12 w-full items-center justify-between gap-3 py-3 text-left text-sm font-bold text-slate-800"
                        >
                          <span>{item.question}</span>
                          <span className={"flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-lg font-normal text-[#0B633A] transition-transform " + (isOpen ? "rotate-45" : "")} aria-hidden="true">+</span>
                        </button>
                        {isOpen && <p className="max-w-3xl pb-4 pr-8 text-sm leading-6 text-slate-600">{item.answer}</p>}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <section className="mt-6 rounded-3xl border border-[#F4D94A] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#8A6C00]">Besoin d’une aide humaine ?</p>
          <h2 className="mt-2 text-xl font-black text-[#064B2A]">L’équipe NAXA est à ton écoute.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Pour une question sur NAXA, ton compte, ton espace professionnel ou un problème technique, utilise l’assistance directe. Pour un prix, un stock ou une disponibilité, écris à la pharmacie concernée.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link href="/assistance" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#064B2A] px-4 py-3 text-center text-sm font-extrabold text-white hover:bg-[#0A6B3A]">Écrire à l’assistance NAXA</Link>
            <Link href="/aide" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-emerald-800 px-4 py-3 text-center text-sm font-extrabold text-[#064B2A] hover:bg-emerald-50">Contacter une pharmacie</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
