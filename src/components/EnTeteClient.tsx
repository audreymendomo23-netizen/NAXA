"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { BoutonNotifications } from "@/components/BoutonNotifications";
import { IconeNAXA } from "@/components/IconeNAXA";
import { BoutonPanierEntete } from "@/components/BoutonPanierEntete";
import { notifierNAXA } from "@/components/NotificationGlobale";
import {
  ECOSYSTEMES,
  ECOSYSTEME_PAR_ID,
  enregistrerEcosystemeSelectionne,
  ecosystemeDepuisChemin,
} from "@/lib/ecosystemes";

const actions = [
  { titre: "Accueil", description: "Espace client", href: "/client", mots: "accueil maison espace client" },
  { titre: "Favoris", description: "Éléments enregistrés", href: "/client/profil/favoris", mots: "favoris favoris enregistrés cœur" },
  { titre: "Apparence", description: "Préférences d’affichage", href: "/client/profil/apparence", mots: "apparence mode sombre clair écran" },
  { titre: "Scanner une ordonnance", description: "Scanner un document", href: "/scanner", mots: "scanner ordonnance scan" },
  { titre: "Achats et commandes", description: "Historique et commandes", href: "/client?onglet=achats", mots: "achats commandes historique" },
  { titre: "Réservations et suivi", description: "État des réservations", href: "/client", mots: "réservations suivi statut" },
  { titre: "Profil client", description: "Coordonnées et paramètres", href: "/client/profil", mots: "profil compte coordonnées paramètres" },
  { titre: "Adresse", description: "Adresse de livraison", href: "/client/profil/adresse", mots: "adresse livraison localisation" },
  { titre: "Paiement", description: "Moyens de paiement", href: "/client/profil/paiement", mots: "paiement portefeuille momo" },
  { titre: "Langue", description: "Préférences linguistiques", href: "/client/profil/langue", mots: "langue français anglais" },
  { titre: "Factures", description: "Documents d’achat", href: "/client/profil/factures", mots: "facture reçu documents" },
  { titre: "Notifications", description: "Alertes et messages", href: "/notifications", mots: "notifications alertes cloche" },
  { titre: "Centre d’aide", description: "Trouver de l’assistance", href: "mailto:naxa.home@gmail.com?subject=Centre%20d%27aide%20NAXA", mots: "centre aide assistance support" },
  { titre: "Contacter NAXA", description: "Écrire à l’équipe", href: "mailto:naxa.home@gmail.com?subject=Contact%20NAXA", mots: "contact équipe email écrire" },
  { titre: "Confidentialité", description: "Gérer vos demandes de confidentialité", href: "/client/profil/confidentialite", mots: "confidentialité données vie privée" },
  { titre: "Suppression du compte", description: "Options de suppression du compte", href: "/client/profil/suppression", mots: "suppression compte effacer données" },
  { titre: "Noter l’application", description: "Envoyer votre avis sur NAXA", href: "mailto:naxa.home@gmail.com?subject=Avis%20sur%20NAXA", mots: "noter application avis évaluation" },
  { titre: "Posologie et rappels", description: "Gérer les rappels prescrits", href: "/client/posologie", mots: "posologie rappels horaires prise traitement" },
  { titre: "Pharmacies de garde", description: "Pharmacies de garde proches", href: "/gardes", mots: "garde gardes pharmacies nuit" },
  { titre: "Parapharmacie", description: "Parapharmacie", href: "/parapharmacie", mots: "parapharmacie soins" },
  { titre: "Bébé & maman", description: "Produits bébé et maternité", href: "/bebe-maman", mots: "bébé maman maternité" },
  { titre: "Dispositifs médicaux", description: "Matériel et dispositifs", href: "/suivi", mots: "dispositifs médicaux matériel" },
  { titre: "Examens médicaux", description: "Trouver un examen", href: "/examens", mots: "examens analyses laboratoire" },
  { titre: "Prestations / Soins à domicile", description: "Prestations et soins", href: "/prestations", mots: "prestations soins domicile" },
  { titre: "Besoin d’aide ?", description: "Contacter l’équipe NAXA", href: "/aide", mots: "aide contact assistance support" },
];

const cle = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();

