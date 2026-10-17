"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { BoutonNotifications } from "@/components/BoutonNotifications";
import { IconeNAXA } from "@/components/IconeNAXA";

const actions = [
  { titre: "Accueil", description: "Page d’accueil", href: "/", mots: "accueil maison" },
  { titre: "Favoris", description: "Éléments enregistrés", href: "/client/profil/favoris", mots: "favoris favoris enregistrés cœur" },
  { titre: "Scanner une ordonnance", description: "Scanner un document", href: "/scanner", mots: "scanner ordonnance scan" },
  { titre: "Achats et commandes", description: "Historique et commandes", href: "/client?onglet=achats", mots: "achats commandes historique" },
  { titre: "Réservations et suivi", description: "État des réservations", href: "/client", mots: "réservations suivi statut" },
  { titre: "Profil client", description: "Coordonnées et paramètres", href: "/client/profil", mots: "profil compte coordonnées paramètres" },
  { titre: "Adresse", description: "Adresse de livraison", href: "/client/profil/adresse", mots: "adresse livraison localisation" },
  { titre: "Paiement", description: "Moyens de paiement", href: "/client/profil/paiement", mots: "paiement portefeuille momo" },
  { titre: "Langue", description: "Préférences linguistiques", href: "/client/profil/langue", mots: "langue français anglais" },
  { titre: "Factures", description: "Documents d’achat", href: "/client/profil/factures", mots: "facture reçu documents" },
  { titre: "Notifications", description: "Alertes et messages", href: "/notifications", mots: "notifications alertes cloche" },
  { titre: "Posologie et rappels", description: "Gérer les rappels prescrits", href: "/client/posologie", mots: "posologie rappels horaires prise traitement" },
  { titre: "Pharmacies de garde", description: "Pharmacies de garde proches", href: "/gardes", mots: "garde gardes pharmacies nuit" },
  { titre: "Parapharmacie", description: "Parapharmacie", href: "/resultats?q=Parapharmacie", mots: "parapharmacie soins" },
  { titre: "Bébé & maman", description: "Produits bébé et maternité", href: "/resultats?q=Bébé%20et%20maman", mots: "bébé maman maternité" },
  { titre: "Dispositifs médicaux", description: "Matériel et dispositifs", href: "/resultats?q=Dispositifs%20médicaux", mots: "dispositifs médicaux matériel" },
  { titre: "Examens médicaux", description: "Trouver un examen", href: "/resultats?q=Examens%20médicaux", mots: "examens analyses laboratoire" },
  { titre: "Soins à domicile", description: "Prestations et soins", href: "/resultats?q=Prestations%20et%20soins%20à%20domicile", mots: "soins domicile prestations" },
  { titre: "Besoin d’aide ?", description: "Contacter l’équipe NAXA", href: "mailto:naxa.home@gmail.com?subject=Besoin%20d%27aide%20sur%20NAXA", mots: "aide contact assistance support" },
];

const cle = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();

