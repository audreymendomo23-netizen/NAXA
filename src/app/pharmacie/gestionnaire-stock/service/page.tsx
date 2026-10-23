import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { GestionnaireStockSidebar } from "@/components/pharmacie/GestionnaireStockSidebar";
import {
  ouvrirServiceGestionStock,
  fermerServiceGestionStock,
  enregistrerComptageOuvertureServiceGestionStock,
} from "../actions";

type Pharmacy = { id: string; nom: string | null };
type Session = {
  id: string; pharmacie_id: string; gestionnaire_id: string;
  opened_at: string; closed_at: string | null; status: "open" | "closed";
  opening_note: string | null; closing_note: string | null;
};
type CountRow = {
  id: number; session_id: string; phase: "opening" | "closing";
  produit_id: string; expected_quantity: number; counted_quantity: number | null;
  variance: number | null;
  produits: { nom: string; dosage: string | null } | null;
};
type StockRow = {
  pharmacie_id: string; produit_id: string; quantite: number;
  produits: { nom: string; dosage: string | null } | null;
};

export default async function ServiceGestionStockPage({
  searchParams,
}: { searchParams: { ok?: string; erreur?: string } }) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/gestionnaire-stock/service");

  const { data: profile } = await sb.from("profiles")
    .select("role,fonction_interne,actif").eq("id", auth.user.id).maybeSingle();
  const role = String(profile?.role ?? "").toLowerCase();
  const fn = String(profile?.fonction_interne ?? "").toLowerCase();
  const { data: assignmentRows, error: assignmentError } = await sb.from("naxa_professional_assignments")
    .select("pharmacie_id,fonction,commence_at,expire_at").eq("profile_id", auth.user.id)
    .eq("statut","active").in("fonction",["gestionnaire_stock","magasinier"]);
  const now = Date.now();
  const assignedIds = (assignmentRows ?? []).filter(a => new Date(a.commence_at).getTime() <= now && new Date(a.expire_at).getTime() > now).map(a => a.pharmacie_id);
  if (!profile || profile.actif === false ||
      !(role === "admin" || role === "promoteur" ||
        ["pharmacien", "pharmacien_assistant", "responsable", "gestionnaire_stock", "magasinier"].includes(fn) || assignedIds.length > 0)) {
    redirect("/");
  }

  const { data: rawPharmacies, error: scopeError } = await sb.rpc("my_pharmacies");
  const ids = [...new Set([...(Array.isArray(rawPharmacies) ? rawPharmacies : [])
    .filter((id): id is string => typeof id === "string"), ...assignedIds])];
  const { data: pharmaciesData } = ids.length
    ? await sb.from("pharmacies").select("id,nom").in("id", ids)
    : { data: [] as Pharmacy[] };
  const pharmacies = (pharmaciesData ?? []) as Pharmacy[];
  if ((scopeError && assignedIds.length === 0) || assignmentError || !ids.length) return <main className="p-5">Périmètre pharmacie indisponible. Aucune donnée n’est affichée.</main>;

  const { data: sessionsData, error: sessionsError } = await sb.from("stock_service_sessions")
    .select("id,pharmacie_id,gestionnaire_id,opened_at,closed_at,status,opening_note,closing_note")
    .in("pharmacie_id", ids).eq("gestionnaire_id", auth.user.id)
    .order("opened_at", { ascending: false }).limit(30);
  const sessions = (sessionsData ?? []) as Session[];
  const activeSessions = sessions.filter((s) => s.status === "open" && !s.closed_at);
  const active = activeSessions[0] ?? null;

  const [{ data: countData, error: countsError }, { data: stockData, error: stockError }] = active
    ? await Promise.all([
        sb.from("stock_service_inventory_counts")
          .select("id,session_id,phase,produit_id,expected_quantity,counted_quantity,variance,produits(nom,dosage)")
          .eq("session_id", active.id).eq("phase", "opening").order("produit_id"),
        sb.from("stocks").select("pharmacie_id,produit_id,quantite,produits(nom,dosage)")
          .eq("pharmacie_id", active.pharmacie_id).order("produit_id"),
      ])
    : [{ data: [] as unknown as CountRow[], error: null }, { data: [] as unknown as StockRow[], error: null }];
  const openingCounts = (countData ?? []) as unknown as CountRow[];
  const stockRows = (stockData ?? []) as unknown as StockRow[];
  const openingComplete = openingCounts.length > 0 && openingCounts.every((line) => line.counted_quantity !== null);
  const pharmacyName = (id: string) => pharmacies.find((p) => p.id === id)?.nom || "Pharmacie autorisée";

  const successMessages: Record<string, string> = {
    ouvert: "Service ouvert. Effectuez maintenant l’inventaire physique de prise de service.",
    inventaire_ouverture: "Inventaire de prise de service enregistré. Le stock physique n’a pas été modifié.",
    ferme: "Inventaire de fin de service enregistré et service clôturé.",
  };
  const errorMessages: Record<string, string> = {
    ouverture: "Ouverture refusée. Vérifiez le périmètre et l’existence d’un service déjà ouvert.",
    comptage_ouverture: "Comptage d’ouverture refusé. Vérifiez que chaque référence possède une quantité entière positive ou nulle.",
    comptage_fermeture: "Comptage de fermeture refusé. Vérifiez toutes les quantités saisies.",
    fermeture: "Clôture refusée. Terminez d’abord le comptage de prise et de fin de service.",
  };

  return <main className="min-h-screen bg-[#F4F8F5] p-4 text-slate-900">
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="rounded-2xl bg-[#0B3D26] p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">NAXA · Poste de travail</p>
        <h1 className="mt-1 text-2xl font-black">Prise / fin de service</h1>
        <p className="mt-2 max-w-3xl text-sm text-emerald-50">Un inventaire physique est demandé à l’ouverture puis à la clôture. Les écarts sont tracés, mais ne modifient pas automatiquement le stock vendable.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <GestionnaireStockSidebar active="/pharmacie/gestionnaire-stock/service" />
        <section className="min-w-0 space-y-4">
          {searchParams.ok && successMessages[searchParams.ok] && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900">{successMessages[searchParams.ok]}</p>}
          {searchParams.erreur && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{errorMessages[searchParams.erreur] || "Opération refusée."}</p>}
          {(sessionsError || (active && (countsError || stockError))) && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">Lecture incomplète : aucune clôture ne doit être considérée comme validée.</p>}

          {active && <section className="rounded-2xl border bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-sm font-bold text-emerald-800">SERVICE EN COURS</p><h2 className="mt-1 text-xl font-black">{pharmacyName(active.pharmacie_id)}</h2><p className="text-sm text-slate-600">Ouvert le {new Date(active.opened_at).toLocaleString("fr-FR")}</p></div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">{openingComplete ? "Prise de service comptée" : "Inventaire d’ouverture requis"}</span>
            </div>
            {!openingComplete && <form action={enregistrerComptageOuvertureServiceGestionStock} className="mt-5 space-y-3">
              <input type="hidden" name="session_id" value={active.id}/>
              <div><h3 className="font-extrabold">Inventaire physique de prise de service</h3><p className="text-sm text-slate-600">Comptez chaque référence avant de commencer les opérations. La colonne « théorique » est un repère, pas une quantité à recopier sans vérification.</p></div>
              <div className="space-y-2">{openingCounts.map((line) => <label key={line.produit_id} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_100px_140px] sm:items-center">
                <span className="font-semibold">{line.produits?.nom || line.produit_id}{line.produits?.dosage ? <span className="block text-sm font-normal text-slate-500">{line.produits.dosage}</span> : null}</span>
                <span className="text-sm text-slate-600">Théorique : {line.expected_quantity}</span>
                <span className="text-sm font-bold">Compté<input name={"count_"+line.produit_id} type="number" min="0" step="1" required className="mt-1 w-full rounded-lg border p-2" defaultValue={line.counted_quantity ?? ""}/></span>
              </label>)}</div>
              {openingCounts.length === 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm">Aucune référence n’est rattachée à ce stock. Vérifiez le catalogue avant de poursuivre.</p>}
              <button disabled={!openingCounts.length} className="rounded-xl bg-[#0B3D26] px-4 py-3 font-bold text-white disabled:opacity-50">Enregistrer l’inventaire d’ouverture</button>
            </form>}

            {openingComplete && <div className="mt-5 space-y-4">
              <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">Inventaire d’ouverture enregistré. Les écarts restent consultables dans l’historique et ne sont pas appliqués automatiquement.</div>
              <form action={fermerServiceGestionStock} className="space-y-3">
                <input type="hidden" name="session_id" value={active.id}/>
                <div><h3 className="font-extrabold">Inventaire physique de fin de service</h3><p className="text-sm text-slate-600">Comptez les quantités présentes au moment de la clôture. La fermeture est refusée si une quantité manque.</p></div>
                <div className="space-y-2">{stockRows.map((line) => <label key={line.produit_id} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_100px_140px] sm:items-center">
                  <span className="font-semibold">{line.produits?.nom || line.produit_id}{line.produits?.dosage ? <span className="block text-sm font-normal text-slate-500">{line.produits.dosage}</span> : null}</span>
                  <span className="text-sm text-slate-600">Théorique : {line.quantite}</span>
                  <span className="text-sm font-bold">Compté<input name={"count_"+line.produit_id} type="number" min="0" step="1" required className="mt-1 w-full rounded-lg border p-2" defaultValue=""/></span>
                </label>)}</div>
                <label className="block text-sm font-bold">Note de fin (facultative)<textarea name="note_fin" maxLength={500} rows={3} className="mt-1 w-full rounded-xl border p-3" placeholder="Écarts, anomalies, transmission, consignes…"/></label>
                <button className="rounded-xl bg-[#0B3D26] px-4 py-3 font-bold text-white">Enregistrer l’inventaire et clôturer le service</button>
              </form>
            </div>}
          </section>}

          {!active && <section className="rounded-2xl border bg-white p-5">
            <h2 className="text-xl font-black">Prendre le service</h2>
            <p className="mt-1 text-sm text-slate-600">L’ouverture crée un relevé de référence. Le service ne peut être clôturé qu’après les deux comptages physiques.</p>
            <form action={ouvrirServiceGestionStock} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <label className="text-sm font-bold">Pharmacie<select name="pharmacie_id" required className="mt-1 w-full rounded-xl border p-3">{pharmacies.map((p) => <option key={p.id} value={p.id}>{p.nom || p.id}</option>)}</select></label>
              <label className="text-sm font-bold">Note de prise de service<textarea name="note_debut" maxLength={500} rows={1} className="mt-1 w-full rounded-xl border p-3" placeholder="État initial, consignes…"/></label>
              <button className="rounded-xl bg-[#0B3D26] px-4 py-3 font-bold text-white">Ouvrir le service</button>
            </form>
          </section>}

          <section className="rounded-2xl border bg-white p-5"><h2 className="font-extrabold">Historique des services</h2><div className="mt-3 space-y-2">
            {sessions.filter((s) => s.status === "closed").map((s) => <article key={s.id} className="rounded-xl border p-3"><p className="font-bold">{pharmacyName(s.pharmacie_id)} · Clôturé</p><p className="text-sm text-slate-600">Début : {new Date(s.opened_at).toLocaleString("fr-FR")} · Fin : {s.closed_at ? new Date(s.closed_at).toLocaleString("fr-FR") : "—"}</p>{s.closing_note && <p className="mt-1 text-sm">{s.closing_note}</p>}</article>)}
            {!sessions.some((s) => s.status === "closed") && <p className="text-sm text-slate-500">Aucun service clôturé dans cet historique.</p>}
          </div></section>
        </section>
      </div>
    </div>
  </main>;
}
