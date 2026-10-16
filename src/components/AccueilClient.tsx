"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bell, CheckCircle2, ChevronRight, Lock, MapPin, Search,
  ShoppingCart, ScanLine, Store,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { usePanier } from "@/lib/panier";
import { notifierNAXA } from "@/components/NotificationGlobale";
import { ACCUEIL_PRODUITS_DEMO } from "@/lib/accueil-client-mock";

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
  ...p, photo_url: p.photoUrl, pharmacie_id: null, distanceKm: p.distanceKm, demo: true,
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
    <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 16 }} className="absolute bottom-[48px] left-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#FFE23D] text-[#0B3D26] shadow-lg">
      <MapPin size={21} strokeWidth={2.4} aria-hidden="true"/>
      <span className="naxa-pin-pulse" />
    </motion.span>
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
  const reducedMotion = useReducedMotion();
  const { ajouter, nombre } = usePanier();
  const [query, setQuery] = useState("");
  const [initiales, setInitiales] = useState("JD");
  const [quartier, setQuartier] = useState("Douala");
  const [coord, setCoord] = useState<{lat:number;lng:number}|null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacie[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [added, setAdded] = useState<string|null>(null);
  const [newNotification, setNewNotification] = useState(false);
  const [userId, setUserId] = useState<string|null>(null);

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
          const { data: profile } = await sb.from("profiles").select("first_name,last_name,full_name").eq("id", user.id).maybeSingle();
          const meta = user.user_metadata ?? {};
          const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.full_name || meta.full_name || meta.name || user.email || "JD";
          setInitiales(String(name).trim().split(/\s+/).slice(0,2).map((part: string) => part[0]?.toUpperCase() ?? "").join("") || "JD");
        }
        const { data: ps, error: productError } = await sb.from("produits").select("id,nom,dosage,forme,photo_url").order("nom").limit(30);
        if (productError) throw productError;
        const products = (ps ?? []) as Array<{id:string;nom:string;dosage:string;forme:string;photo_url:string|null}>;
        if (!products.length) {
          setProduits(ACCUEIL_PRODUITS_DEMO.map(demoToProduit));
          setError(true);
          return;
        }
        const ids = products.map(p => p.id);
        const today = new Date().toISOString().slice(0,10);
        const { data: stockRows, error: stockError } = await sb.from("stocks").select("produit_id,pharmacie_id,prix,quantite,date_peremption,pharmacies(id,nom,ville,quartier,lat,lng,actif,de_garde)").in("produit_id", ids).gt("quantite",0).or(`date_peremption.is.null,date_peremption.gte.${today}`);
        if (stockError) throw stockError;
        const valid = ((stockRows ?? []) as unknown as StockRow[]).filter(s => s.pharmacies?.actif && Number(s.quantite)>0);
        const sorted = products.map(p => {
          const stocks = valid.filter(s => s.produit_id === p.id).sort((a,b) => Number(a.prix)-Number(b.prix));
          const chosen = stocks[0];
          const name = p.nom || "Médicament";
          const demoMatch = ACCUEIL_PRODUITS_DEMO.find(d => name.toLowerCase().includes(d.nom.split(" ")[0].toLowerCase()));
          return {
            id:p.id, nom:name, dosage:p.dosage||"", photo_url:p.photo_url, prix:Number(chosen?.prix ?? 0),
            quantite:Number(chosen?.quantite ?? 0), pharmacie_id:chosen?.pharmacie_id ?? null,
            pharmacie:chosen?.pharmacies?.nom ?? "Pharmacie partenaire",
            distanceKm:chosen?.pharmacies?.lat != null && chosen.pharmacies.lng != null ? distance(4.05,9.70,chosen.pharmacies.lat,chosen.pharmacies.lng) : null,
            laboratoire:demoMatch?.laboratoire ?? "Laboratoire",
            conditionnement:demoMatch?.conditionnement ?? p.forme ?? "Conditionnement non précisé",
            ordonnance:demoMatch?.ordonnance ?? false,
          } satisfies Produit;
        }).filter(p => p.quantite > 0).sort((a,b) => {
          const aRank = /parac[eé]tamol/i.test(a.nom) ? 0 : /coartem/i.test(a.nom) ? 1 : 2;
          const bRank = /parac[eé]tamol/i.test(b.nom) ? 0 : /coartem/i.test(b.nom) ? 1 : 2;
          return aRank-bRank;
        }).slice(0,2);
        setProduits(sorted.length ? sorted : ACCUEIL_PRODUITS_DEMO.map(demoToProduit));
        if (!sorted.length) setError(true);
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
  const gardes = pharmaciesProches.filter(p => p.de_garde).slice(0,3);
  const soumettre = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) return;
    window.location.href = "/recherche?q=" + encodeURIComponent(query.trim());
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
  const pharmacyCount = pharmaciesProches.length;
  const addToCart = (p:Produit) => {
    if (p.ordonnance) { window.location.href = "/scanner"; return; }
    if (p.demo || !p.pharmacie_id) {
      notifierNAXA("La disponibilité réelle de ce médicament doit être confirmée auprès d’une pharmacie partenaire.");
      return;
    }
    ajouter({produit_id:p.id,nom:p.nom,dosage:p.dosage},1);
    setAdded(p.id);
    window.setTimeout(() => setAdded(current => current === p.id ? null : current),1200);
  };
  const motionProps = reducedMotion ? {} : { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.12 }, variants: apparition, transition: { duration: 0.32, ease: "easeOut" as const } };

  return <div className="naxa-home-shell min-h-dvh bg-[#F4F8F5] pb-[calc(92px+env(safe-area-inset-bottom,0px))] text-[#0B3D26]">
    <header className="relative z-10 h-[110px] bg-[#0F6B3F] px-4 pt-[max(18px,env(safe-area-inset-top,0px))] text-white">
      <div className="mx-auto flex max-w-[480px] items-center justify-between gap-3">
        <motion.div initial={reducedMotion?false:{opacity:0,x:-14}} animate={{opacity:1,x:0}} transition={{duration:0.3}}><LogoNAXA/></motion.div>
        <div className="flex items-center gap-2">
          <Link href={userId ? "/client" : "/connexion?espace=client"} aria-label="Profil" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-[#0B542F] text-sm font-extrabold text-[#FFE23D]">{initiales}</Link>
          <Link href="/notifications" aria-label="Notifications" className="relative flex h-12 w-12 items-center justify-center rounded-full text-white">
            <Bell size={24} strokeWidth={2} aria-hidden="true"/>
            {newNotification && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#FFE23D]"/>}
          </Link>
        </div>
      </div>
    </header>
    <main className="relative z-10 mx-auto -mt-7 w-full max-w-[480px] rounded-t-[28px] bg-[#F4F8F5] px-4 pt-6">
      <motion.div {...motionProps} className="mb-5">
        <h1 className="whitespace-nowrap text-[clamp(22px,6.7vw,28px)] font-extrabold leading-tight tracking-[-0.04em] text-[#0B3D26]">Votre médicament, à 2 minutes.</h1>
        <p className="mt-1 text-[16px] leading-6 text-[#0F6B3F]">Livraison rapide à Douala • Pharmacies vérifiées</p>
      </motion.div>

      <motion.form {...motionProps} onSubmit={soumettre} className="mb-4 flex gap-2">
        <label className="group flex h-14 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#D8E5DC] bg-[#FBFDFC] px-4 shadow-sm transition focus-within:border-[#0F6B3F] focus-within:ring-4 focus-within:ring-[#0F6B3F]/10">
          <Search size={21} className="shrink-0 text-[#0B3D26] transition-transform group-focus-within:scale-110" aria-hidden="true"/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ex. Paracétamol, Coartem..." aria-label="Rechercher un médicament" className="min-w-0 flex-1 bg-transparent text-sm text-[#0B3D26] outline-none placeholder:text-[#7D8E84]"/>
        </label>
        <motion.button whileTap={reducedMotion?undefined:{scale:0.96}} type="submit" className="h-14 min-w-[92px] rounded-2xl bg-[#FFE23D] px-4 font-extrabold text-[#0B3D26] shadow-[0_6px_18px_rgba(255,226,61,0.25)]">Chercher</motion.button>
      </motion.form>

      <motion.div {...motionProps} className="mb-4">
        <Link href="/scanner" className="flex min-h-[76px] items-center gap-3 rounded-[24px] border-2 border-[#0F6B3F] px-4 py-3 transition active:scale-[0.99]">
          <motion.span animate={reducedMotion?undefined:{rotate:[0,-7,7,0]}} transition={{duration:0.38,delay:0.1}} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/60"><Lock size={24} aria-hidden="true"/></motion.span>
          <span className="min-w-0"><strong className="block text-[18px] font-extrabold leading-6">Scanner mon ordonnance</strong><span className="mt-1 block text-[13px] leading-5 text-[#466455]">Votre ordonnance reste privée • Traitée localement</span></span>
        </Link>
      </motion.div>

      <motion.section {...motionProps} className="mb-6 grid min-h-[150px] grid-cols-[44%_56%] overflow-hidden rounded-[20px] bg-white shadow-[0_6px_18px_rgba(0,0,0,0.08)]">
        <CarteIllustrative quartier={quartier === "Douala" ? "Douala" : "Vous êtes à "+quartier}/>
        <div className="flex min-w-0 flex-col items-end justify-center gap-3 p-3">
          <p className="w-full text-[20px] font-extrabold leading-6 text-[#0B3D26]">{pharmacyCount || 3} pharmacies à {pharmaciesProches[0]?.distanceKm?.toFixed(1) ?? "1.2"} km</p>
          <motion.div whileTap={reducedMotion?undefined:{scale:0.96}}><Link href="/gardes" className="inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[#FFE23D] px-4 text-sm font-extrabold text-[#0B3D26] shadow-sm">Voir tout</Link></motion.div>
        </div>
      </motion.section>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[22px] font-extrabold tracking-[-0.03em] text-[#0B3D26]">Médicaments recommandés</h2>
          <Link href="/resultats?q=paracétamol" className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl bg-[#FFF3B0] px-2.5 text-xs font-extrabold text-[#0B3D26]">Voir tout <ChevronRight size={16}/></Link>
        </div>
        {loading ? <div className="grid grid-cols-2 gap-3.5"><Squelette/><Squelette/></div> : <div className="grid grid-cols-2 gap-3.5">
          {produits.map((p,i)=><motion.article key={p.id} {...motionProps} transition={{duration:0.32,delay:reducedMotion?0:i*0.08}} whileTap={reducedMotion?undefined:{scale:0.985}} className="flex min-w-0 flex-col rounded-[20px] bg-white p-3 shadow-[0_6px_18px_rgba(0,0,0,0.07)]">
            <Link href={p.demo?"/resultats?q="+encodeURIComponent(p.nom):"/produit/"+p.id} aria-label={`Voir ${p.nom}`} className="flex min-h-[124px] items-center justify-center overflow-hidden">
              {p.photo_url ? <Image src={p.photo_url} alt={p.nom} width={180} height={124} className="h-[124px] w-full object-contain" unoptimized/> : <Blister/>}
            </Link>
            <span className={`mt-2 inline-flex min-h-6 w-fit items-center rounded-full px-2 py-1 text-[11px] font-extrabold leading-4 ${p.ordonnance?"bg-[#0F6B3F] text-white":"bg-[#FFE23D] text-[#0B3D26]"}`}>{p.ordonnance?"Sur ordonnance":"Disponible"}</span>
            <h3 className="mt-2 line-clamp-2 min-h-12 text-[16px] font-extrabold leading-5 text-[#0B3D26]">{p.nom}</h3>
            <p className="min-h-10 text-[11px] leading-4 text-[#65766C]">{p.conditionnement} • {p.laboratoire}</p>
            <p className="mt-1 text-[18px] font-extrabold leading-6 text-[#0B3D26]">{p.prix?fcfa(p.prix):"Prix non disponible"}</p>
            <div className="mt-auto flex items-end justify-between gap-1 pt-3">
              <p className="min-w-0 text-[10px] leading-[14px] text-[#53685C]"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#218A4E]"/>{p.quantite>0?"En stock":"Stock à confirmer"} • {p.pharmacie}, {p.distanceKm?.toFixed(1) ?? "—"} km</p>
              <motion.button whileTap={reducedMotion?undefined:{scale:0.96}} onClick={()=>addToCart(p)} disabled={p.quantite<=0} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-[#FFE23D] px-2 text-[11px] font-extrabold text-[#0B3D26] disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Ajouter ${p.nom} au panier`}>
                <ShoppingCart size={14} aria-hidden="true"/>{added===p.id?"Ajouté ✓":"Ajouter"}
              </motion.button>
            </div>
          </motion.article>)}
        </div>}
        {error && <span className="sr-only" role="status">Données de démonstration affichées tant que le catalogue réel n'est pas disponible.</span>}
      </section>

      <section className="pb-2">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[22px] font-extrabold tracking-[-0.03em] text-[#0B3D26]">Pharmacies de garde aujourd'hui</h2>
          <Link href="/gardes" aria-label="Voir toutes les pharmacies de garde" className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF3B0] text-[#0B3D26]"><ChevronRight size={20}/></Link>
        </div>
        {gardes.length ? <div className="space-y-3">{gardes.map((p)=><Link key={p.id} href={`/gardes?pharmacie=${p.id}`} className="flex min-h-[76px] items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-[#18824B] text-white"><Store size={25}/></span>
          <span className="min-w-0 flex-1"><strong className="block text-[16px] leading-5">{p.nom}</strong><span className="mt-1 block text-[13px] text-[#64776B]">Ouvert 24/7 • {p.distanceKm?.toFixed(1) ?? "—"} km</span></span>
          <span className="shrink-0 rounded-xl bg-[#FFE23D] px-2 py-2 text-xs font-extrabold text-[#0B3D26]">À 12min</span>
        </Link>)}</div> : <Link href="/gardes" className="flex min-h-[76px] items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"><span className="flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-[#18824B] text-white"><Store size={25}/></span><span className="flex-1"><strong className="block">Pharmacies de garde à Douala</strong><span className="text-sm text-[#64776B]">Consulter la liste disponible</span></span><ChevronRight size={18}/></Link>}
      </section>
    </main>
  </div>;
}
