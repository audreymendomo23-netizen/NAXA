"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { IconeNAXA } from "@/components/IconeNAXA";
import { BoutonNotifications } from "@/components/BoutonNotifications";
import { Logo } from "@/components/Logo";
import { supabaseBrowser } from "@/lib/supabase/client";
import { usePanier } from "@/lib/panier";
import { BoutonPanierEntete } from "@/components/BoutonPanierEntete";
import { BoutonTheme } from "@/components/BoutonTheme";
import { notifierNAXA } from "@/components/NotificationGlobale";
import { basculerFavori, ecouterFavoris, lireFavoris } from "@/lib/favoris-client";
import { normaliserRecherche, suggestionsMedicaments } from "@/lib/accueil-textes";
import CartePharmaciesProches from "@/components/CartePharmaciesProches";

type Produit = {
  id: string;
  nom: string;
  dosage: string;
  photo_url: string | null;
  prix: number;
  quantite: number;
  pharmacie_id: string | null;
  pharmacie: string;
  distanceKm: number | null;
  pharmacieLat?: number | null;
  pharmacieLng?: number | null;
  laboratoire: string;
  conditionnement: string;
  ordonnance: boolean;
  demo?: boolean;
};
type Pharmacie = {
  id: string; nom: string; ville: string | null; quartier: string | null;
  adresse: string | null; lat: number | null; lng: number | null; de_garde: boolean; photo_url: string | null; photo_verified_at: string | null;
};
type GardeAuto = { id: string; nom: string; quartier: string | null; telephone: string | null; autresTelephones: string[]; imageUrl: string | null; periode: string | null; source: string };
type StockRow = {
  produit_id: string; pharmacie_id: string; prix: number; quantite: number;
  date_peremption: string | null;
  pharmacies: { id: string; nom: string; ville: string | null; quartier: string | null; lat: number | null; lng: number | null; actif: boolean; de_garde: boolean } | null;
};
const fcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/\u202f/g, "\u00a0") + " FCFA";

const rechercheNavigation = [
  { titre: "Accueil", description: "Page d’accueil", href: "/", mots: "accueil maison" },
  { titre: "Favoris", description: "Médicaments enregistrés", href: "/client/profil/favoris", mots: "favoris enregistrés coeur" },
  { titre: "Scanner une ordonnance", description: "Scanner un document", href: "/scanner", mots: "scanner ordonnance scan" },
  { titre: "Achats et commandes", description: "Historique et commandes", href: "/client?onglet=achats", mots: "achats commandes historique" },
  { titre: "Réservations et suivi", description: "État des réservations", href: "/client", mots: "réservations suivi statut" },
  { titre: "Profil client", description: "Coordonnées et paramètres", href: "/client/profil", mots: "profil compte coordonnées paramètres" },
  { titre: "Adresse", description: "Adresse et localisation", href: "/client/profil/adresse", mots: "adresse localisation retrait pharmacie" },
  { titre: "Paiement", description: "Moyens de paiement", href: "/client/profil/paiement", mots: "paiement portefeuille momo" },
  { titre: "Langue", description: "Préférences linguistiques", href: "/client/profil/langue", mots: "langue français anglais" },
  { titre: "Factures", description: "Documents d’achat", href: "/client/profil/factures", mots: "facture reçu documents" },
  { titre: "Notifications", description: "Alertes et messages", href: "/notifications", mots: "notifications alertes cloche" },
  { titre: "Messages", description: "Conversations sauvegardées et classées par pharmacie", href: "/client/messages", mots: "messages messagerie conversation pharmacie écrire contacter archiver" },
  { titre: "Centre d’aide", description: "Trouver de l’assistance", href: "mailto:naxa.home@gmail.com?subject=Centre%20d%27aide%20NAXA", mots: "centre aide assistance support" },
  { titre: "Contacter NAXA", description: "Écrire à l’équipe", href: "mailto:naxa.home@gmail.com?subject=Contact%20NAXA", mots: "contact équipe email écrire" },
  { titre: "Confidentialité", description: "Gérer vos demandes de confidentialité", href: "/client/profil/confidentialite", mots: "confidentialité données vie privée" },
  { titre: "Suppression du compte", description: "Options de suppression du compte", href: "/client/profil/suppression", mots: "suppression compte effacer données" },
  { titre: "Noter l’application", description: "Envoyer votre avis sur NAXA", href: "mailto:naxa.home@gmail.com?subject=Avis%20sur%20NAXA", mots: "noter application avis évaluation" },
  { titre: "Posologie et rappels", description: "Gérer les rappels prescrits", href: "/client/posologie", mots: "posologie rappels horaires prise" },
  { titre: "Pharmacies de garde", description: "Pharmacies de garde proches", href: "/gardes", mots: "garde gardes pharmacies nuit" },
  { titre: "Parapharmacie", description: "Explorer l’univers parapharmacie", href: "/parapharmacie", mots: "parapharmacie soins" },
  { titre: "Bébé & maman", description: "Explorer l’univers bébé et maman", href: "/bebe-maman", mots: "bébé maman maternité" },
  { titre: "Dispositifs médicaux", description: "Suivi personnel gratuit et dispositifs", href: "/suivi", mots: "dispositifs médicaux matériel suivi connecté capteur" },
  { titre: "Examens médicaux", description: "Consulter les examens disponibles", href: "/examens", mots: "examens analyses laboratoire" },
  { titre: "Soins à domicile", description: "Consulter les prestations disponibles", href: "/prestations", mots: "soins domicile prestations" },
  { titre: "Besoin d’aide ?", description: "Contacter l’équipe NAXA", href: "mailto:naxa.home@gmail.com?subject=Besoin%20d%27aide%20sur%20NAXA", mots: "aide contact assistance support" },
];
const distance = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const rad = (v: number) => v * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
};
function LogoNAXA() {
  return <Logo clair taille={38} />;
}

function Blister() {
  return <svg viewBox="0 0 180 120" className="h-[88px] w-full" role="img" aria-label="Illustration d'une plaquette de comprimés">
    <g transform="translate(25 13) rotate(-8 65 45)">
      <rect x="22" y="9" width="108" height="78" rx="10" fill="#FFE23D" stroke="#D9BE31" strokeWidth="1.5"/>
      <rect x="10" y="19" width="108" height="78" rx="10" fill="#D8DEE0" stroke="#AAB5B8" strokeWidth="2"/>
      {[0,1,2,3].map((row) => [0,1,2].map((col) => <g key={row+"-"+col}>
        <ellipse cx={29+col*30} cy={35+row*16} rx="10" ry="6.5" fill="#A7B2B5" opacity=".45"/>
        <ellipse cx={27+col*30} cy={33+row*16} rx="10" ry="6.5" fill="#FBFCFA" stroke="#B7C0C2" strokeWidth="1.2"/>
        <ellipse cx={25+col*30} cy={31+row*16} rx="6" ry="3" fill="#FFFFFF" opacity=".9"/>
      </g>))}
    </g>
  </svg>;
}

function Squelette() {
  return <div className="animate-pulse rounded-[20px] bg-white p-3 shadow-sm" aria-label="Chargement des médicaments les plus recherchés">
    <div className="naxa-shimmer h-[124px] rounded-xl bg-[#E8EFEB]"/>
    <div className="mt-3 h-5 w-24 rounded-full bg-[#E8EFEB]"/>
    <div className="mt-3 h-5 w-4/5 rounded bg-[#E8EFEB]"/>
    <div className="mt-2 h-4 w-2/3 rounded bg-[#E8EFEB]"/>
    <div className="mt-4 h-6 w-1/2 rounded bg-[#E8EFEB]"/>
    <div className="mt-4 h-9 rounded-xl bg-[#E8EFEB]"/>
  </div>;
}

