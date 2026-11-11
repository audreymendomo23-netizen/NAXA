"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { usePanier } from "@/lib/panier";

type Operation = {
  id: string;
  statut: string;
  mode: string;
  paiement_statut: string | null;
  commande_statut: string | null;
  total: number;
  expires_at: string | null;
  created_at: string;
  pharmacie_id: string;
  pharmacies: { nom: string; ville: string | null; quartier: string | null; adresse: string | null } | null;
  reservation_items: Array<{ quantite: number; produits: { nom: string; dosage: string | null; photo_url: string | null } | null }>;
};
type OperationEvent = { id: string; reservation_id: string; event_type: string; to_statut: string | null; occurred_at: string };
const STATUS: Record<string, string> = {
  en_attente: "En attente de confirmation", confirmee: "Confirmée par la pharmacie",
  payee: "Payée", retiree: "Terminée", expiree: "Expirée", annulee: "Annulée",
  en_attente_pharmacie: "En attente de la pharmacie", acceptee: "Acceptée",
  preparation: "En préparation", livreur_assigne: "Livreur assigné",
  en_livraison: "En livraison", livree: "Livrée", cancelled: "Annulée", expired: "Expirée",
};
const EVENT: Record<string, string> = {
  reservation_created: "Opération enregistrée", status_changed: "Statut mis à jour",
  payment_declared: "Paiement signalé", payment_verified: "Paiement vérifié",
  delivery_status_changed: "Livraison mise à jour",
};
const fmt = (value: string | null) => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Date non disponible";
const money = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value) || 0) + " FCFA";
type Filter = "all" | "active" | "pickup" | "done";