function CadenasVerrouille() {
  return (
    <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-100/25 bg-gradient-to-br from-white/15 to-white/5 text-[#FFE38A] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
      <svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7.5 10V7.4a4.5 4.5 0 0 1 9 0V10" />
        <rect x="5.5" y="10" width="13" height="10.5" rx="2.4" />
        <circle cx="12" cy="14.2" r="1.15" fill="currentColor" stroke="none" />
        <path d="M12 15.5v1.5" />
      </svg>
    </span>
  );
}

export function EnTeteClient() {
  const router = useRouter();
  const pathname = usePathname();
  const ecosystemeActif = ecosystemeDepuisChemin(pathname);
  const themeEcosysteme = ECOSYSTEME_PAR_ID[ecosystemeActif];
  const universesMenu = ECOSYSTEMES.filter((item) => item.id !== ecosystemeActif);
  const headerScene = pathname.includes("profil") || pathname.includes("messages") || pathname.includes("posologie")
    ? { image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1600&q=80", position: "center 42%" }
    : pathname.includes("reservation") || pathname.includes("univers-reservation")
      ? { image: "https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=1600&q=80", position: "center 52%" }
      : pathname.includes("panier") || pathname.includes("achats") || pathname.includes("historique") || pathname.includes("client")
        ? { image: "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=1600&q=80", position: "center 48%" }
        : pathname.includes("scanner")
          ? { image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1600&q=80", position: "center 45%" }
          : { image: "https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=1600&q=80", position: "center 50%" };
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [universesAvailability, setUniversesAvailability] = useState<Record<string, boolean>>({ pharmacie: true });
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchOpen && !menuOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest("[data-naxa-client-search]") && !event.target.closest("[data-naxa-client-menu]")) {
        setSearchOpen(false);
        setMenuOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSearchOpen(false); setMenuOpen(false); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [searchOpen, menuOpen]);

  useEffect(() => { if (searchOpen) requestAnimationFrame(() => inputRef.current?.focus()); }, [searchOpen]);

  useEffect(() => {
    let active = true;
    void fetch("/api/universes/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("universe_status");
        return response.json() as Promise<{ universes?: Record<string, boolean> }>;
      })
      .then((result) => {
        if (active) setUniversesAvailability({ pharmacie: true, ...(result.universes ?? {}) });
      })
      .catch(() => {
        if (active) setUniversesAvailability({ pharmacie: true });
      });
    return () => { active = false; };
  }, []);

  const suggestions = useMemo(() => {
    const q = cle(query);
    if (q.length < 2) return [];
    return actions.filter(a => cle(a.titre + " " + a.description + " " + a.mots).includes(q)).slice(0, 4);
  }, [query]);

  function closeSearchAndMenu() {
    setSearchOpen(false);
    setMenuOpen(false);
    setQuery("");
  }

  function ouvrirAction(href: string) {
    closeSearchAndMenu();
    const chemin = href.split("?")[0];
    if (chemin === "/aide") {
      notifierNAXA("Pour une urgence médicale, contactez directement les services d’urgence locaux.");
      return;
    }
    if (href.startsWith("mailto:")) { window.location.href = href; return; }
    const target = ECOSYSTEMES.find((item) => item.href === chemin);
    if (target && universesAvailability[target.id] !== true) {
      notifierNAXA("Cet écosystème est actuellement verrouillé par l’administration NAXA.");
      return;
    }
    if (target) enregistrerEcosystemeSelectionne(target.id);
    router.push(href);
  }

  return <header data-naxa-ecosysteme={ecosystemeActif} className="naxa-green-header sticky top-0 z-50 isolate min-h-[104px] overflow-visible px-4 pb-2 pt-[max(12px,env(safe-area-inset-top,0px))] text-white transition-colors duration-500" style={{ backgroundColor: themeEcosysteme.color }}>
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" style={{ backgroundColor: themeEcosysteme.color }}>
      <div className="absolute inset-0 bg-cover bg-center transition-[background-image] duration-500" style={{ backgroundImage: `url("${headerScene.image}")`, backgroundPosition: headerScene.position }} />
      <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(90deg, ${themeEcosysteme.color}F2, ${themeEcosysteme.color}D9 58%, ${themeEcosysteme.color}C9)` }} />
      <div className="absolute inset-0" style={{ backgroundColor: themeEcosysteme.color, opacity: 0.12 }} />
    </div>
    <div ref={wrapRef} className="mx-auto max-w-[480px]">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Logo clair taille={38}/>
          <p className="mt-0 text-[11px] font-semibold tracking-wide text-white/85">{themeEcosysteme.tagline}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {(ecosystemeActif === "pharmacie" || ecosystemeActif === "parapharmacie" || ecosystemeActif === "bebe-maman") && <BoutonPanierEntete/>}
          <BoutonNotifications/>
          <button type="button" aria-label={searchOpen ? "Fermer la recherche générale" : "Rechercher dans NAXA"} aria-expanded={searchOpen} onClick={() => { setSearchOpen(v => !v); setMenuOpen(false); }} data-naxa-client-search className="flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFE23D]"><IconeNAXA name="search" size={22}/></button>
          <button type="button" aria-label={menuOpen ? "Fermer le menu" : "Autres services"} aria-expanded={menuOpen} onClick={() => { setMenuOpen(v => !v); setSearchOpen(false); }} data-naxa-client-menu className="flex h-10 w-9 items-center justify-center rounded-full text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFE23D]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
          </button>
        </div>
      </div>

      {searchOpen && <div data-naxa-client-search className="relative z-[1002] mt-3">
        <form onSubmit={e => { e.preventDefault(); if (suggestions[0]) ouvrirAction(suggestions[0].href); }} className="flex items-center gap-1.5 rounded-2xl bg-white p-1.5 shadow-lg">
          <IconeNAXA name="search" size={19} className="ml-2 shrink-0 text-[#0F6B3F]"/>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une option ou fonction…" aria-label="Recherche générale dans NAXA" className="h-11 min-w-0 flex-1 bg-transparent text-sm text-[#0B3D26] outline-none placeholder:text-slate-500"/>
          <button type="button" aria-label="Fermer la zone de recherche" title="Fermer la recherche" onClick={() => { setSearchOpen(false); setQuery(""); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1F5F2] text-[#0B3D26]"><span aria-hidden="true" className="text-xl leading-none">×</span></button>
        </form>
        {query.trim().length >= 2 && <div className="mt-2 overflow-hidden rounded-2xl border border-white/15 bg-[#0B3D26] p-2 text-white shadow-xl">
          <p className="px-3 pb-1 pt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/65">Suggestions</p>
          {suggestions.map(a => <Link key={a.titre} href={a.href} onClick={event => { event.preventDefault(); ouvrirAction(a.href); }} className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-bold text-white hover:bg-white/10"><span><span className="block">{a.titre}</span><span className="block text-xs font-normal text-white/70">{a.description}</span></span><span aria-hidden="true">›</span></Link>)}
          {suggestions.length === 0 && <p className="px-3 py-3 text-sm text-white/75">Aucune option trouvée. Essayez un autre terme.</p>}
        </div>}
      </div>}

      {menuOpen && <nav data-naxa-client-menu aria-label="Changer d’écosystème" className="absolute right-4 top-[calc(100%-8px)] z-[1003] w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/20 p-2 text-white shadow-2xl" style={{ backgroundColor: themeEcosysteme.color }}>
        <p className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/70">Changer d’écosystème</p>
        {universesMenu.map((item) => {
          const enabled = universesAvailability[item.id] === true;
          const commonClass = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-white transition";
          const contents = (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg font-black" style={{ color: item.color, backgroundColor: item.softColor }}>{item.symbol}</span>
              <span className="min-w-0 flex-1">{item.label}</span>
              {enabled ? <IconeNAXA name="chevron-right" size={17}/> : <CadenasVerrouille />}
            </>
          );
          return enabled ? (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => {
                closeSearchAndMenu();
                enregistrerEcosystemeSelectionne(item.id);
              }}
              className={commonClass + " hover:bg-white/15 focus-visible:outline focus-visible:outline-2"}
              style={{ outlineColor: themeEcosysteme.accent }}
            >
              {contents}
            </Link>
          ) : (
            <button key={item.id} type="button" disabled className={commonClass + " cursor-not-allowed opacity-60"} aria-disabled="true">
              {contents}
            </button>
          );
        })}
        <button type="button" onClick={() => ouvrirAction("/aide")} className="mt-1 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border-t border-white/20 px-3 py-3 text-left text-sm font-extrabold text-white transition hover:bg-white/10">
          <span>Besoin d’aide ?</span>
          <IconeNAXA name="chevron-right" size={17}/>
        </button>
      </nav>}
    </div>
  </header>;
}
