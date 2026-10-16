"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { IconeNAXA } from "@/components/IconeNAXA";
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
const arrivee = { opacity: 1, y: 0 };
const apparition = { hidden: { opacity: 0, y: 12 }, show: arrivee };
const demoToProduit = (p: (typeof ACCUEIL_PRODUITS_DEMO)[number]): Produit => ({
  id: p.id, nom: p.nom, dosage: p.dosage, photo_url: p.photoUrl, prix: p.prix,
  quantite: p.stock, pharmacie_id: null, pharmacie: p.pharmacie, distanceKm: null,
  laboratoire: p.laboratoire, conditionnement: p.conditionnement, ordonnance: p.ordonnance, demo: true,
});

function LogoNAXA() {
  return <Link href="/" aria-label="Accueil NAXA" className="flex min-h-11 items-center gap-2">
    <svg viewBox="0 0 34 38" className="h-9 w-8" aria-hidden="true">
      <path d="M6 32V6L28 32V6" fill="none" stroke="#FFE23D" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span className="text-[34px] font-extrabold leading-none tracking-tight text-white">NAXA</span>
  </Link>;
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
  return <svg viewBox="0 0 180 120" className="h-[124px] w-full" role="img" aria-label="Illustration d'une plaquette de comprimés">
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
  return <div className="animate-pulse rounded-[20px] bg-white p-3 shadow-sm" aria-label="Chargement des médicaments recommandés">
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
  const [initiales, setInitiales] = useState("JD");
  const [quartier, setQuartier] = useState("Douala");
  const [coord, setCoord] = useState<{lat:number;lng:number}|null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacie[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [added, setAdded] = useState<string|null>(null);
  const [userId, setUserId] = useState<string|null>(null);
  const [favoris, setFavoris] = useState<string[]>([]);

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
          setUserId(user.id);
          const { data: profile } = await sb.from("profiles").select("first_name,last_name").eq("id", user.id).maybeSingle();
          const meta = user.user_metadata ?? {};
          const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || meta.full_name || meta.name || user.email || "JD";
          setInitiales(String(name).trim().split(/\s+/).slice(0,2).map((part: string) => part[0]?.toUpperCase() ?? "").join("") || "JD");
        }
        const { data: ps, error: productError } = await sb.from("produits").select("id,nom,dosage,forme,photo_url,fabricant,sur_ordonnance").order("nom").limit(30);
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
          const aRank = /parac[eé]tamol/i.test(a.nom) ? 0 : /coartem/i.test(a.nom) ? 1 : 2;
          const bRank = /parac[eé]tamol/i.test(b.nom) ? 0 : /coartem/i.test(b.nom) ? 1 : 2;
          return aRank-bRank;
        }).slice(0,2);
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
    router.push("/recherche?q=" + encodeURIComponent(query.trim()));
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
    <header className="relative z-10 h-[110px] bg-[#0F6B3F] px-4 pt-[max(18px,env(safe-area-inset-top,0px))] text-white">
      <div className="mx-auto flex max-w-[480px] items-center justify-between gap-3">
        <div><LogoNAXA/></div>
        <div className="flex items-center gap-2">
          <Link href={userId ? "/client" : "/connexion?espace=client"} aria-label="Profil" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-[#0B542F] text-sm font-extrabold text-[#FFE23D]">{initiales}</Link>
          <Link href="/notifications" aria-label="Notifications" className="relative flex h-12 w-12 items-center justify-center rounded-full text-white">
            <IconeNAXA name="bell" size={24}/>
          </Link>
        </div>
      </div>
    </header>
    <main className="relative z-10 mx-auto -mt-7 w-full max-w-[480px] rounded-t-[28px] bg-[#F4F8F5] px-4 pt-6">
      <div className="naxa-enter mb-5">
        <h1 className="whitespace-nowrap text-[clamp(22px,6.7vw,28px)] font-extrabold leading-tight tracking-[-0.04em] text-[#0B3D26]">Votre médicament, à 2 minutes.</h1>
        <p className="mt-1 text-[16px] leading-6 text-[#0F6B3F]">Livraison rapide à Douala • Pharmacies vérifiées</p>
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

      <section className="naxa-enter mb-6 grid min-h-[150px] grid-cols-[44%_56%] overflow-hidden rounded-[20px] bg-white shadow-[0_6px_18px_rgba(0,0,0,0.08)]">
        <button type="button" onClick={localiser} aria-label="Utiliser ma position pour calculer les distances" className="min-w-0 text-left"><CarteIllustrative quartier={quartier === "Douala" ? "Douala" : "Vous êtes à "+quartier} /></button>
        <div className="flex min-w-0 flex-col items-end justify-center gap-3 p-3">
          <p className="w-full text-[20px] font-extrabold leading-6 text-[#0B3D26]">{coord ? `${pharmacyCount} pharmacie${pharmacyCount === 1 ? "" : "s"} à 1,2 km` : `${pharmacies.length} pharmacie${pharmacies.length === 1 ? "" : "s"} partenaire${pharmacies.length === 1 ? "" : "s"}`}</p>
          <div><Link href="/gardes" className="inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[#FFE23D] px-4 text-sm font-extrabold text-[#0B3D26] shadow-sm">Voir tout</Link></div>
        </div>
      </section>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[22px] font-extrabold tracking-[-0.03em] text-[#0B3D26]">Médicaments recommandés</h2>
          <Link href="/resultats?q=paracétamol" className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl bg-[#FFF3B0] px-2.5 text-xs font-extrabold text-[#0B3D26]">Voir tout <IconeNAXA name="chevron-right" size={16}/></Link>
        </div>
        {loading ? <div className="grid grid-cols-2 gap-3.5"><Squelette/><Squelette/></div> : <div className="grid grid-cols-2 gap-3.5">
          {produits.map((p,i)=><article key={p.id} className="naxa-enter relative flex min-w-0 flex-col rounded-[20px] bg-white p-3 shadow-[0_6px_18px_rgba(0,0,0,0.07)]">
            <Link href={p.demo?"/resultats?q="+encodeURIComponent(p.nom):"/produit/"+p.id} aria-label={`Voir ${p.nom}`} className="flex min-h-[124px] items-center justify-center overflow-hidden">
              {p.photo_url ? <Image src={p.photo_url} alt={p.nom} width={180} height={124} className="h-[124px] w-full object-contain" unoptimized/> : <Blister/>}
            </Link>
            <button type="button" onClick={() => toggleFavori(p)} aria-label={favoris.includes(p.id) ? `Retirer ${p.nom} des favoris` : `Ajouter ${p.nom} aux favoris`} aria-pressed={favoris.includes(p.id)} className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E5DC] bg-white/95 text-[#0F6B3F] shadow-sm transition-transform active:scale-95">
              <IconeNAXA name="heart" size={19} filled={favoris.includes(p.id)} />
            </button>
            <span className={`mt-2 inline-flex min-h-6 w-fit items-center rounded-full px-2 py-1 text-[11px] font-extrabold leading-4 ${p.ordonnance?"bg-[#0F6B3F] text-white":"bg-[#FFE23D] text-[#0B3D26]"}`}>{p.demo ? "Exemple" : p.ordonnance ? "Sur ordonnance" : "Disponible"}</span>
            <h3 className="mt-2 line-clamp-2 min-h-12 text-[16px] font-extrabold leading-5 text-[#0B3D26]">{p.nom}</h3>
            <p className="min-h-10 text-[11px] leading-4 text-[#65766C]">{p.conditionnement} • {p.laboratoire}</p>
            <p className="mt-1 text-[18px] font-extrabold leading-6 text-[#0B3D26]">{p.prix?fcfa(p.prix):"Prix non disponible"}</p>
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
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[22px] font-extrabold tracking-[-0.03em] text-[#0B3D26]">Pharmacies de garde aujourd'hui</h2>
          <Link href="/gardes" aria-label="Voir toutes les pharmacies de garde" className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF3B0] text-[#0B3D26]"><IconeNAXA name="chevron-right" size={20}/></Link>
        </div>
        {gardes.length ? <div className="space-y-3">{gardes.map((p)=><Link key={p.id} href={`/gardes?pharmacie=${p.id}`} className="flex min-h-[76px] items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-[#18824B] text-white"><IconeNAXA name="store" size={25}/></span>
          <span className="min-w-0 flex-1"><strong className="block text-[16px] leading-5">{p.nom}</strong><span className="mt-1 block text-[13px] text-[#64776B]">Pharmacie de garde{p.distanceKm != null ? ` • ${p.distanceKm.toFixed(1)} km` : ""}</span></span>
          <span className="shrink-0 rounded-xl bg-[#FFE23D] px-2 py-2 text-xs font-extrabold text-[#0B3D26]">De garde</span>
        </Link>)}</div> : <Link href="/gardes" className="flex min-h-[76px] items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"><span className="flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-[#18824B] text-white"><IconeNAXA name="store" size={25}/></span><span className="flex-1"><strong className="block">Pharmacies de garde à Douala</strong><span className="text-sm text-[#64776B]">Consulter la liste disponible</span></span><IconeNAXA name="chevron-right" size={18}/></Link>}
      </section>
    </main>
  </div>;
}