export function ClientOperations() {
  const router = useRouter();
  const { nombre } = usePanier();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [events, setEvents] = useState<OperationEvent[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let disposed = false;
    const load = async (quiet = false) => {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      const sb = supabaseBrowser();
      const { data: auth, error: authError } = await sb.auth.getUser();
      if (disposed) return;
      if (authError || !auth.user) {
        router.replace("/connexion?retour=%2Fclient%3Fonglet%3Dachats");
        return;
      }
      const { data, error: queryError } = await sb.from("reservations")
        .select("id,statut,mode,paiement_statut,commande_statut,total,expires_at,created_at,pharmacie_id,pharmacies(nom,ville,quartier,adresse),reservation_items(quantite,produits(nom,dosage,photo_url))")
        .eq("client_id", auth.user.id).order("created_at", { ascending: false }).limit(200);
      if (disposed) return;
      if (queryError) {
        setError("Nous n’arrivons pas à récupérer vos opérations. Réessayez dans un instant.");
        setLoading(false); setRefreshing(false);
        return;
      }
      const rows = (data ?? []) as unknown as Operation[];
      setOperations(rows);
      setError("");
      if (rows.length) {
        const { data: eventRows } = await sb.from("reservation_events")
          .select("id,reservation_id,event_type,to_statut,occurred_at")
          .in("reservation_id", rows.map((row) => row.id))
          .order("occurred_at", { ascending: false }).limit(1000);
        if (!disposed) setEvents((eventRows ?? []) as OperationEvent[]);
      } else setEvents([]);
      if (!disposed) { setLoading(false); setRefreshing(false); }
    };
    void load();
    const channel = supabaseBrowser().channel("client-operations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => { void load(true); })
      .subscribe();
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 30000);
    return () => { disposed = true; window.clearInterval(poll); void supabaseBrowser().removeChannel(channel); };
  }, [router]);

  const visible = useMemo(() => operations.filter((operation) => {
    const status = operation.commande_statut || operation.statut;
    const done = ["retiree", "livree", "annulee", "annule", "expiree", "expired", "cancelled"].includes(status);
    const pickup = operation.mode !== "commande" && ["confirmee", "preparation", "prete"].includes(status);
    const active = !done;
    const matchesFilter = filter === "all" || (filter === "active" && active) || (filter === "pickup" && pickup) || (filter === "done" && done);
    const text = [operation.id, operation.mode, status, operation.pharmacies?.nom ?? "", operation.pharmacies?.ville ?? "", ...operation.reservation_items.map((item) => item.produits?.nom ?? "")].join(" ").toLocaleLowerCase("fr");
    return matchesFilter && text.includes(query.trim().toLocaleLowerCase("fr"));
  }), [operations, filter, query]);

  const activeCount = operations.filter((op) => !["retiree", "livree", "annulee", "annule", "expiree", "expired", "cancelled"].includes(op.commande_statut || op.statut)).length;
  const pickupCount = operations.filter((op) => op.mode !== "commande" && ["confirmee", "preparation", "prete"].includes(op.commande_statut || op.statut)).length;
  const doneCount = operations.length - activeCount;

  return <main className="min-h-dvh bg-[#F4F8F5] px-4 pb-[calc(112px+env(safe-area-inset-bottom,0px))] text-[#123A28]">
    <style jsx>{`
      @keyframes riseIn { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
      @keyframes softPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,226,61,.08) } 50% { box-shadow: 0 0 0 7px rgba(255,226,61,0) } }
      .op-enter { animation: riseIn .42s cubic-bezier(.2,.8,.2,1) both }
      .op-pulse { animation: softPulse 2.8s ease-in-out infinite }
      @media (prefers-reduced-motion: reduce) { .op-enter, .op-pulse { animation: none !important } }
    `}</style>
    <div className="mx-auto max-w-5xl pt-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#0F6B3F]">Espace client · NAXA</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Mes opérations</h1></div>
        <Link href="/panier" className="op-pulse inline-flex shrink-0 items-center gap-2 rounded-full bg-[#FFE23D] px-4 py-3 text-sm font-extrabold text-[#0B3D26] shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6B3F]"><span aria-hidden="true">🛒</span> Panier <span className="rounded-full bg-[#0B3D26] px-2 py-0.5 text-xs text-white">{nombre}</span></Link>
      </div>
      <section className="op-enter relative isolate overflow-hidden rounded-[28px] bg-[#0B3D26] shadow-[0_18px_50px_rgba(11,61,38,.16)]">
        <img src="https://pikaso.cdnpk.net/private/production/5833929439/3zclzbzrey-png16.png?token=exp=1793145600~hmac=4fe1ad2d5bcd0f12ba39d673562a2dee9559600f21b8ca5183a26fd6d41e2b14" alt="Une cliente récupère sa commande auprès d’une équipe de pharmacie" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0B3D26]/95 via-[#0B3D26]/80 to-[#0B3D26]/25" />
        <div className="max-w-xl px-5 py-8 text-white sm:px-8 sm:py-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur"><span className="h-2 w-2 rounded-full bg-[#FFE23D]" /> Suivi en un seul endroit</span>
          <h2 className="mt-4 text-2xl font-black leading-tight sm:text-4xl">Chaque étape, en toute clarté.</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/85 sm:text-base">Suivez les confirmations, la préparation et le retrait ou la livraison de vos opérations déjà engagées.</p>
          <Link href="/panier" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#FFE23D] px-4 py-3 font-extrabold text-[#0B3D26] transition duration-200 hover:translate-y-[-2px] hover:shadow-lg">Ouvrir le panier <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="pointer-events-none absolute bottom-4 right-5 hidden h-20 w-20 rounded-full border border-white/25 sm:block" />
        <div className="pointer-events-none absolute bottom-9 right-10 hidden h-10 w-10 rounded-full bg-[#FFE23D]/80 sm:block" />
      </section>

      <section aria-label="Résumé de mes opérations" className="op-enter mt-5 grid grid-cols-3 gap-2 sm:gap-3" style={{ animationDelay: "80ms" }}>
        {[{label:"En cours",value:activeCount,icon:"◷"},{label:"À retirer",value:pickupCount,icon:"⌖"},{label:"Terminées",value:doneCount,icon:"✓"}].map((metric) => <article key={metric.label} className="rounded-2xl border border-[#0F6B3F]/10 bg-white p-3 shadow-[0_6px_20px_rgba(11,61,38,.035)] sm:p-4"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E6F4EA] text-lg font-black text-[#0F6B3F]">{metric.icon}</span><p className="mt-3 text-2xl font-black tabular-nums sm:text-3xl">{loading ? "—" : metric.value}</p><p className="mt-0.5 text-[11px] font-semibold text-slate-500 sm:text-sm">{metric.label}</p></article>)}
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black">Votre parcours</h2><p className="mt-1 text-sm text-slate-600">Les statuts proviennent des opérations enregistrées.</p></div>{refreshing && <span role="status" className="text-xs font-semibold text-[#0F6B3F]">Actualisation…</span>}</div>
        <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-[#0F6B3F] focus-within:ring-2 focus-within:ring-[#0F6B3F]/10"><span aria-hidden="true" className="text-lg">⌕</span><span className="sr-only">Rechercher une opération</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pharmacie, médicament ou référence…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" /></label>
        <div role="tablist" aria-label="Filtrer les opérations" className="mt-3 flex gap-2 overflow-x-auto pb-1">{([{id:"all",label:"Toutes"},{id:"active",label:"En cours"},{id:"pickup",label:"À retirer"},{id:"done",label:"Terminées"}] as const).map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={filter===tab.id} onClick={() => setFilter(tab.id)} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition duration-200 ${filter===tab.id?"bg-[#0F6B3F] text-white shadow-md shadow-[#0F6B3F]/15":"border border-slate-200 bg-white text-slate-600 hover:border-[#0F6B3F]/40"}`}>{tab.label}</button>)}</div>
      </section>

      {error && <section role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-bold">Chargement interrompu</p><p className="mt-1">{error}</p><button type="button" onClick={() => window.location.reload()} className="mt-3 rounded-xl border border-red-300 px-3 py-2 font-bold">Réessayer</button></section>}
      {loading ? <div className="mt-4 space-y-3" aria-label="Chargement des opérations"><div className="h-36 animate-pulse rounded-2xl bg-white"/><div className="h-36 animate-pulse rounded-2xl bg-white"/></div> : !error && visible.length === 0 ? <section className="op-enter mt-4 rounded-3xl border border-dashed border-[#0F6B3F]/25 bg-white px-5 py-10 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E6F4EA] text-3xl">🧾</div><h3 className="mt-4 text-lg font-extrabold">{operations.length ? "Aucune opération dans ce filtre" : "Votre prochaine étape commence ici"}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">{operations.length ? "Essayez un autre statut ou une recherche plus courte." : "Les réservations et commandes confirmées apparaîtront ici avec leur chronologie."}</p>{operations.length ? <button type="button" onClick={() => {setFilter("all");setQuery("");}} className="mt-4 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">Réinitialiser les filtres</button> : <Link href="/panier" className="mt-4 inline-flex rounded-xl bg-[#0F6B3F] px-4 py-3 text-sm font-extrabold text-white">Ouvrir le panier</Link>}</section> : <div className="mt-4 space-y-3">{visible.map((operation, index) => {
        const status = operation.commande_statut || operation.statut;
        const done = ["retiree", "livree", "annulee", "annule", "expiree", "expired", "cancelled"].includes(status);
        const timeline = events.filter((event) => event.reservation_id === operation.id).sort((a,b) => new Date(a.occurred_at).getTime()-new Date(b.occurred_at).getTime());
        const remaining = operation.expires_at ? new Date(operation.expires_at).getTime()-Date.now() : null;
        return <article key={operation.id} className="op-enter overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_8px_28px_rgba(11,61,38,.045)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(11,61,38,.09)]" style={{animationDelay:Math.min(index,8)*45+"ms"}}>
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E6F4EA] text-xl">{operation.mode==="commande"?"🚚":"🛍️"}</div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold">{operation.mode==="commande"?"Commande":"Réservation"} · {operation.pharmacies?.nom || "Pharmacie partenaire"}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${done?"bg-slate-100 text-slate-600":"bg-[#FFF8C8] text-[#5B4B00]"}`}>{STATUS[status] || status || "Statut indisponible"}</span></div><p className="mt-1 text-xs text-slate-500">{fmt(operation.created_at)} · Réf. {operation.id.slice(0,8).toUpperCase()}</p><p className="mt-2 text-sm text-slate-600">{[operation.pharmacies?.quartier,operation.pharmacies?.ville].filter(Boolean).join(" · ") || "Localisation communiquée par la pharmacie"}</p></div>
            </div>
            <ul className="mt-4 space-y-2">{operation.reservation_items.slice(0,3).map((item,index) => <li key={operation.id+"-"+index} className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 text-slate-700">{item.quantite} × {item.produits?.nom || "Article"}{item.produits?.dosage ? " · "+item.produits.dosage : ""}</span><span className="shrink-0 text-xs font-semibold text-slate-500">Qté {item.quantite}</span></li>)}{operation.reservation_items.length>3 && <li className="text-xs font-semibold text-slate-500">+ {operation.reservation_items.length-3} autre(s) article(s)</li>}</ul>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Montant enregistré</p><p className="mt-0.5 text-lg font-black">{money(operation.total)}</p></div><Link href={"/reservation/"+operation.id} className="inline-flex items-center gap-2 rounded-xl bg-[#0F6B3F] px-3.5 py-3 text-sm font-extrabold text-white transition hover:bg-[#0B3D26] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6B3F]">Voir le suivi <span aria-hidden="true">↗</span></Link></div>
            {remaining !== null && !done && operation.mode!=="commande" && ["en_attente","confirmee"].includes(operation.statut) && remaining>0 && remaining<=30*60*1000 && <p className="mt-3 rounded-xl bg-[#FFF1DE] p-3 text-xs font-bold text-[#8B4A09]">⏳ Rappel : cette réservation expire dans {Math.ceil(remaining/60000)} min. Contactez la pharmacie depuis le suivi.</p>}
            {timeline.length>0 && <details className="mt-3 rounded-2xl bg-[#F7FAF7] px-3 py-3"><summary className="cursor-pointer list-none text-sm font-bold text-[#0F6B3F]">Chronologie de l’opération <span className="ml-1 text-xs text-slate-500">({timeline.length} événements)</span></summary><ol className="mt-3 space-y-3 border-l-2 border-[#CFE5D4] pl-4">{timeline.map((event) => <li key={event.id} className="relative text-sm"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#0F6B3F]"/><p className="font-bold">{EVENT[event.event_type] || "Mise à jour de l’opération"}</p><p className="mt-0.5 text-xs text-slate-500">{fmt(event.occurred_at)}{event.to_statut ? " · "+(STATUS[event.to_statut]||event.to_statut) : ""}</p></li>)}</ol></details>}
          </div>
        </article>;
      })}</div>}

      <section className="mt-7 grid gap-3 sm:grid-cols-2">
        <Link href="/client/historique" className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[#0F6B3F]/35"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E6F4EA] text-xl">↺</span><span className="min-w-0 flex-1"><strong className="block text-sm">Historique</strong><span className="mt-1 block text-xs text-slate-500">Retrouver la chronologie passée</span></span><span className="text-xl transition-transform group-hover:translate-x-1">›</span></Link>
        <Link href="/client/profil/factures" className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[#0F6B3F]/35"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF8C8] text-xl">▤</span><span className="min-w-0 flex-1"><strong className="block text-sm">Factures et tickets</strong><span className="mt-1 block text-xs text-slate-500">Consulter les justificatifs disponibles</span></span><span className="text-xl transition-transform group-hover:translate-x-1">›</span></Link>
      </section>
      <section className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-extrabold text-violet-950">Examens médicaux</p><p className="mt-1 text-sm text-violet-900/80">Consulter vos tickets, résultats validés et messages des centres.</p></div><Link href="/client/examens" className="inline-flex min-h-10 items-center rounded-xl bg-violet-800 px-4 text-sm font-bold text-white">Mes examens →</Link></div></section>
      <p className="mt-5 text-center text-xs leading-5 text-slate-500">Cette page suit les opérations déjà engagées. Pour démarrer une réservation ou une commande, ouvrez le panier. Les étapes affichées correspondent aux événements enregistrés par NAXA.</p>
    </div>
  </main>;
}