export function AccueilClient() {
  const router = useRouter();
  const { ajouter } = usePanier();
  const [query, setQuery] = useState("");
  const [suggestionsOuvertes, setSuggestionsOuvertes] = useState(false);
  const [suggestionsCatalogue, setSuggestionsCatalogue] = useState<string[]>([]);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [homeFilters, setHomeFilters] = useState({stock:true,distance:"",sort:"prix" as "prix"|"distance",ascending:true,open:false,prescription:false,price:""});
  const [homeFilterOpen, setHomeFilterOpen] = useState(false);
  const [firstName, setFirstName] = useState("Client");
  const [hourLocale, setHourLocale] = useState<number | null>(null);
  const [quartier, setQuartier] = useState("Douala");
  const [coord, setCoord] = useState<{lat:number;lng:number}|null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacie[]>([]);
  const [gardesAutomatiques, setGardesAutomatiques] = useState<GardeAuto[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [added, setAdded] = useState<string|null>(null);
  const [favoris, setFavoris] = useState<string[]>([]);
  const [menuServicesOuvert, setMenuServicesOuvert] = useState(false);
  const menuServicesRef = useRef<HTMLDivElement>(null);
  const [rechercheAppOuverte, setRechercheAppOuverte] = useState(false);
  const [rechercheAppTerme, setRechercheAppTerme] = useState("");
  const [rechercheAppVide, setRechercheAppVide] = useState(false);
  const rechercheAppRef = useRef<HTMLInputElement>(null);
  const [dictionnaireOuvert, setDictionnaireOuvert] = useState(false);
  const [termeMedical, setTermeMedical] = useState("");
  const [rechercheMedicale, setRechercheMedicale] = useState(false);
  const [resultatMedical, setResultatMedical] = useState<{terme:string;definition:string;source:string;sourceUrl:string;type:string|null;notice:string;imageUrl:string|null;imageAlt:string|null;imageSourceUrl:string|null;imageSource:string|null}|null>(null);
  const [erreurMedicale, setErreurMedicale] = useState("");
  const [suggestionsMedicales, setSuggestionsMedicales] = useState<string[]>([]);
  const [chargementSuggestionsMedicales, setChargementSuggestionsMedicales] = useState(false);
  const [langueDictionnaire, setLangueDictionnaire] = useState<"fr" | "en">("fr");
  const anglais = langueDictionnaire === "en";

  useEffect(() => { setHourLocale(new Date().getHours()); }, []);

  useEffect(() => {
    const synchroniserLangue = () => {
      let saved: string | null = null;
      try { saved = window.localStorage.getItem("naxa-langue"); } catch { /* Français par défaut. */ }
      setLangueDictionnaire(saved === "en" ? "en" : "fr");
    };
    synchroniserLangue();
    window.addEventListener("naxa-language-updated", synchroniserLangue);
    window.addEventListener("storage", synchroniserLangue);
    return () => {
      window.removeEventListener("naxa-language-updated", synchroniserLangue);
      window.removeEventListener("storage", synchroniserLangue);
    };
  }, []);

  useEffect(() => {
    if (!dictionnaireOuvert) return;
    const focus = window.requestAnimationFrame(() => document.getElementById("naxa-dictionnaire-search")?.focus());
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setDictionnaireOuvert(false); };
    document.addEventListener("keydown", escape);
    return () => { window.cancelAnimationFrame(focus); document.removeEventListener("keydown", escape); };
  }, [dictionnaireOuvert]);

  const chargerTermeMedical = async (termeSaisi: string) => {
    const terme = termeSaisi.trim();
    if (terme.length < 2) { setErreurMedicale(anglais ? "Enter at least two characters." : "Saisissez au moins deux caractères."); return; }
    setTermeMedical(terme);
    setSuggestionsMedicales([]);
    setRechercheMedicale(true);
    setErreurMedicale("");
    setResultatMedical(null);
    try {
      const response = await fetch("/api/dictionnaire-medical?q=" + encodeURIComponent(terme) + "&lang=" + langueDictionnaire, { headers: { Accept: "application/json" } });
      const data = await response.json() as { result?: { terme:string; definition:string; source:string; sourceUrl:string; type:string|null; notice:string; imageUrl:string|null; imageAlt:string|null; imageSourceUrl:string|null; imageSource:string|null }; error?:string };
      if (!response.ok || !data.result) throw new Error(data.error || (anglais ? "No reliable definition was found for this term." : "Aucune définition fiable n’a été trouvée pour ce terme."));
      setResultatMedical(data.result);
    } catch (error) {
      setErreurMedicale(error instanceof Error ? error.message : (anglais ? "Search is temporarily unavailable. Please try again." : "Recherche impossible pour le moment. Réessayez."));
    } finally {
      setRechercheMedicale(false);
    }
  };

  const rechercherTermeMedical = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void chargerTermeMedical(termeMedical);
  };

  useEffect(() => {
    const terme = termeMedical.trim();
    setSuggestionsMedicales([]);
    if (!dictionnaireOuvert || terme.length < 2 || resultatMedical) {
      setChargementSuggestionsMedicales(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setChargementSuggestionsMedicales(true);
      try {
        const response = await fetch(
          "/api/dictionnaire-medical?q=" + encodeURIComponent(terme) + "&lang=" + langueDictionnaire + "&suggest=1",
          { headers: { Accept: "application/json" }, signal: controller.signal }
        );
        if (!response.ok) return;
        const data = await response.json() as { suggestions?: string[] };
        if (!controller.signal.aborted) setSuggestionsMedicales((data.suggestions ?? []).slice(0, 3));
      } catch {
        // L’utilisateur peut toujours lancer une recherche complète.
      } finally {
        if (!controller.signal.aborted) setChargementSuggestionsMedicales(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [termeMedical, langueDictionnaire, dictionnaireOuvert, resultatMedical]);

  const suggestionsLocales = useMemo(() => {
    const terme = normaliserRecherche(query);
    if (terme.length < 2) return [];
    return suggestionsMedicaments.map(item => item.fr)
      .filter((nom, index, tous) => normaliserRecherche(nom).includes(terme) && tous.findIndex(x => normaliserRecherche(x) === normaliserRecherche(nom)) === index)
      .slice(0, 4);
  }, [query]);

  const suggestions = useMemo(() => {
    const vues = new Set<string>();
    return [...suggestionsLocales, ...suggestionsCatalogue].filter(nom => {
      const cle = normaliserRecherche(nom);
      if (!cle || vues.has(cle)) return false;
      vues.add(cle);
      return true;
    }).slice(0, 4);
  }, [suggestionsLocales, suggestionsCatalogue]);

  useEffect(() => {
    const terme = query.trim();
    setSuggestionsCatalogue([]);
    if (terme.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/medicaments/recherche?q=" + encodeURIComponent(terme), {signal:controller.signal});
        if (!response.ok) return;
        const data = await response.json() as {results?: Array<{name?:string}>};
        if (!controller.signal.aborted) setSuggestionsCatalogue((data.results ?? []).map(item => item.name).filter((name):name is string => typeof name === "string" && name.length > 0 && normaliserRecherche(name).startsWith(normaliserRecherche(terme))).slice(0,4));
      } catch { /* Les suggestions locales restent disponibles sans réseau. */ }
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  useEffect(() => {
    if (!suggestionsOuvertes) return;
    const outside = (event: PointerEvent) => {
      if (!searchWrapRef.current?.contains(event.target as Node)) setSuggestionsOuvertes(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setSuggestionsOuvertes(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [suggestionsOuvertes]);

  useEffect(() => {
    if (!rechercheAppOuverte) return;
    const id = window.requestAnimationFrame(() => rechercheAppRef.current?.focus());
    const fermerAvecEchap = (event: KeyboardEvent) => { if (event.key === "Escape") setRechercheAppOuverte(false); };
    const fermerAuClicExterieur = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest("[data-naxa-general-search]")) setRechercheAppOuverte(false);
    };
    document.addEventListener("keydown", fermerAvecEchap);
    document.addEventListener("pointerdown", fermerAuClicExterieur);
    return () => {
      window.cancelAnimationFrame(id);
      document.removeEventListener("keydown", fermerAvecEchap);
      document.removeEventListener("pointerdown", fermerAuClicExterieur);
    };
  }, [rechercheAppOuverte]);

  const suggestionsRechercheApp = useMemo(() => {
    const terme = normaliserRecherche(rechercheAppTerme);
    if (terme.length < 2) return [];
    return rechercheNavigation.filter(item => normaliserRecherche(item.titre + " " + item.description + " " + item.mots).includes(terme)).slice(0, 4);
  }, [rechercheAppTerme]);

  const ouvrirOptionRecherche = (href: string) => {
    setRechercheAppOuverte(false);
    setRechercheAppTerme("");
    setRechercheAppVide(false);
    const espaceCommercialIndisponible =
      href === "/parapharmacie" || href === "/bebe-maman" || href === "/examens" || href === "/prestations" || href === "/aide" ||
      (href.startsWith("/resultats?q=") && /parapharmacie|b[eé]b[eé]|b%[Cc]3%[Aa]b%[Cc]3%[Aa]|examens|prestations|soins%20[aà]%20domicile/i.test(href));
    const espaceAideIndisponible = href.startsWith("mailto:") && /subject=(Besoin|Centre|Contact)%20?d/i.test(href);
    if (espaceCommercialIndisponible || espaceAideIndisponible) {
      notifierNAXA("Cet espace n'est pas disponible actuellement");
      return;
    }
    if (href.startsWith("mailto:")) window.location.href = href;
    else router.push(href);
  };

  useEffect(() => {
    if (!menuServicesOuvert) return;
    const fermerSiExterieur = (event: PointerEvent) => {
      if (!menuServicesRef.current?.contains(event.target as Node)) setMenuServicesOuvert(false);
    };
    const fermerAvecEchap = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuServicesOuvert(false);
    };
    document.addEventListener("pointerdown", fermerSiExterieur, true);
    document.addEventListener("keydown", fermerAvecEchap);
    return () => {
      document.removeEventListener("pointerdown", fermerSiExterieur, true);
      document.removeEventListener("keydown", fermerAvecEchap);
    };
  }, [menuServicesOuvert]);

  useEffect(() => {
    const actualiser = () => setFavoris(lireFavoris().map(f => f.id));
    actualiser();
    return ecouterFavoris(actualiser);
  }, []);

  useEffect(() => {
    let active = true;
    const charger = async () => {
      try {
        const response = await fetch("/api/pharmacies/gardes", { cache: "no-store" });
        if (!response.ok) throw new Error("Liste de garde indisponible");
        const payload = await response.json() as { ok?: boolean; pharmacies?: GardeAuto[] };
        if (active && payload.ok && Array.isArray(payload.pharmacies)) setGardesAutomatiques(payload.pharmacies);
      } catch (error) {
        console.warn("[NAXA] Liste automatique des gardes indisponible", error);
      }
    };
    void charger();
    const interval = window.setInterval(() => { void charger(); }, 5 * 60 * 1000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("q");
    if (prefill) setQuery(prefill);
    let active = true;
    const sb = supabaseBrowser();
    void (async () => {
      try {
        // Charger les pharmacies indépendamment du catalogue : une erreur de classement
        // des produits ne doit jamais empêcher l'affichage des pharmacies de garde.
        try {
          const { data: pharmRows, error: pharmError } = await sb
            .from("pharmacies")
            .select("id,nom,ville,quartier,adresse,lat,lng,de_garde,photo_url,photo_verified_at")
            .eq("actif", true)
            .eq("visible_recherche", true)
            .is("archivee_le", null)
            .limit(100);
          if (pharmError) {
            console.error("[NAXA] Chargement des pharmacies impossible", pharmError);
          } else if (active) {
            setPharmacies((pharmRows ?? []) as Pharmacie[]);
          }
        } catch (pharmError) {
          console.error("[NAXA] Chargement des pharmacies impossible", pharmError);
        }
        const { data: { user } } = await sb.auth.getUser();
        if (!active) return;
        if (user) {
          const { data: profile } = await sb.from("profiles").select("username,first_name,last_name,avatar_url").eq("id", user.id).maybeSingle();
          const isGoogle = user.app_metadata?.provider === "google" || Boolean(user.identities?.some(identity => identity.provider === "google"));
          const googleName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : typeof user.user_metadata?.name === "string" ? user.user_metadata.name : "";
          const displayName = isGoogle && googleName.trim() ? googleName.trim() : typeof profile?.username === "string" && profile.username.trim() ? profile.username.trim() : [profile?.first_name,profile?.last_name].filter((value): value is string => typeof value === "string" && Boolean(value.trim())).join(" ") || "Client";
          setFirstName(displayName);
        }

        const { data: popularRows, error: popularError } = await sb.rpc("produits_populaires", { p_limit: 10, p_jours: 7 });
        if (popularError) throw popularError;
        // La RPC renvoie actuellement `id` (et non `produit_id`) pour chaque produit.
        // Accepter les deux noms évite que la liste soit vide quand le schéma de retour varie.
        const popularIds = ((popularRows ?? []) as Array<{ id?: string; produit_id?: string }>)
          .map((item) => item.produit_id ?? item.id)
          .filter((id): id is string => typeof id === "string" && id.length > 0);
        const productQuery = sb.from("produits").select("id,nom,dosage,forme,photo_url,fabricant,sur_ordonnance");
        const { data: ps, error: productError } = popularIds.length
          ? await productQuery.in("id", popularIds)
          : { data: [], error: null };
        if (productError) throw productError;
        const products = (ps ?? []) as Array<{id:string;nom:string;dosage:string;forme:string;photo_url:string|null;fabricant:string|null;sur_ordonnance:boolean}>;
        if (!products.length) {
          setProduits([]);
          setError(true);
        } else {
          const ids = products.map(p => p.id);
        const today = new Date().toISOString().slice(0,10);
        const { data: stockRows, error: stockError } = await sb.from("stocks").select("produit_id,pharmacie_id,prix,quantite,date_peremption,pharmacies(id,nom,ville,quartier,lat,lng,actif,de_garde)").in("produit_id", ids).gt("quantite",0).or(`date_peremption.is.null,date_peremption.gte.${today}`);
        if (stockError) throw stockError;
        const valid = ((stockRows ?? []) as unknown as StockRow[]).filter(s => s.pharmacies?.actif && Number(s.quantite)>0);
        const sorted = products.map(p => {
          const stocks = valid.filter(s => s.produit_id === p.id).sort((a,b) => Number(a.prix)-Number(b.prix));
          const chosen = stocks[0];
          const name = p.nom || "Médicament";
          return {
            id:p.id, nom:name, dosage:p.dosage||"", photo_url:p.photo_url, prix:Number(chosen?.prix ?? 0),
            quantite:Number(chosen?.quantite ?? 0), pharmacie_id:chosen?.pharmacie_id ?? null,
            pharmacie:chosen?.pharmacies?.nom ?? "Pharmacie partenaire",
            pharmacieLat:chosen?.pharmacies?.lat ?? null, pharmacieLng:chosen?.pharmacies?.lng ?? null,
            distanceKm: null,
            laboratoire:p.fabricant ?? "Laboratoire",
            conditionnement:p.forme ?? "Conditionnement non précisé",
            ordonnance:p.sur_ordonnance,
          } satisfies Produit;
        }).filter(p => p.quantite > 0).sort((a,b) => {
          if (popularIds.length) {
            const aRank = popularIds.indexOf(a.id);
            const bRank = popularIds.indexOf(b.id);
            return (aRank < 0 ? Number.MAX_SAFE_INTEGER : aRank) - (bRank < 0 ? Number.MAX_SAFE_INTEGER : bRank);
          }
          return a.nom.localeCompare(b.nom, "fr");
        }).slice(0,10);
        setProduits(sorted);
        if (!sorted.length) setError(true);
        }

      } catch {
        if (active) {
          setProduits([]);
          setError(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const pharmaciesProches = useMemo(() => pharmacies.map(p => ({
    ...p,
    distanceKm: coord && p.lat != null && p.lng != null ? distance(coord.lat,coord.lng,p.lat,p.lng) : null,
  })).filter(p => p.distanceKm === null || p.distanceKm <= 30).sort((a,b) => (a.distanceKm ?? 999)-(b.distanceKm ?? 999)), [pharmacies,coord]);
  const distanceProduit = (p: Produit) => coord && p.pharmacieLat != null && p.pharmacieLng != null ? distance(coord.lat,coord.lng,p.pharmacieLat,p.pharmacieLng) : p.distanceKm;
  const gardes: GardeAuto[] = gardesAutomatiques.length
    ? gardesAutomatiques.slice(0,4)
    : pharmaciesProches.filter(p => p.de_garde).slice(0,4).map(p => ({ id: p.id, nom: p.nom, quartier: p.quartier || p.ville, telephone: null, autresTelephones: [], imageUrl: p.photo_url && p.photo_verified_at && p.photo_url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pharmacies-photos/`) ? p.photo_url : null, periode: null, source: "NAXA" }));
  const nombreSlidesProduits = Math.ceil(produits.length / 2);
  const soumettre = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) return;
    const params = new URLSearchParams({q:query.trim(),stock:homeFilters.stock?"1":"0",sort:homeFilters.sort,asc:homeFilters.ascending?"1":"0"});
    if (homeFilters.distance) params.set("distance",homeFilters.distance);
    if (homeFilters.open) params.set("open","1");
    if (homeFilters.prescription) params.set("prescription","1");
    if (homeFilters.price) params.set("price",homeFilters.price);
    setSuggestionsOuvertes(false);
    router.push("/resultats?" + params.toString());
  };
  const choisirSuggestion = (nom:string) => {
    setQuery(nom);
    setSuggestionsOuvertes(false);
    const params = new URLSearchParams({q:nom,stock:homeFilters.stock?"1":"0",sort:homeFilters.sort,asc:homeFilters.ascending?"1":"0"});
    if (homeFilters.distance) params.set("distance",homeFilters.distance);
    if (homeFilters.open) params.set("open","1");
    if (homeFilters.prescription) params.set("prescription","1");
    if (homeFilters.price) params.set("price",homeFilters.price);
    router.push("/resultats?" + params.toString());
  };
  const localiser = useCallback(() => {
    if (!navigator.geolocation) { setQuartier("Douala"); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const point = {lat:pos.coords.latitude,lng:pos.coords.longitude};
      setCoord(point);
      // La ville/quartier affichés viennent d'une pharmacie partenaire géographiquement proche.
      const nearest = pharmacies.map(p => ({p,d:p.lat!=null&&p.lng!=null?distance(point.lat,point.lng,p.lat,p.lng):Infinity})).sort((a,b)=>a.d-b.d)[0];
      if (nearest && nearest.d < 15) setQuartier([nearest.p.quartier,nearest.p.ville].filter(Boolean).join(", ") || "Douala");
      else setQuartier("Douala");
    }, () => setQuartier("Douala"), {maximumAge:300000,timeout:8000});
  }, [pharmacies]);
  const pharmacyCount = pharmaciesProches.filter(p => p.distanceKm !== null && p.distanceKm <= 1.2).length;
  const toggleFavori = (p: Produit) => {
    const suivants = basculerFavori({ id: p.id, nom: p.nom, dosage: p.dosage, photo_url: p.photo_url, prix: p.prix, pharmacie: p.pharmacie, demo: !!p.demo });
    setFavoris(suivants.map(f => f.id));
    notifierNAXA(suivants.some(f => f.id === p.id) ? `${p.nom} ajouté aux favoris.` : `${p.nom} retiré des favoris.`);
  };
  const addToCart = (p:Produit, source?: HTMLElement) => {
    if (p.demo || !p.pharmacie_id) {
      notifierNAXA("La disponibilité réelle de ce médicament doit être confirmée auprès d’une pharmacie partenaire.");
      return;
    }
    if (p.ordonnance) { window.location.href = "/scanner"; return; }
    ajouter({produit_id:p.id,nom:p.nom,dosage:p.dosage},1,source?.getBoundingClientRect());
    setAdded(p.id);
    window.setTimeout(() => setAdded(current => current === p.id ? null : current),1200);
  };

  return <div className="naxa-home-shell min-h-dvh pb-[calc(92px+env(safe-area-inset-bottom,0px))] text-[#0B3D26]">
    <header className="naxa-green-header relative z-20 min-h-[104px] px-4 pb-2 pt-[max(12px,env(safe-area-inset-top,0px))] text-white">
      <div className="mx-auto flex max-w-[480px] items-center justify-between gap-3">
        <div className="min-w-0"><LogoNAXA/><p className="mt-0 text-[11px] font-semibold tracking-wide text-white/85">Votre médicament, à 2 minutes</p></div>
        <div className="flex items-center gap-1">
          <BoutonPanierEntete />
          <BoutonNotifications />
          <button type="button" aria-label={rechercheAppOuverte ? "Fermer la recherche générale" : "Rechercher dans NAXA"} title="Rechercher dans NAXA" aria-expanded={rechercheAppOuverte} aria-controls="recherche-generale-naxa" onClick={() => { setRechercheAppOuverte(v => !v); setRechercheAppVide(false); }} data-naxa-general-search className="relative flex h-11 w-11 items-center justify-center rounded-full text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFE23D]">
            <IconeNAXA name="search" size={23}/>
          </button>
          <div ref={menuServicesRef} className="relative">
            <button
              type="button"
              aria-label={menuServicesOuvert ? "Fermer les autres services" : "Autres services"}
              aria-expanded={menuServicesOuvert}
              aria-controls="menu-autres-services"
              onClick={() => setMenuServicesOuvert(value => !value)}
              className="flex h-11 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFE23D]"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>
              </svg>
            </button>
            {menuServicesOuvert && (
              <nav id="menu-autres-services" aria-label="Autres services NAXA" className="absolute right-[-1rem] top-full z-[1001] mt-2 w-64 max-w-[100vw] rounded-2xl border border-white/20 bg-[#0F6B3F] p-2 text-white shadow-2xl">
                {[
                  { label:"Parapharmacie", href:"/resultats?q=Parapharmacie", available:false },
                  { label:"Bébé & maman", href:"/resultats?q=B%C3%A9b%C3%A9%20%26%20maman", available:false },
                  { label:"Dispositifs médicaux", href:"/suivi", available:true },
                  { label:"Examens médicaux", href:"/resultats?q=Examens%20m%C3%A9dicaux", available:false },
                  { label:"Prestations et soins à domicile", href:"/resultats?q=Prestations%20et%20soins%20%C3%A0%20domicile", available:false },
                ].map((categorie) => (
                  categorie.available ? (
                    <Link
                      key={categorie.label}
                      href={categorie.href}
                      onClick={() => setMenuServicesOuvert(false)}
                      className="flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFE23D]"
                    >
                      <span>{categorie.label}</span><IconeNAXA name="chevron-right" size={17}/>
                    </Link>
                  ) : (
                    <button
                      key={categorie.label}
                      type="button"
                      onClick={() => { setMenuServicesOuvert(false); notifierNAXA("Cet espace n'est pas disponible actuellement"); }}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-white/90 transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFE23D]"
                    >
                      <span>{categorie.label}</span><IconeNAXA name="lock" size={16}/>
                    </button>
                  )
                ))}
                <button
                  type="button"
                  onClick={() => { setMenuServicesOuvert(false); notifierNAXA("Cet espace n'est pas disponible actuellement"); }}
                  className="mt-1 flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border-t border-white/20 px-3 py-3 text-left text-sm font-extrabold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFE23D]"
                >
                  <span className="flex items-center gap-2"><IconeNAXA name="bell" size={18}/>Besoin d'aide ?</span>
                  <IconeNAXA name="lock" size={16}/>
                </button>
              </nav>
            )}
          </div>
        </div>
      </div>
      {rechercheAppOuverte && <div data-naxa-general-search id="recherche-generale-naxa" className="relative z-[1002] mx-auto mt-3 max-w-[480px] pb-2">
        <form onSubmit={event => {
          event.preventDefault();
          if (rechercheAppTerme.trim().length < 2) return;
          if (suggestionsRechercheApp[0]) ouvrirOptionRecherche(suggestionsRechercheApp[0].href);
          else setRechercheAppVide(true);
        }} className="flex items-center gap-1.5 rounded-2xl border border-white/30 bg-white p-1.5 shadow-lg">
          <IconeNAXA name="search" size={20} className="ml-2 shrink-0 text-[#0F6B3F]"/>
          <input ref={rechercheAppRef} value={rechercheAppTerme} onChange={event => { setRechercheAppTerme(event.target.value); setRechercheAppVide(false); }} placeholder="Rechercher une option ou fonction…" aria-label="Recherche générale dans l’application" className="h-11 min-w-0 flex-1 bg-transparent text-sm text-[#0B3D26] outline-none placeholder:text-slate-500"/>
          <button type="button" aria-label="Fermer la zone de recherche" title="Fermer la recherche" onClick={() => { setRechercheAppOuverte(false); setRechercheAppTerme(""); setRechercheAppVide(false); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1F5F2] text-[#0B3D26]"><span aria-hidden="true" className="text-xl leading-none">×</span></button>
        </form>
        {rechercheAppTerme.trim().length >= 2 && <div className="mt-2 overflow-hidden rounded-2xl border border-white/20 bg-[#0B3D26] p-2 text-white shadow-xl">
          <p className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/70">Suggestions</p>
          {suggestionsRechercheApp.map(item => <Link key={item.titre} href={item.href} onClick={event => { event.preventDefault(); ouvrirOptionRecherche(item.href); }} className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFE23D]">
            <span className="min-w-0"><span className="block">{item.titre}</span><span className="block text-xs font-normal text-white/70">{item.description}</span></span><span aria-hidden="true" className="text-lg">›</span>
          </Link>)}
          {rechercheAppVide && <p role="status" className="px-3 py-3 text-sm text-white/80">Aucune option trouvée. Essayez un autre terme.</p>}
        </div>}
      </div>}
    </header>
    <main className="relative z-10 mx-auto w-full max-w-[480px] rounded-t-[24px] border-t border-white/80 bg-[#F4F8F5] px-4 pt-6 shadow-[0_-8px_24px_rgba(5,74,41,0.06)]">
      <div className="naxa-enter mb-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <BoutonTheme className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF3B0] text-[#0F6B3F] shadow-sm" />
          <h1 className="min-w-0 text-[clamp(20px,5.7vw,26px)] font-extrabold leading-tight tracking-[-0.035em] text-[#0B3D26]">{hourLocale !== null && (hourLocale >= 18 || hourLocale < 5) ? "Bonsoir" : "Bonjour"}, <span className="text-[#B18A00]">{firstName}</span> !</h1>
        </div>
        <p className="mt-2 text-[16px] font-bold leading-6 text-[#0F6B3F]">Quel médicament recherchez-vous aujourd'hui ?</p>
        <p className="mt-1 text-[13px] leading-5 text-[#53685C]">Livraison rapide par les pharmacies vérifiées</p>
      </div>

      <div ref={searchWrapRef} className="naxa-enter relative z-30 mb-3">
        <form onSubmit={soumettre} className="flex gap-2">
          <label className="group flex h-14 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#D8E5DC] bg-[#FBFDFC] px-4 shadow-sm transition focus-within:border-[#0F6B3F] focus-within:ring-4 focus-within:ring-[#0F6B3F]/10">
            <IconeNAXA name="search" size={21} className="shrink-0 text-[#0B3D26] transition-transform group-focus-within:scale-110"/>
            <input value={query} onFocus={()=>setSuggestionsOuvertes(true)} onChange={e=>{setQuery(e.target.value);setSuggestionsOuvertes(true)}} placeholder="Ex. Paracétamol, Coartem..." aria-label="Rechercher un médicament" aria-autocomplete="list" aria-expanded={suggestionsOuvertes&&query.trim().length>=2&&suggestions.length>0} className="min-w-0 flex-1 bg-transparent text-sm text-[#0B3D26] outline-none placeholder:text-[#7D8E84]"/>
          </label>
          <button type="submit" className="h-14 min-w-[92px] rounded-2xl bg-[#FFE23D] px-4 font-extrabold text-[#0B3D26] shadow-[0_6px_18px_rgba(255,226,61,0.25)]">Chercher</button>
        </form>
        {suggestionsOuvertes && query.trim().length>=2 && suggestions.length>0 && <ul role="listbox" aria-label="Suggestions de médicaments" className="absolute inset-x-0 top-[calc(100%+6px)] z-[120] overflow-hidden rounded-2xl border border-[#D8E5DC] bg-white py-1 shadow-2xl">
          {suggestions.map((nom,index)=><li key={normaliserRecherche(nom)}><button type="button" role="option" aria-selected="false" onClick={()=>choisirSuggestion(nom)} className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm font-semibold text-[#0B3D26] transition hover:bg-[#FFF5A8] focus:bg-[#FFF5A8]"><IconeNAXA name="search" size={17} className="shrink-0 text-[#0F6B3F]"/><span className="min-w-0 flex-1">{nom}</span><span className="text-[10px] font-bold text-[#7D8E84]">{index+1}/4</span></button></li>)}
        </ul>}
      </div>
      <div className="naxa-enter mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Filtres rapides">
        <button type="button" onClick={()=>setHomeFilters(v=>({...v,stock:!v.stock}))} aria-pressed={homeFilters.stock} className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#E6C900] px-3 text-xs font-extrabold ${homeFilters.stock?"bg-[#FFE23D] text-[#0B3D26]":"bg-[#FFF9C7] text-[#0B3D26]"}`}><IconeNAXA name="check-circle" size={14}/>Disponibilité</button>
        <button type="button" onClick={()=>setHomeFilters(v=>({...v,distance:v.distance===""?"5":v.distance==="5"?"10":""}))} aria-pressed={Boolean(homeFilters.distance)} className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#E6C900] px-3 text-xs font-extrabold ${homeFilters.distance?"bg-[#FFE23D] text-[#0B3D26]":"bg-[#FFF9C7] text-[#0B3D26]"}`}><IconeNAXA name="map-pin" size={14}/>{homeFilters.distance?`Distance · ${homeFilters.distance} km`:"Distance"}</button>
        <button type="button" onClick={()=>setHomeFilters(v=>v.sort==="prix"?({...v,ascending:!v.ascending}):({...v,sort:"prix",ascending:true}))} aria-pressed={homeFilters.sort==="prix"} className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#E6C900] px-3 text-xs font-extrabold ${homeFilters.sort==="prix"?"bg-[#FFE23D] text-[#0B3D26]":"bg-[#FFF9C7] text-[#0B3D26]"}`}>Prix {homeFilters.sort==="prix"?(homeFilters.ascending?"↑":"↓"):""}</button>
        <button type="button" onClick={()=>setHomeFilterOpen(true)} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#0F6B3F] bg-white px-3 text-xs font-extrabold text-[#0B3D26]"><IconeNAXA name="search" size={14}/>Filtres +</button>
      </div>

      <div className="naxa-enter mb-4">
        <Link href="/scanner" className="flex min-h-[76px] items-center gap-3 rounded-[24px] border-2 border-[#0F6B3F] px-4 py-3 transition active:scale-[0.99]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/60"><IconeNAXA name="lock" size={24}/></span>
          <span className="min-w-0"><strong className="block text-[18px] font-extrabold leading-6">Scanner mon ordonnance</strong><span className="mt-1 block text-[13px] leading-5 text-[#466455]">Votre ordonnance reste privée et traitée en local.</span></span>
        </Link>
      </div>

      <div className="naxa-enter mb-6">
        <CartePharmaciesProches pharmacies={pharmaciesProches} position={coord} onLocaliser={localiser} />
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-[22px] font-extrabold tracking-[-0.03em] text-[#0B3D26]">Les plus recherchés</h2>
        {loading ? <div className="grid grid-cols-2 gap-2.5"><Squelette/><Squelette/></div> : produits.length ? <div className="naxa-carousel-viewport overflow-hidden">
          <div className="naxa-carousel-loop flex w-max">{[false,true].map(copy => <div key={copy?"medicaments-copie":"medicaments-originaux"} aria-hidden={copy||undefined} className={`flex w-max shrink-0 ${copy ? "pointer-events-none" : ""}`}>{Array.from({ length: nombreSlidesProduits }, (_, slide) => produits.slice(slide * 2, slide * 2 + 2)).map((groupe, slide) => <div key={(copy?"copie-":"page-")+slide} className="naxa-reveal-list grid w-[calc(min(100vw,480px)-2rem)] shrink-0 grid-cols-2 gap-2.5">
              {groupe.map((p,i)=><article key={p.id} style={{"--reveal-index":i} as React.CSSProperties} className="naxa-enter relative flex min-w-0 flex-col rounded-[18px] bg-white p-2.5 shadow-[0_6px_18px_rgba(0,0,0,0.07)]">
            <Link href={p.demo?"/resultats?q="+encodeURIComponent(p.nom):"/produit/"+p.id} tabIndex={copy?-1:undefined} aria-label={`Voir ${p.nom}`} className="flex min-h-[88px] items-center justify-center overflow-hidden">
              {p.photo_url ? <Image src={p.photo_url} alt={p.nom} width={160} height={88} className="h-[88px] w-full object-contain" unoptimized/> : <Blister/>}
            </Link>
            <button type="button" tabIndex={copy?-1:undefined} onClick={() => toggleFavori(p)} aria-label={favoris.includes(p.id) ? `Retirer ${p.nom} des favoris` : `Ajouter ${p.nom} aux favoris`} aria-pressed={favoris.includes(p.id)} className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[#E6C900] bg-[#FFE23D] text-[#0B3D26] shadow-sm transition-transform active:scale-95">
              <IconeNAXA name="heart" size={19} filled={favoris.includes(p.id)} />
            </button>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.quantite > 0 && p.pharmacie_id && !p.demo && <span className="inline-flex min-h-6 items-center rounded-full bg-[#E1F4E7] px-2 py-1 text-[11px] font-extrabold leading-4 text-[#176B38]">Disponible</span>}
              {p.ordonnance && !p.demo && <span className="inline-flex min-h-6 items-center rounded-full bg-[#0F6B3F] px-2 py-1 text-[11px] font-extrabold leading-4 text-white">Sur ordonnance</span>}
              {p.demo && <span className="inline-flex min-h-6 items-center rounded-full bg-[#FFF3B0] px-2 py-1 text-[11px] font-extrabold leading-4 text-[#0B3D26]">Exemple</span>}
              {!p.demo && (!p.quantite || !p.pharmacie_id) && <span className="inline-flex min-h-6 items-center rounded-full bg-[#FFF3B0] px-2 py-1 text-[11px] font-extrabold leading-4 text-[#0B3D26]">Stock à confirmer</span>}
            </div>
            <h3 className="mt-1.5 line-clamp-2 min-h-10 text-[14px] font-extrabold leading-[18px] text-[#0B3D26]">{p.nom}</h3>
            <p className="min-h-8 text-[10px] leading-[14px] text-[#65766C]">{p.conditionnement} • {p.laboratoire}</p>
            <p className="mt-1 text-[15px] font-extrabold leading-5 text-[#0B3D26]">{p.prix?fcfa(p.prix):"Prix non disponible"}</p>
            <div className="mt-auto flex items-end justify-between gap-1 pt-3">
              <p className="min-w-0 text-[10px] leading-[14px] text-[#53685C]"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#218A4E]"/>{p.demo?"Donnée illustrative":p.quantite>0?"En stock":"Stock à confirmer"} • {p.pharmacie}{distanceProduit(p)!=null?`, ${distanceProduit(p)!.toFixed(1)} km`:""}</p>
              <button tabIndex={copy?-1:undefined} onClick={event=>addToCart(p,event.currentTarget)} disabled={p.quantite<=0} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-[#FFE23D] px-2 text-[11px] font-extrabold text-[#0B3D26] disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Ajouter ${p.nom} au panier`}>
                <IconeNAXA name="shopping-cart" size={14}/>{added===p.id?"Ajouté ✓":"Ajouter"}
              </button>
            </div>
              </article>)}
            </div>)}</div>)}</div>
        </div> : <p className="rounded-2xl bg-white px-4 py-5 text-sm leading-5 text-[#53685C]">Les recherches réelles des clients apparaîtront ici dès qu’elles seront disponibles.</p>}
        {error && <span className="sr-only" role="status">Aucun classement de recherches réelles disponible pour le moment.</span>}
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-[22px] font-extrabold tracking-[-0.03em] text-[#0B3D26]">Pharmacies de garde</h2>
        <div className="overflow-hidden rounded-[22px] border border-[#D7E7DC] bg-gradient-to-br from-white to-[#EDF7F0] shadow-[0_12px_28px_rgba(5,74,41,0.12)]">
          <div className="border-b border-[#E0EAE3] px-4 py-3">
            <h3 className="text-[17px] font-extrabold leading-5 text-[#0B3D26]">Pharmacies de garde proche de vous</h3>
            <p className="mt-1 text-xs font-medium text-[#64776B]">Liste externe actualisée automatiquement · période et numéros à confirmer par téléphone.</p>
          </div>
          {gardes.length ? <div className="naxa-carousel-viewport overflow-hidden">
            <div className="naxa-carousel-loop naxa-gardes-loop flex w-max">{[false,true].map(copy => <div key={copy?"gardes-copie":"gardes-originales"} aria-hidden={copy||undefined} className="flex w-[calc(min(100vw,480px)-2rem)] shrink-0 flex-col">
              {gardes.map((p) => copy ? <div key={p.id} className="pointer-events-none mx-3 my-2 flex min-h-[112px] w-[calc(100%-1.5rem)] items-center gap-3 rounded-[18px] border border-[#DDE3DE] bg-white px-3 py-3 shadow-[0_3px_12px_rgba(60,64,67,0.16)]">
                <span className="flex h-[64px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D9E2DC] bg-[#E7EFE5]">{p.imageUrl ? <img src={p.imageUrl} alt={`Pharmacie ${p.nom}`} loading="lazy" className="h-full w-full object-cover" /> : <span className="text-2xl text-[#0F6B3F]" aria-label="Photo non disponible">✚</span>}</span>
                <span className="min-w-0 flex-1"><strong className="block text-[16px] leading-5 text-[#0B3D26]">{p.nom}</strong><span className="mt-1 block text-[13px] text-[#64776B]">{p.quartier || "Yaoundé"}</span></span>
                <span className="shrink-0 rounded-xl bg-[#FFE23D] px-2 py-2 text-xs font-extrabold text-[#0B3D26]">De garde</span>
              </div> : <Link key={p.id} href="/gardes" className="mx-3 my-2 flex min-h-[112px] w-[calc(100%-1.5rem)] items-center gap-3 rounded-[18px] border border-[#DDE3DE] bg-white px-3 py-3 shadow-[0_3px_12px_rgba(60,64,67,0.16)]">
                <span className="flex h-[64px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D9E2DC] bg-[#E7EFE5]">{p.imageUrl ? <img src={p.imageUrl} alt={`Pharmacie ${p.nom}`} loading="lazy" className="h-full w-full object-cover" /> : <span className="text-2xl text-[#0F6B3F]" aria-label="Photo non disponible">✚</span>}</span>
                <span className="min-w-0 flex-1"><strong className="block text-[16px] leading-5 text-[#0B3D26]">{p.nom}</strong><span className="mt-1 block text-[13px] text-[#64776B]">{p.quartier || "Yaoundé"}{p.telephone ? ` · ${p.telephone}` : ""}</span></span>
                <span className="shrink-0 rounded-xl bg-[#FFE23D] px-2 py-2 text-xs font-extrabold text-[#0B3D26]">De garde</span>
              </Link>)}
            </div>)}</div>
          </div> : <div className="flex min-h-[104px] items-center gap-3 px-4 py-3">
            <span className="flex h-[64px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D9E2DC] bg-[#E7EFE5]">{p.imageUrl ? <img src={p.imageUrl} alt={`Pharmacie ${p.nom}`} loading="lazy" className="h-full w-full object-cover" /> : <span className="text-2xl text-[#0F6B3F]" aria-label="Photo non disponible">✚</span>}</span>
            <p className="text-sm leading-5 text-[#53685C]">Aucune pharmacie de garde proche de vous n’est indiquée pour le moment.</p>
          </div>}
        </div>
        <Link href="/gardes" aria-label="Consulter la liste complète des pharmacies de garde" className="mt-3 inline-flex min-h-10 items-center text-sm font-bold text-[#0F6B3F] underline underline-offset-2">Consulter la liste complète</Link>
      </section>

      {homeFilterOpen && <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" role="presentation" onClick={()=>setHomeFilterOpen(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="home-filter-title" onClick={e=>e.stopPropagation()} className="w-full max-w-[480px] rounded-t-[28px] bg-[#F4F8F5] p-5 shadow-2xl sm:rounded-[28px]">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#C7D7CC]"/>
          <div className="flex items-center justify-between gap-3"><h2 id="home-filter-title" className="text-xl font-extrabold text-[#0B3D26]">Filtres de recherche</h2><button type="button" onClick={()=>setHomeFilterOpen(false)} aria-label="Fermer les filtres" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0B3D26]">×</button></div>
          <label className="mt-4 flex min-h-12 items-center justify-between gap-3 rounded-xl bg-white px-3 text-sm font-semibold"><span>En stock uniquement</span><input type="checkbox" checked={homeFilters.stock} onChange={e=>setHomeFilters(v=>({...v,stock:e.target.checked}))} className="h-5 w-5 accent-[#FFE23D]"/></label>
          <label className="mt-2 flex min-h-12 items-center justify-between gap-3 rounded-xl bg-white px-3 text-sm font-semibold"><span>Pharmacies ouvertes / de garde</span><input type="checkbox" checked={homeFilters.open} onChange={e=>setHomeFilters(v=>({...v,open:e.target.checked}))} className="h-5 w-5 accent-[#FFE23D]"/></label>
          <label className="mt-2 flex min-h-12 items-center justify-between gap-3 rounded-xl bg-white px-3 text-sm font-semibold"><span>Médicament sur ordonnance</span><input type="checkbox" checked={homeFilters.prescription} onChange={e=>setHomeFilters(v=>({...v,prescription:e.target.checked}))} className="h-5 w-5 accent-[#FFE23D]"/></label>
          <label className="mt-3 block text-sm font-semibold">Prix maximum (FCFA)<input inputMode="numeric" type="number" min="0" value={homeFilters.price} onChange={e=>setHomeFilters(v=>({...v,price:e.target.value}))} className="mt-1 h-12 w-full rounded-xl border border-[#D7E5DC] bg-white px-3 accent-[#FFE23D]"/></label>
          <button type="button" onClick={()=>setHomeFilterOpen(false)} className="mt-5 flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#FFE23D] px-4 font-extrabold text-[#0B3D26]">Appliquer les filtres</button>
          <p className="mt-2 text-xs leading-5 text-[#64776B]">Les filtres seront appliqués aux pharmacies après avoir lancé la recherche d'un médicament.</p>
        </section>
      </div>}


      {dictionnaireOuvert && <div className="fixed inset-0 z-[220] flex items-center justify-center overflow-y-auto bg-[#0B3D26]/45 p-3 backdrop-blur-sm animate-in fade-in duration-300 sm:p-5" onClick={() => setDictionnaireOuvert(false)} role="presentation">
        <div className="relative my-auto w-full max-w-[490px] animate-in zoom-in-95 slide-in-from-bottom-2 duration-300" onClick={event => event.stopPropagation()} data-naxa-dictionnaire-dialog>
          <div className="pointer-events-none absolute -inset-3 rounded-[34px] bg-[radial-gradient(ellipse_at_top,rgba(22,113,67,0.12),transparent_58%)]"/>
          <section role="dialog" aria-modal="true" aria-labelledby="naxa-dictionnaire-title" className="relative max-h-[92dvh] overflow-y-auto rounded-[28px] border border-[#D7E7D9] bg-white shadow-[0_24px_70px_rgba(11,61,38,0.22)]">
            <div className="relative overflow-hidden bg-gradient-to-br from-white via-[#F4FAF5] to-[#E8F5EA] px-5 pb-6 pt-5 text-[#123D28]">
              <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full border border-[#167143]/15"/>
              <div className="pointer-events-none absolute -right-2 -top-6 h-28 w-28 rounded-full border border-[#167143]/12"/>
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#167143] to-transparent"/>
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-[62px] w-[70px] shrink-0 items-center justify-center rounded-2xl border border-[#D6E7D8] bg-white shadow-sm">
                    <svg viewBox="0 0 100 76" className="h-[54px] w-[64px]" aria-hidden="true">
                      <path d="M5 15Q24 8 47 19V66Q25 55 5 63Z" fill="#FFFFFF" stroke="#A8CDB0" strokeWidth="2"/>
                      <path d="M95 15Q76 8 53 19V66Q75 55 95 63Z" fill="#F3FAF4" stroke="#A8CDB0" strokeWidth="2"/>
                      <path d="M50 19V68" stroke="#167143" strokeWidth="2.5"/>
                      <path d="M14 25Q27 22 40 28M14 34Q27 31 40 37M14 43Q27 40 40 46M60 28Q73 22 86 25M60 37Q73 31 86 34M60 46Q73 40 86 43" stroke="#6D9B7B" strokeWidth="2" strokeLinecap="round" fill="none"/>
                      <path d="M50 4l2.5 6.5L59 13l-6.5 2.5L50 22l-2.5-6.5L41 13l6.5-2.5Z" fill="#167143"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#167143]">{anglais ? "NAXA HEALTH LIBRARY" : "BIBLIOTHÈQUE SANTÉ NAXA"}</p>
                    <h2 id="naxa-dictionnaire-title" className="mt-1 text-[22px] font-black leading-6 tracking-[-0.03em]">{anglais ? "Explore the medical world" : "Explorez le monde médical"}</h2>
                    <p className="mt-1 text-xs leading-5 text-[#53685C]">{anglais ? "Understand a term, one page at a time." : "Comprendre un terme, page après page."}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setDictionnaireOuvert(false)} aria-label={anglais ? "Close medical dictionary" : "Fermer le dictionnaire médical"} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D7E7D9] bg-white text-2xl text-[#24583B] transition hover:bg-[#EDF6EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#167143]">×</button>
              </div>
              <div className="relative mt-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-[#167143]">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#B8D7BE]/80"/>
                <span>{anglais ? "Your illustrated encyclopedia" : "Votre encyclopédie illustrée"}</span>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#B8D7BE]/80"/>
              </div>
            </div>
            <div className="p-4 sm:p-5">
              <form onSubmit={rechercherTermeMedical}>
                <label htmlFor="naxa-dictionnaire-search" className="mb-2 block text-sm font-extrabold text-[#173F2A]">{anglais ? "What would you like to understand?" : "Que souhaitez-vous comprendre ?"}</label>
                <div className="flex items-center gap-2 rounded-2xl border border-[#D2E5D5] bg-white px-3 shadow-[0_4px_18px_rgba(13,69,39,0.06)] transition focus-within:border-[#167143] focus-within:ring-4 focus-within:ring-[#167143]/10">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF4E9] text-[#0F6B3F]" aria-hidden="true"><IconeNAXA name="search" size={19}/></span>
                  <input id="naxa-dictionnaire-search" value={termeMedical} onChange={event => { setTermeMedical(event.target.value); setResultatMedical(null); setErreurMedicale(""); }} aria-controls="naxa-dictionnaire-suggestions" aria-autocomplete="list" placeholder={anglais ? "E.g. malaria, paracetamol…" : "Ex. paludisme, paracétamol…"} maxLength={100} autoComplete="off" className="h-[54px] min-w-0 flex-1 bg-transparent text-[15px] text-[#183B28] outline-none placeholder:text-[#879287]"/>
                  {termeMedical && <button type="button" aria-label={anglais ? "Clear search" : "Effacer la recherche"} onClick={() => { setTermeMedical(""); setResultatMedical(null); setErreurMedicale(""); document.getElementById("naxa-dictionnaire-search")?.focus(); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F0F4ED] text-lg text-[#42634E]">×</button>}
                </div>
                {termeMedical.trim().length >= 2 && !resultatMedical && (suggestionsMedicales.length > 0 || chargementSuggestionsMedicales) && <div id="naxa-dictionnaire-suggestions" role="listbox" aria-label={anglais ? "Medical suggestions" : "Suggestions médicales"} className="mt-2 overflow-hidden rounded-2xl border border-[#D9E8DC] bg-white p-1.5 shadow-[0_8px_24px_rgba(10,57,31,0.08)]">
                  <p className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#167143]">{anglais ? "Suggested entries" : "Suggestions du dictionnaire"}</p>
                  {chargementSuggestionsMedicales && suggestionsMedicales.length === 0 && <p className="px-3 py-3 text-xs text-[#647366]">{anglais ? "Looking for suggestions…" : "Recherche de suggestions…"}</p>}
                  {suggestionsMedicales.map((suggestion, index) => <button key={suggestion} type="button" role="option" aria-selected="false" onClick={() => { void chargerTermeMedical(suggestion); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-[#183B28] transition hover:bg-[#EDF6ED] focus-visible:bg-[#EDF6ED] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#167143]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#D5E6D6] bg-[#F1F7ED] text-xs font-black text-[#0F6B3F]">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">{suggestion}</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#167143] shadow-sm"><IconeNAXA name="arrow-left" size={15}/></span>
                  </button>)}
                </div>}
                <button type="submit" disabled={rechercheMedicale || termeMedical.trim().length < 2} className="mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl border border-[#D8B92D] bg-gradient-to-r from-[#FFE95A] via-[#167143] to-[#F8D92D] px-4 font-black text-[#0B3D26] shadow-[0_5px_0_#D4B72C] transition hover:brightness-[1.02] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none">
                  {rechercheMedicale ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"/> {anglais ? "Searching…" : "Recherche en cours…"} </> : <><IconeNAXA name="search" size={18}/> {anglais ? "Find in the dictionary" : "Rechercher dans le dictionnaire"}</>}
                </button>
              </form>
              {erreurMedicale && <p role="alert" className="mt-4 rounded-2xl border border-[#E9C6BD] bg-[#FFF1ED] px-3 py-3 text-sm leading-5 text-[#8D3022]">{erreurMedicale}</p>}
              {resultatMedical && <article aria-live="polite" className="mt-5 overflow-hidden rounded-[22px] border border-[#D8E8DA] bg-white shadow-[0_8px_24px_rgba(10,57,31,0.07)]">
                <div className="flex items-center justify-between gap-2 border-b border-[#DCEBDE] bg-[#F0F8F1] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#167143]">{resultatMedical.type || (anglais ? "Medical definition" : "Définition médicale")}</p>
                  <span className="rounded-full border border-[#D6E7D8] bg-white px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-[#376349]">{anglais ? "Reference" : "Référence"}</span>
                </div>
                <div className="p-4">
                  <h3 className="text-[21px] font-black leading-7 tracking-[-0.02em] text-[#0B3D26]">{resultatMedical.terme}</h3>
                  {resultatMedical.imageUrl ? <figure className="mt-3 overflow-hidden rounded-2xl border border-[#E3E8DE] bg-[#F6F7F0]">
                    <img src={resultatMedical.imageUrl} alt={resultatMedical.imageAlt || ((anglais ? "Illustration: " : "Illustration : ") + resultatMedical.terme)} loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = "none"; }} className="mx-auto max-h-56 w-full object-contain p-3"/>
                    {resultatMedical.imageSource && resultatMedical.imageSourceUrl && <figcaption className="border-t border-[#E5E9E0] bg-white px-3 py-2 text-[10px] leading-4 text-[#647366]">{anglais ? "Illustration: " : "Illustration : "} <a href={resultatMedical.imageSourceUrl} target="_blank" rel="noreferrer" className="font-bold text-[#0F6B3F] underline underline-offset-2">{resultatMedical.imageSource}</a></figcaption>}
                  </figure> : <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-[#D8DCCF] bg-[#F8F7F0] px-3 py-3 text-xs leading-5 text-[#647366]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8F1E5] text-[#0F6B3F]"><IconeNAXA name="search" size={21}/></span><span>{anglais ? "A text reference entry. An illustration is not available for this term." : "Notice de référence textuelle. Aucune illustration n’est disponible pour ce terme."}</span></div>}
                  <p className="mt-4 whitespace-pre-line text-sm leading-6 text-[#35483B]">{resultatMedical.definition}</p>
                  <p className="mt-4 border-t border-[#E8EDE6] pt-3 text-xs font-bold text-[#53685C]">{anglais ? "Source: " : "Source : "} <a href={resultatMedical.sourceUrl} target="_blank" rel="noreferrer" className="text-[#0F6B3F] underline underline-offset-2">{resultatMedical.source}</a></p>
                  <p className="mt-3 rounded-xl bg-[#F5F4EC] px-3 py-2.5 text-xs leading-5 text-[#596456]">{resultatMedical.notice}</p>
                </div>
              </article>}
              {!resultatMedical && !erreurMedicale && <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#EDF3E8] px-3 py-3 text-xs leading-5 text-[#53685C]"><IconeNAXA name="search" size={17} className="mt-0.5 shrink-0 text-[#0F6B3F]"/><p>{anglais ? "Every entry includes its source. This dictionary does not provide dosage advice." : "Chaque fiche indique sa source. Ce dictionnaire ne fournit aucun conseil de dosage."}</p></div>}
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#DCEBDE] pt-3">
                <span className="text-[10px] leading-4 text-[#788174]">{anglais ? "A reference book to use thoughtfully." : "Un livre de référence à consulter avec discernement."}</span>
                <button type="button" onClick={() => { setTermeMedical(""); setResultatMedical(null); setErreurMedicale(""); document.getElementById("naxa-dictionnaire-search")?.focus(); }} className="shrink-0 rounded-full border border-[#D4E4D6] bg-white px-3 py-2 text-xs font-extrabold text-[#0F6B3F] transition hover:bg-[#EDF6ED]">{anglais ? "New search" : "Nouvelle recherche"}</button>
              </div>
            </div>
            <div className="h-1.5 bg-gradient-to-r from-[#0B3D26] via-[#167143] to-[#0B3D26]"/>
          </section>
          <div className="mx-auto h-2 w-[92%] rounded-b-xl border-x border-b border-[#C8DDCC] bg-[#E0EEE2] shadow-md"/>
        </div>
      </div>}
      <section className="naxa-enter mt-6 pb-4">
        <Link href="/client/posologie" className="group flex min-h-[88px] items-center gap-3 rounded-[22px] border border-[#CFE2D5] bg-white p-4 shadow-[0_6px_18px_rgba(0,0,0,0.06)] transition-transform active:scale-[0.99]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E1F4E7] text-[#0F6B3F] transition-transform group-hover:scale-105" aria-hidden="true">
            <IconeNAXA name="clock" size={25}/>
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-[16px] font-extrabold leading-5 text-[#0B3D26]">Configurer une posologie</strong>
            <span className="mt-1 block text-[13px] leading-5 text-[#53685C]">Organisez les horaires et rappels de prise prescrits</span>
          </span>
          <IconeNAXA name="chevron-right" size={20} className="shrink-0 text-[#0F6B3F]"/>
        </Link>
      </section>
      <section className="naxa-enter mt-3 pb-6">
        <button type="button" onClick={() => { setDictionnaireOuvert(true); setErreurMedicale(""); }} aria-haspopup="dialog" className="group relative flex min-h-[104px] w-full items-center gap-4 overflow-hidden rounded-[22px] border border-[#D5E7D8] bg-gradient-to-r from-white via-[#F4FAF5] to-[#E8F5EA] p-4 text-left shadow-[0_8px_22px_rgba(5,74,41,0.09)] transition duration-300 hover:-translate-y-0.5 active:scale-[0.99]">
          <span className="relative flex h-[66px] w-[58px] shrink-0 items-center justify-center [perspective:400px]" aria-hidden="true">
            <svg viewBox="0 0 64 76" className="h-full w-full drop-shadow-lg">
              <path d="M7 8Q7 5 11 5H54Q58 5 58 10V67Q58 71 54 71H11Q7 71 7 67Z" fill="#A9CDB0"/>
              <path d="M10 8H31V68H10Q8 68 8 65V12Q8 8 10 8Z" fill="#167143" stroke="#B8D8BE" strokeWidth="1.5"/>
              <path d="M32 8H54Q57 8 57 12V65Q57 68 54 68H32Z" fill="#FFFFFF" stroke="#B8D8BE" strokeWidth="1.5"/>
              <path d="M32 9V68" stroke="#B8D8BE" strokeWidth="2"/>
              <path d="M17 25H25M17 30H25M17 35H25" stroke="#D8E8DA" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M39 25H49M39 30H49M39 35H49M39 40H47" stroke="#8D9D8C" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M19 48H25M22 45V51" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"/>
              <path d="M39 51H49" stroke="#8D9D8C" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M11 5V71" stroke="#FFE23D" strokeWidth="2"/>
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-extrabold leading-5 text-[#123D28]">{anglais ? "Medical dictionary" : "Dictionnaire médical"}</span>
            <span className="mt-1 block text-[13px] leading-5 text-[#53685C]">{anglais ? "Medicines, diseases, molecules and health terms" : "Médicaments, maladies, molécules et termes de santé"}</span>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-[#167143]">{anglais ? "Open" : "Ouvrir"} <IconeNAXA name="chevron-right" size={15}/></span>
          </span>
        </button>
      </section>
    </main>
  </div>;
}