export function EnTeteClient() {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("naxa-recherche-navigation-recente-v1") || "[]");
      if (Array.isArray(saved)) setRecent(saved.filter((v): v is string => typeof v === "string").slice(0, 4));
    } catch {}
  }, []);

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

  const suggestions = useMemo(() => {
    const q = cle(query);
    if (q.length < 2) return [];
    return actions.filter(a => cle(a.titre + " " + a.description + " " + a.mots).includes(q)).slice(0, 4);
  }, [query]);

  function openAction(titre: string) {
    const next = [titre, ...recent.filter(x => x !== titre)].slice(0, 4);
    setRecent(next);
    try { localStorage.setItem("naxa-recherche-navigation-recente-v1", JSON.stringify(next)); } catch {}
    setSearchOpen(false);
    setMenuOpen(false);
    setQuery("");
  }

  return <header className="relative z-[1000] -mx-4 bg-[#0F6B3F] px-4 pb-4 pt-[max(12px,env(safe-area-inset-top,0px))] text-white">
    <div ref={wrapRef} className="mx-auto max-w-[480px]">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Logo clair taille={36}/>
          <p className="mt-0 text-[11px] font-semibold tracking-wide text-white/85">Votre médicament, à 2 minutes</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <BoutonNotifications/>
          <button type="button" aria-label={searchOpen ? "Fermer la recherche générale" : "Rechercher dans NAXA"} aria-expanded={searchOpen} onClick={() => { setSearchOpen(v => !v); setMenuOpen(false); }} data-naxa-client-search className="flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFE23D]"><IconeNAXA name="search" size={22}/></button>
          <button type="button" aria-label={menuOpen ? "Fermer le menu" : "Autres services"} aria-expanded={menuOpen} onClick={() => { setMenuOpen(v => !v); setSearchOpen(false); }} data-naxa-client-menu className="flex h-10 w-9 items-center justify-center rounded-full text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFE23D]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
          </button>
        </div>
      </div>

      {searchOpen && <div data-naxa-client-search className="relative z-[1002] mt-3">
        <form onSubmit={e => { e.preventDefault(); if (suggestions[0]) { const action = suggestions[0]; openAction(action.titre); if (action.href.startsWith("mailto:")) window.location.href = action.href; else router.push(action.href); } }} className="flex items-center gap-1.5 rounded-2xl bg-white p-1.5 shadow-lg">
          <IconeNAXA name="search" size={19} className="ml-2 shrink-0 text-[#0F6B3F]"/>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une option ou fonction…" aria-label="Recherche générale dans NAXA" className="h-11 min-w-0 flex-1 bg-transparent text-sm text-[#0B3D26] outline-none placeholder:text-slate-500"/>
          {query && <button type="button" aria-label="Effacer la recherche" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1F5F2] text-[#0B3D26]"><span aria-hidden="true" className="text-xl leading-none">×</span></button>}
        </form>
        <div className="mt-2 overflow-hidden rounded-2xl border border-white/15 bg-[#0B3D26] p-2 text-white shadow-xl">
          <p className="px-3 pb-1 pt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/65">{query.trim().length >= 2 ? "Suggestions" : "Récemment utilisés"}</p>
          {query.trim().length >= 2 ? suggestions.map(a => <Link key={a.titre} href={a.href} onClick={event => { event.preventDefault(); openAction(a.titre); if (a.href.startsWith("mailto:")) window.location.href = a.href; else router.push(a.href); }} className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-bold text-white hover:bg-white/10"><span><span className="block">{a.titre}</span><span className="block text-xs font-normal text-white/70">{a.description}</span></span><span aria-hidden="true">›</span></Link>) : (recent.length ? actions.filter(a => recent.includes(a.titre)).sort((a,b) => recent.indexOf(a.titre)-recent.indexOf(b.titre)) : actions.filter(a => ["Accueil","Favoris","Scanner une ordonnance","Achats et commandes"].includes(a.titre))).slice(0,4).map(a => <Link key={a.titre} href={a.href} onClick={event => { event.preventDefault(); openAction(a.titre); if (a.href.startsWith("mailto:")) window.location.href = a.href; else router.push(a.href); }} className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-bold text-white hover:bg-white/10"><span>{a.titre}</span><span aria-hidden="true">›</span></Link>)}
          {query.trim().length >= 2 && suggestions.length === 0 && <p className="px-3 py-3 text-sm text-white/75">Aucune option trouvée. Essayez un autre terme.</p>}
        </div>
      </div>}

      {menuOpen && <nav data-naxa-client-menu aria-label="Autres services NAXA" className="absolute right-4 top-[calc(100%-8px)] z-[1003] w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/15 bg-[#0B3D26] p-2 text-white shadow-2xl">
        {actions.filter(a => ["Parapharmacie","Bébé & maman","Dispositifs médicaux","Examens médicaux","Soins à domicile","Besoin d’aide ?"].includes(a.titre)).map(a => <Link key={a.titre} href={a.href} onClick={() => openAction(a.titre)} className={a.titre==="Besoin d’aide ?" ? "mt-1 flex min-h-11 items-center rounded-xl border-t border-white/20 px-3 py-2 text-sm font-extrabold text-[#B3123F] hover:bg-white/10" : "flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-bold text-white hover:bg-white/10"}>{a.titre}</Link>)}
      </nav>}
    </div>
  </header>;
}
