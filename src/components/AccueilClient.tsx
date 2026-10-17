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
import { notifierNAXA } from "@/components/NotificationGlobale";
import { ACCUEIL_PRODUITS_DEMO } from "@/lib/accueil-client-mock";
import { basculerFavori, ecouterFavoris, lireFavoris } from "@/lib/favoris-client";

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
  adresse: string | null; lat: number | null; lng: number | null; de_garde: boolean;
};
type StockRow = {
  produit_id: string; pharmacie_id: string; prix: number; quantite: number;
  date_peremption: string | null;
  pharmacies: { id: string; nom: string; ville: string | null; quartier: string | null; lat: number | null; lng: number | null; actif: boolean; de_garde: boolean } | null;
};
const fcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/\u202f/g, "\u00a0") + " FCFA";
const distance = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const rad = (v: number) => v * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
};
const demoToProduit = (p: (typeof ACCUEIL_PRODUITS_DEMO)[number]): Produit => ({
  id: p.id, nom: p.nom, dosage: p.dosage, photo_url: p.photoUrl, prix: p.prix,
  quantite: p.stock, pharmacie_id: null, pharmacie: p.pharmacie, distanceKm: null,
  laboratoire: p.laboratoire, conditionnement: p.conditionnement, ordonnance: p.ordonnance, demo: true,
});

function LogoNAXA() {
  return <Logo clair taille={38} />;
}

