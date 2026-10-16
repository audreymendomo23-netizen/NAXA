"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { IconeNAXA } from "@/components/IconeNAXA";
import { notifierNAXA } from "@/components/NotificationGlobale";
import { supabaseBrowser } from "@/lib/supabase/client";

type ModeHoraire = "heures-fixes" | "intervalle";
type Posologie = {
  id: string;
  medicament: string;
  dose: string;
  unite: string;
  prises: number;
  mode: ModeHoraire;
  intervalleHeures: number;
  heureDebut: string;
  heures: string[];
  rappels: boolean;
  creeLe: string;
};
const CLE_PREFIXE = "naxa:posologies:";
const HEURES_DEFAUT = ["07:00", "12:00", "19:00", "22:00", "01:00", "04:00", "10:00", "16:00"];
const UNITE_DEFAUT = "comprimé(s)";

function heurePlus(heure: string, ajout: number) {
  const [h, m] = heure.split(":").map(Number);
  const total = (h * 60 + m + ajout * 60) % (24 * 60);
  return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
}

function lirePosologies(userId: string): Posologie[] {
  try {
    const value = localStorage.getItem(CLE_PREFIXE + userId);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as Posologie[] : [];
  } catch {
    return [];
  }
}

export default function ConfigurerPosologiePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [posologies, setPosologies] = useState<Posologie[]>([]);
  const [medicament, setMedicament] = useState("");
  const [dose, setDose] = useState("");
  const [unite, setUnite] = useState(UNITE_DEFAUT);
  const [prises, setPrises] = useState(3);
  const [mode, setMode] = useState<ModeHoraire>("heures-fixes");
  const [intervalleHeures, setIntervalleHeures] = useState(8);
  const [heureDebut, setHeureDebut] = useState("07:00");
  const [heures, setHeures] = useState(["07:00", "12:00", "19:00"]);
  const [rappels, setRappels] = useState(true);
  const [permission, setPermission] = useState("unsupported");
  const [erreur, setErreur] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabaseBrowser().auth.getUser();
      if (!active) return;
      if (!user) {
        router.replace("/connexion?retour=/client/posologie");
        return;
      }
      setUserId(user.id);
      setPosologies(lirePosologies(user.id));
      setPermission(typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported");
    })();
    return () => { active = false; };
  }, [router]);

  const heuresCalculees = useMemo(() => mode === "intervalle"
    ? Array.from({ length: prises }, (_, index) => heurePlus(heureDebut, index * intervalleHeures))
    : heures.slice(0, prises), [mode, prises, heureDebut, intervalleHeures, heures]);

  const persister = useCallback((next: Posologie[]): boolean => {
    if (!userId) return false;
    try {
      localStorage.setItem(CLE_PREFIXE + userId, JSON.stringify(next));
      setPosologies(next);
      return true;
    } catch {
      setErreur("L’enregistrement local est impossible sur cet appareil. Vérifiez l’espace disponible du navigateur.");
      return false;
    }
  }, [userId]);

  const changerPrises = (value: number) => {
    const safe = Math.min(8, Math.max(1, value));
    setPrises(safe);
    setHeures(previous => Array.from({ length: safe }, (_, index) => previous[index] ?? HEURES_DEFAUT[index]));
  };

  const enregistrer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErreur("");
    if (!userId || !medicament.trim() || !dose.trim() || !unite.trim()) {
      setErreur("Renseignez le médicament, la dose et son unité.");
      return;
    }
    if (mode === "heures-fixes" && heuresCalculees.length !== prises) {
      setErreur("Ajoutez une heure pour chaque prise.");
      return;
    }
    if (mode === "heures-fixes" && (heuresCalculees.some(h => !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(h)) || new Set(heuresCalculees).size !== heuresCalculees.length)) {
      setErreur("Vérifiez les heures : chaque prise doit avoir une heure différente.");
      return;
    }
    setEnregistrement(true);
    try {
      let autorise = rappels;
      if (rappels && "Notification" in window && Notification.permission === "default") {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result !== "granted") {
          notifierNAXA("Les notifications système ne sont pas autorisées. Les rappels dans NAXA restent disponibles tant que cette page est ouverte.");
        }
      } else if (!("Notification" in window)) {
        setPermission("unsupported");
      }
      const item: Posologie = {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
        medicament: medicament.trim(),
        dose: dose.trim(),
        unite: unite.trim(),
        prises,
        mode,
        intervalleHeures,
        heureDebut,
        heures: [...heuresCalculees].sort(),
        rappels: autorise,
        creeLe: new Date().toISOString(),
      };
      if (!persister([item, ...posologies])) return;
      setMedicament("");
      setDose("");
      setUnite(UNITE_DEFAUT);
      setErreur("");
      notifierNAXA("Schéma posologique enregistré sur cet appareil.");
    } finally {
      setEnregistrement(false);
    }
  };

  const supprimer = (id: string) => {
    if (!userId) return;
    persister(posologies.filter(item => item.id !== id));
    notifierNAXA("Schéma posologique supprimé.");
  };

  return <main className="min-h-dvh bg-[#F4F8F5] px-4 pb-[calc(110px+env(safe-area-inset-bottom,0px))] text-[#0B3D26]">
    <header className="-mx-4 bg-[#0F6B3F] px-4 pb-8 pt-[max(18px,env(safe-area-inset-top,0px))] text-white">
      <div className="mx-auto flex max-w-[480px] items-center gap-3">
        <Link href="/" aria-label="Retour à l’accueil" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10"><IconeNAXA name="arrow-left" size={21}/></Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white/75">Mon espace santé NAXA</p>
          <h1 className="text-2xl font-extrabold tracking-tight">Configurer une posologie</h1>
          <p className="mt-1 text-sm leading-5 text-white/85">Préparez vos horaires de prise et vos rappels.</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFE23D] text-[#0B3D26]"><IconeNAXA name="clock" size={23}/></span>
      </div>
    </header>

    <div className="mx-auto -mt-4 max-w-[480px] space-y-4">
      <section className="naxa-enter rounded-[22px] border border-[#D8E5DC] bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E1F4E7] text-[#0F6B3F]"><IconeNAXA name="bell" size={21}/></span>
          <div>
            <h2 className="font-extrabold">Votre schéma posologique</h2>
            <p className="mt-1 text-sm leading-5 text-[#53685C]">Indiquez les consignes déjà prescrites : dose, nombre de prises et heures. NAXA ne calcule pas et ne recommande pas de dose médicale.</p>
          </div>
        </div>
      </section>

      <form onSubmit={enregistrer} className="naxa-enter space-y-4 rounded-[24px] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.07)]">
        <div>
          <label htmlFor="medicament" className="mb-1.5 block text-sm font-extrabold">Médicament</label>
          <input id="medicament" value={medicament} onChange={e => setMedicament(e.target.value)} required maxLength={100} placeholder="Nom du médicament" className="min-h-12 w-full rounded-2xl border border-[#D8E5DC] bg-[#FBFDFC] px-4 text-sm outline-none transition focus:border-[#0F6B3F] focus:ring-4 focus:ring-[#0F6B3F]/10"/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="dose" className="mb-1.5 block text-sm font-extrabold">Dose prescrite</label>
            <input id="dose" value={dose} onChange={e => setDose(e.target.value)} required maxLength={40} placeholder="Ex. 1" className="min-h-12 w-full rounded-2xl border border-[#D8E5DC] bg-[#FBFDFC] px-3 text-sm outline-none focus:border-[#0F6B3F] focus:ring-4 focus:ring-[#0F6B3F]/10"/>
          </div>
          <div>
            <label htmlFor="unite" className="mb-1.5 block text-sm font-extrabold">Unité</label>
            <select id="unite" value={unite} onChange={e => setUnite(e.target.value)} className="min-h-12 w-full rounded-2xl border border-[#D8E5DC] bg-[#FBFDFC] px-2 text-sm outline-none focus:border-[#0F6B3F] focus:ring-4 focus:ring-[#0F6B3F]/10">
              <option>comprimé(s)</option><option>gélule(s)</option><option>ml</option><option>goutte(s)</option><option>sachet(s)</option><option>dose(s)</option><option>application(s)</option><option>autre</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="prises" className="mb-1.5 block text-sm font-extrabold">Nombre de prises par jour</label>
          <select id="prises" value={prises} onChange={e => changerPrises(Number(e.target.value))} className="min-h-12 w-full rounded-2xl border border-[#D8E5DC] bg-[#FBFDFC] px-3 text-sm outline-none focus:border-[#0F6B3F] focus:ring-4 focus:ring-[#0F6B3F]/10">
            {Array.from({length:8},(_,i)=>i+1).map(n=><option key={n} value={n}>{n} prise{n>1?"s":""} par jour</option>)}
          </select>
        </div>

        <div>
          <p className="mb-2 block text-sm font-extrabold">Rythme d’administration</p>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F4F8F5] p-1.5">
            <button type="button" onClick={() => setMode("heures-fixes")} aria-pressed={mode==="heures-fixes"} className={"min-h-11 rounded-xl px-2 text-sm font-bold transition "+(mode==="heures-fixes"?"bg-[#0F6B3F] text-white shadow-sm":"text-[#53685C]")}>Heures fixes</button>
            <button type="button" onClick={() => setMode("intervalle")} aria-pressed={mode==="intervalle"} className={"min-h-11 rounded-xl px-2 text-sm font-bold transition "+(mode==="intervalle"?"bg-[#0F6B3F] text-white shadow-sm":"text-[#53685C]")}>Intervalle</button>
          </div>
        </div>

        {mode === "heures-fixes" ? <div className="rounded-2xl border border-[#D8E5DC] p-3">
          <p className="mb-3 text-sm font-extrabold">Répartition journalière des prises</p>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({length:prises},(_,index)=><div key={index}>
              <label htmlFor={"heure-"+index} className="mb-1 block text-xs font-semibold text-[#53685C]">Prise {index+1}</label>
              <input id={"heure-"+index} type="time" value={heures[index]??HEURES_DEFAUT[index]} onChange={e=>setHeures(prev=>Array.from({length:prises},(_,i)=>i===index?e.target.value:prev[i]??HEURES_DEFAUT[i]))} required className="min-h-11 w-full rounded-xl border border-[#D8E5DC] bg-[#FBFDFC] px-2 text-sm outline-none focus:border-[#0F6B3F]"/>
            </div>)}
          </div>
          <p className="mt-3 text-xs leading-5 text-[#64776B]">Exemple de répartition : 07:00 · 12:00 · 19:00. Remplacez ces horaires par ceux indiqués sur votre ordonnance.</p>
        </div> : <div className="rounded-2xl border border-[#D8E5DC] p-3">
          <div>
            <label htmlFor="heure-debut" className="mb-1.5 block text-sm font-extrabold">Heure de la première prise</label>
            <input id="heure-debut" type="time" value={heureDebut} onChange={e=>setHeureDebut(e.target.value)} required className="min-h-12 w-full rounded-xl border border-[#D8E5DC] bg-[#FBFDFC] px-3 text-sm outline-none focus:border-[#0F6B3F]"/>
          </div>
          <div className="mt-3">
            <label htmlFor="intervalle" className="mb-1.5 block text-sm font-extrabold">Intervalle entre deux prises</label>
            <select id="intervalle" value={intervalleHeures} onChange={e=>setIntervalleHeures(Number(e.target.value))} className="min-h-12 w-full rounded-xl border border-[#D8E5DC] bg-[#FBFDFC] px-3 text-sm outline-none focus:border-[#0F6B3F]">
              {[4,6,8,12,24].map(h=><option key={h} value={h}>Toutes les {h} heures</option>)}
            </select>
          </div>
          <div className="mt-3 rounded-xl bg-[#E1F4E7] p-3">
            <p className="text-xs font-extrabold text-[#176B38]">Heures calculées à titre d’organisation</p>
            <p className="mt-1 text-sm font-bold">{heuresCalculees.join(" · ")}</p>
            <p className="mt-1 text-xs leading-5 text-[#53685C]">Vérifiez que l’intervalle et les heures correspondent exactement à la prescription. Ce calcul ne valide pas la pertinence médicale du rythme.</p>
          </div>
        </div>}

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#D8E5DC] bg-[#FBFDFC] p-3">
          <input type="checkbox" checked={rappels} onChange={e=>setRappels(e.target.checked)} className="mt-1 h-5 w-5 accent-[#0F6B3F]"/>
          <span><strong className="block text-sm">Activer les rappels de prise</strong><span className="mt-1 block text-xs leading-5 text-[#64776B]">Autorise NAXA à afficher un rappel dans l’application et, si le navigateur le permet, une notification système.</span></span>
        </label>

        {erreur && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{erreur}</p>}
        <button type="submit" disabled={enregistrement || !userId} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FFE23D] px-4 text-sm font-extrabold text-[#0B3D26] shadow-sm transition-transform active:scale-[0.99] disabled:opacity-60">
          <IconeNAXA name="check-circle" size={19}/>{enregistrement?"Enregistrement…":"Enregistrer le schéma"}
        </button>
      </form>

      <section className="naxa-enter rounded-[22px] border border-[#E9DDA2] bg-[#FFF9D9] p-4">
        <h2 className="text-sm font-extrabold">À propos des notifications</h2>
        <p className="mt-1 text-xs leading-5 text-[#5C5124]">Les rappels locaux fonctionnent tant que NAXA reste ouvert dans ce navigateur. Une notification système nécessite l’autorisation du navigateur. Pour garantir des rappels lorsque l’application est complètement fermée, il reste à connecter un service Push et une planification côté serveur : cette fonction n’est pas encore active.</p>
        {permission==="denied" && <p className="mt-2 text-xs font-bold text-[#7A3C16]">Les notifications sont bloquées dans les réglages du navigateur.</p>}
      </section>

      <section className="space-y-3 pt-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">Mes schémas enregistrés</h2>
          <span className="rounded-full bg-[#E1F4E7] px-3 py-1 text-xs font-extrabold text-[#176B38]">{posologies.length}</span>
        </div>
        {!posologies.length ? <div className="rounded-[22px] border border-dashed border-[#B9D2C2] bg-white px-5 py-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E1F4E7] text-[#0F6B3F]"><IconeNAXA name="clock" size={26}/></span>
          <p className="mt-3 font-extrabold">Aucun schéma pour le moment</p>
          <p className="mt-1 text-sm text-[#64776B]">Vos schémas enregistrés apparaîtront ici.</p>
        </div> : posologies.map(item=><article key={item.id} className="rounded-[22px] bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E1F4E7] text-[#0F6B3F]"><IconeNAXA name="pill" size={20}/></span>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold">{item.medicament}</h3>
              <p className="mt-1 text-sm text-[#53685C]">{item.dose} {item.unite} · {item.prises} prise{item.prises>1?"s":""}/jour</p>
              <p className="mt-2 text-sm font-extrabold text-[#0F6B3F]">{item.heures.join(" · ")}</p>
              <p className="mt-1 text-xs text-[#64776B]">{item.mode==="intervalle"?"Intervalle de "+item.intervalleHeures+" h":"Heures fixes"} · {item.rappels?"Rappels activés":"Rappels désactivés"}</p>
            </div>
            <button type="button" onClick={()=>supprimer(item.id)} aria-label={"Supprimer le schéma de "+item.medicament} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F8F5] text-[#0F6B3F]"><IconeNAXA name="trash" size={18}/></button>
          </div>
        </article>)}
      </section>
    </div>
  </main>;
}