function CarteIllustrative({ quartier }: { quartier: string }) {
  return <div className="relative h-full min-h-[150px] overflow-hidden bg-[#E2F2EF]" aria-label={`Carte de proximité : ${quartier}`}>
    <svg viewBox="0 0 180 160" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <rect width="180" height="160" fill="#DDF0ED"/>
      <path d="M-10 18C30 32 28 3 64 22S104 44 118 22 157 6 195 23" stroke="#B9DFDB" strokeWidth="8" fill="none"/>
      <path d="M-12 76C18 55 38 88 63 70S107 61 132 84 165 104 193 88" stroke="#B9DFDB" strokeWidth="5" fill="none"/>
      <path d="M-6 128C23 104 48 130 72 116S119 112 138 134 167 143 193 132" stroke="#B9DFDB" strokeWidth="4" fill="none"/>
      <path d="M93 -10C79 19 106 34 96 55S113 79 103 99 122 130 109 171H190V-10Z" fill="#F1E5CB"/>
      <path d="M93 -10C79 19 106 34 96 55S113 79 103 99 122 130 109 171" stroke="#D8C8A8" strokeWidth="2" fill="none"/>
      <path d="M119 10l30 25M115 52l43 18M124 94l34 22M137 135l23 10" stroke="#D9CBB2" strokeWidth="2"/>
    </svg>
    <span className="naxa-pin-marker absolute bottom-[48px] left-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#FFE23D] text-[#0B3D26] shadow-lg">
      <IconeNAXA name="map-pin" size={21}/>
      <span className="naxa-pin-pulse" />
    </span>
    <span className="absolute inset-x-2 bottom-2 z-10 rounded-lg bg-white/90 px-2 py-1 text-[12px] font-semibold leading-4 text-[#0B3D26] shadow-sm">{quartier}</span>
  </div>;
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
  const [firstName, setFirstName] = useState("Client");
  const [hourLocale, setHourLocale] = useState<number | null>(null);
  const [quartier, setQuartier] = useState("Douala");
  const [coord, setCoord] = useState<{lat:number;lng:number}|null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacie[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [added, setAdded] = useState<string|null>(null);
  const [favoris, setFavoris] = useState<string[]>([]);
  const [menuServicesOuvert, setMenuServicesOuvert] = useState(false);
  const menuServicesRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHourLocale(new Date().getHours()); }, []);

  useEffect(() => {
    if (!menuServicesOuvert) return;
    const fermerSiExterieur = (event: PointerEvent) => {
      if (!menuServicesRef.current?.contains(event.target as Node)) setMenuServicesOuvert(false);
    };
    const fermerAvecEchap = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuServicesOuvert(false);
    };
    document.addEventListener("pointerdown", fermerSiExterieur);
    document.addEventListener("keydown", fermerAvecEchap);
    return () => {
      document.removeEventListener("pointerdown", fermerSiExterieur);
      document.removeEventListener("keydown", fermerAvecEchap);
    };
  }, [menuServicesOuvert]);

  useEffect(() => {
    const actualiser = () => setFavoris(lireFavoris().map(f => f.id));
    actualiser();
    return ecouterFavoris(actualiser);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("q");
    if (prefill) setQuery(prefill);
    let active = true;
    const sb = supabaseBrowser();
    void (async () => {
      try {
        const { data: { user } } = await sb.auth.getUser();
        if (!active) return;
        if (user) {
          const { data: profile } = await sb.from("profiles").select("first_name,last_name,avatar_url").eq("id", user.id).maybeSingle();
          setFirstName(typeof profile?.first_name === "string" && profile.first_name.trim() ? profile.first_name.trim().split(/\s+/)[0] : typeof user.user_metadata?.first_name === "string" && user.user_metadata.first_name.trim() ? user.user_metadata.first_name.trim().split(/\s+/)[0] : "Client");
        }
        const { data: popularRows } = await sb.rpc("produits_populaires", { p_limit: 6, p_jours: 7 });
        const popularIds = ((popularRows ?? []) as Array<{ produit_id: string }>).map((item) => item.produit_id);
        const productQuery = sb.from("produits").select("id,nom,dosage,forme,photo_url,fabricant,sur_ordonnance");
        const { data: ps, error: productError } = popularIds.length
          ? await productQuery.in("id", popularIds)
          : await productQuery.order("nom").limit(30);
        if (productError) throw productError;
        const products = (ps ?? []) as Array<{id:string;nom:string;dosage:string;forme:string;photo_url:string|null;fabricant:string|null;sur_ordonnance:boolean}>;
        if (!products.length) {
          setProduits(ACCUEIL_PRODUITS_DEMO.map(demoToProduit));
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
        }).slice(0,6);
        setProduits(sorted.length ? sorted : ACCUEIL_PRODUITS_DEMO.map(demoToProduit));
        if (!sorted.length) setError(true);
        }
        const { data: pharmRows } = await sb.from("pharmacies").select("id,nom,ville,quartier,adresse,lat,lng,de_garde").eq("actif",true).limit(100);
        if (active) setPharmacies((pharmRows ?? []) as Pharmacie[]);
      } catch {
        if (active) {
          setProduits(ACCUEIL_PRODUITS_DEMO.map(demoToProduit));
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
  const gardes = pharmaciesProches.filter(p => p.de_garde).slice(0,3);
  const soumettre = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) return;
    router.push("/resultats?q=" + encodeURIComponent(query.trim()));
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
  const addToCart = (p:Produit) => {
    if (p.demo || !p.pharmacie_id) {
      notifierNAXA("La disponibilité réelle de ce médicament doit être confirmée auprès d’une pharmacie partenaire.");
      return;
    }
    if (p.ordonnance) { window.location.href = "/scanner"; return; }
    ajouter({produit_id:p.id,nom:p.nom,dosage:p.dosage},1);
    setAdded(p.id);
    window.setTimeout(() => setAdded(current => current === p.id ? null : current),1200);
  };

  return <div className="naxa-home-shell min-h-dvh bg-[#F4F8F5] pb-[calc(92px+env(safe-area-inset-bottom,0px))] text-[#0B3D26]">
    <header className="relative z-[100] min-h-[118px] bg-[#0F6B3F] px-4 pb-3 pt-[max(18px,env(safe-area-inset-top,0px))] text-white">
      <div className="mx-auto flex max-w-[480px] items-center justify-between gap-3">
        <div className="min-w-0"><LogoNAXA/><p className="mt-1 text-[11px] font-semibold tracking-wide text-white/85">Votre médicament, à 2 minutes</p></div>
        <div className="flex items-center gap-1">
          <BoutonNotifications />
          <Link href="/recherche" aria-label="Rechercher un médicament" title="Rechercher un médicament" className="relative flex h-11 w-11 items-center justify-center rounded-full text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFE23D]">
            <IconeNAXA name="search" size={23}/>
          </Link>
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
              <nav id="menu-autres-services" aria-label="Autres services NAXA" className="absolute right-0 top-full z-[110] mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/20 bg-[#0F6B3F] p-2 text-white shadow-2xl">
                {[
                  "Parapharmacie",
                  "Bébé & maman",
                  "Dispositifs médicaux",
                  "Examens médicaux",
                  "Prestations et soins médicaux",
                ].map((categorie) => (
                  <Link
                    key={categorie}
                    href={"/resultats?q=" + encodeURIComponent(categorie)}
                    onClick={() => setMenuServicesOuvert(false)}
                    className="flex min-h-12 items-center rounded-xl px-3 py-2.5 text-sm font-bold text-white transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFE23D]"
                  >
                    {categorie}
                  </Link>
                ))}
                <a
                  href="mailto:naxa.home@gmail.com?subject=Besoin%20d%27aide%20sur%20NAXA"
                  onClick={() => setMenuServicesOuvert(false)}
                  className="mt-1 flex min-h-12 items-center gap-2 rounded-xl border-t border-white/20 px-3 py-3 text-sm font-extrabold text-white transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFE23D]"
                >
                  <IconeNAXA name="bell" size={18}/>
                  Besoin d'aide ?
                </a>
              </nav>
            )}
          </div>
        </div>
      </div>
    </header>
    <main className="relative z-10 mx-auto -mt-7 w-full max-w-[480px] rounded-t-[28px] bg-[#F4F8F5] px-4 pt-6">
      <div className="naxa-enter mb-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF3B0] text-[#0F6B3F]" aria-hidden="true">
            {hourLocale !== null && (hourLocale >= 18 || hourLocale < 5) ? <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/></svg> : <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>}
          </span>
          <h1 className="min-w-0 text-[clamp(20px,5.7vw,26px)] font-extrabold leading-tight tracking-[-0.035em] text-[#0B3D26]">{hourLocale !== null && (hourLocale >= 18 || hourLocale < 5) ? "Bonsoir" : "Bonjour"}, <span className="text-[#B18A00]">{firstName}</span> !</h1>
        </div>
        <p className="mt-2 text-[16px] font-bold leading-6 text-[#0F6B3F]">Quel médicament recherches-tu aujourd’hui ?</p>
        <p className="mt-1 text-[13px] leading-5 text-[#53685C]">Livraison rapide par les pharmacies vérifiées</p>
      </div>

      <form onSubmit={soumettre} className="naxa-enter mb-4 flex gap-2">
        <label className="group flex h-14 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#D8E5DC] bg-[#FBFDFC] px-4 shadow-sm transition focus-within:border-[#0F6B3F] focus-within:ring-4 focus-within:ring-[#0F6B3F]/10">
          <IconeNAXA name="search" size={21} className="shrink-0 text-[#0B3D26] transition-transform group-focus-within:scale-110"/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ex. Paracétamol, Coartem..." aria-label="Rechercher un médicament" className="min-w-0 flex-1 bg-transparent text-sm text-[#0B3D26] outline-none placeholder:text-[#7D8E84]"/>
        </label>
        <button type="submit" className="h-14 min-w-[92px] rounded-2xl bg-[#FFE23D] px-4 font-extrabold text-[#0B3D26] shadow-[0_6px_18px_rgba(255,226,61,0.25)]">Chercher</button>
      </form>

      <div className="naxa-enter mb-4">
        <Link href="/scanner" className="flex min-h-[76px] items-center gap-3 rounded-[24px] border-2 border-[#0F6B3F] px-4 py-3 transition active:scale-[0.99]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/60"><IconeNAXA name="lock" size={24}/></span>
          <span className="min-w-0"><strong className="block text-[18px] font-extrabold leading-6">Scanner mon ordonnance</strong><span className="mt-1 block text-[13px] leading-5 text-[#466455]">Votre ordonnance reste privée • Traitée localement</span></span>
        </Link>
      </div>

      <h2 className="naxa-enter mb-3 text-[22px] font-extrabold tracking-[-0.03em] text-[#0B3D26]">Pharmacies à Proximité</h2>
      <section className="naxa-enter mb-6 grid min-h-[150px] grid-cols-[44%_56%] overflow-hidden rounded-[20px] bg-white shadow-[0_6px_18px_rgba(0,0,0,0.08)]">
        <button type="button" onClick={localiser} aria-label="Utiliser ma position pour calculer les distances" className="min-w-0 text-left"><CarteIllustrative quartier={quartier === "Douala" ? "Douala" : "Vous êtes à "+quartier} /></button>
        <div className="flex min-w-0 flex-col items-end justify-center gap-3 p-3">
          <p className="w-full text-[16px] font-extrabold leading-5 text-[#0B3D26]">{coord ? `${pharmacyCount} pharmacie${pharmacyCount === 1 ? "" : "s"} à proximité` : "Activez la localisation pour voir les pharmacies proches"}</p>
          <div><button type="button" onClick={() => { if (!coord) { localiser(); return; } notifierNAXA("La liste complète des pharmacies à proximité sera bientôt disponible."); }} className="inline-flex min-h-10 items-center justify-center rounded-[14px] bg-[#FFE23D] px-3 text-sm font-extrabold text-[#0B3D26] shadow-sm">Voir plus</button></div>
        </div>
      </section>

      <section className="mb-6">
        {loading ? <div className="grid grid-cols-2 gap-2.5"><Squelette/><Squelette/></div> : <div className="naxa-reveal-list grid grid-cols-2 gap-2.5">
          {produits.map((p,i)=><article key={p.id} style={{"--reveal-index":i} as React.CSSProperties} className="naxa-enter relative flex min-w-0 flex-col rounded-[18px] bg-white p-2.5 shadow-[0_6px_18px_rgba(0,0,0,0.07)]">
            <Link href={p.demo?"/resultats?q="+encodeURIComponent(p.nom):"/produit/"+p.id} aria-label={`Voir ${p.nom}`} className="flex min-h-[88px] items-center justify-center overflow-hidden">
              {p.photo_url ? <Image src={p.photo_url} alt={p.nom} width={160} height={88} className="h-[88px] w-full object-contain" unoptimized/> : <Blister/>}
            </Link>
            <button type="button" onClick={() => toggleFavori(p)} aria-label={favoris.includes(p.id) ? `Retirer ${p.nom} des favoris` : `Ajouter ${p.nom} aux favoris`} aria-pressed={favoris.includes(p.id)} className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E5DC] bg-white/95 text-[#0F6B3F] shadow-sm transition-transform active:scale-95">
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
              <button onClick={()=>addToCart(p)} disabled={p.quantite<=0} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-[#FFE23D] px-2 text-[11px] font-extrabold text-[#0B3D26] disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Ajouter ${p.nom} au panier`}>
                <IconeNAXA name="shopping-cart" size={14}/>{added===p.id?"Ajouté ✓":"Ajouter"}
              </button>
            </div>
          </article>)}
        </div>}
        {error && <span className="sr-only" role="status">Données de démonstration affichées tant que le catalogue réel n'est pas disponible.</span>}
      </section>

      <section className="pb-2">
        <div className="mb-3 flex flex-col items-start gap-1">
          <h2 className="text-[20px] font-extrabold tracking-[-0.03em] text-[#0B3D26]">Pharmacie de garde proche de vous</h2>
          <Link href="/gardes" aria-label="Consulter la liste complète des pharmacies de garde" className="inline-flex min-h-8 items-center text-sm font-bold text-[#0F6B3F] underline underline-offset-2">Consulter la liste complète</Link>
        </div>
        {gardes.length ? <div className="space-y-3">{gardes.map((p)=><Link key={p.id} href={`/gardes?pharmacie=${p.id}`} className="flex min-h-[76px] items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-[#18824B] text-white"><IconeNAXA name="store" size={25}/></span>
          <span className="min-w-0 flex-1"><strong className="block text-[16px] leading-5">{p.nom}</strong><span className="mt-1 block text-[13px] text-[#64776B]">Pharmacie de garde{p.distanceKm != null ? ` • ${p.distanceKm.toFixed(1)} km` : ""}</span></span>
          <span className="shrink-0 rounded-xl bg-[#FFE23D] px-2 py-2 text-xs font-extrabold text-[#0B3D26]">De garde</span>
        </Link>)}</div> : <Link href="/gardes" className="flex min-h-[76px] items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"><span className="flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-[#18824B] text-white"><IconeNAXA name="store" size={25}/></span><span className="flex-1"><strong className="block">Aucune pharmacie de garde proche n’est indiquée</strong></span><IconeNAXA name="chevron-right" size={18}/></Link>}
      </section>

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
    </main>
  </div>;
}
