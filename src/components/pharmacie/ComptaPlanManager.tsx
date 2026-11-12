"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Pharmacy = { pharmacie_id: string; pharmacie_nom: string };
type Account = { id: string; code: string; libelle: string; classe: number | null; statut: string; source_validation: string | null; valide_le: string | null };
type Mapping = { id: string; evenement_type: string; sens: "debit" | "credit"; compte_id: string | null; compte_code: string | null; compte_libelle: string | null; statut: string; valide_du: string | null; valide_jusquau: string | null };
type PlanData = { comptes: Account[]; mappings: Mapping[]; ecriture_autorisee: boolean; pharmacie_id: string };
type Period = { id: string; date_debut: string; date_fin: string; statut: "ouverte" | "cloturee"; cloturee_le: string | null };
type Journal = { id: string; evenement_type: string; journal_code: string | null; statut: string; valide_du: string | null; valide_jusquau: string | null };
type ConfigData = { periodes: Period[]; journaux: Journal[] };
const ACCOUNTING_EVENTS = [
  { value: "vente_encaissee", label: "Vente encaissée" },
  { value: "depense_validee", label: "Dépense validée" },
  { value: "vente_annulee", label: "Annulation de vente" },
  { value: "assurance_prise_en_charge", label: "Prise en charge Assurance" },
  { value: "assurance_remboursement_recu", label: "Remboursement Assurance reçu" },
] as const;
const MAPPING_EVENTS = ACCOUNTING_EVENTS.filter(item => item.value !== "vente_annulee");

export function ComptaPlanManager({ pharmacies, initialPharmacy, initialData, initialConfig, role }: {
  pharmacies: Pharmacy[]; initialPharmacy: string; initialData: PlanData | null; initialConfig: ConfigData | null; role: "promoteur" | "comptable";
}) {
  const router = useRouter();
  const [pharmacyId, setPharmacyId] = useState(initialPharmacy);
  const [data, setData] = useState<PlanData | null>(initialData);
  const [config, setConfig] = useState<ConfigData | null>(initialConfig);
  const [configAvailable, setConfigAvailable] = useState(initialConfig !== null);
  const [journalEvent, setJournalEvent] = useState<string>("vente_encaissee");
  const [journalCode, setJournalCode] = useState("");
  const [journalFrom, setJournalFrom] = useState("");
  const [journalUntil, setJournalUntil] = useState("");
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodUntil, setPeriodUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [code, setCode] = useState("");
  const [libelle, setLibelle] = useState("");
  const [classe, setClasse] = useState("");
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [eventType, setEventType] = useState("");
  const [sens, setSens] = useState<"debit" | "credit">("debit");
  const [compteId, setCompteId] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);

  const validatedAccounts = useMemo(() => (data?.comptes ?? []).filter(a => a.statut === "valide"), [data]);

  async function reload(id = pharmacyId) {
    if (!id) { setData(null); return; }
    const [planResult, configResult] = await Promise.all([
      supabaseBrowser().rpc("compta_plan_lire", { p_pharmacie: id }),
      supabaseBrowser().rpc("compta_config_lire", { p_pharmacie: id }),
    ]);
    if (planResult.error) throw planResult.error;
    setData(planResult.data as PlanData);
    if (configResult.error) {
      setConfig(null);
      setConfigAvailable(false);
    } else {
      setConfig(configResult.data as ConfigData);
      setConfigAvailable(true);
    }
  }

  useEffect(() => {
    if (!pharmacyId) return;
    void reload(pharmacyId).catch(e => setError(e instanceof Error ? e.message : "Chargement impossible."));
    // pharmacy selection is the only trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pharmacyId]);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); await reload(); setNotice(success); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Opération comptable impossible."); }
    finally { setBusy(false); }
  }

  async function saveAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await run(async () => {
      const { error: rpcError } = await supabaseBrowser().rpc("compta_plan_enregistrer_compte", {
        p_pharmacie: pharmacyId, p_id: editingAccountId, p_code: code.trim(), p_libelle: libelle.trim(),
        p_classe: classe ? Number(classe) : null,
      });
      if (rpcError) throw rpcError;
      setCode(""); setLibelle(""); setClasse(""); setEditingAccountId(null);
    }, "Compte enregistré en attente de validation.");
  }

  async function validatePlan() {
    await run(async () => {
      const { data: count, error: rpcError } = await supabaseBrowser().rpc("compta_plan_valider_plan", { p_pharmacie: pharmacyId });
      if (rpcError) throw rpcError;
      setNotice(`Plan comptable validé : ${count} compte(s).`);
    }, "Plan comptable validé.");
  }

  async function validateAccount(id: string) {
    await run(async () => {
      const { error: rpcError } = await supabaseBrowser().rpc("compta_plan_valider_compte", { p_pharmacie: pharmacyId, p_compte: id });
      if (rpcError) throw rpcError;
    }, "Compte validé.");
  }

  async function saveMapping(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await run(async () => {
      const { error: rpcError } = await supabaseBrowser().rpc("compta_plan_enregistrer_mapping", {
        p_pharmacie: pharmacyId, p_id: editingMappingId, p_evenement_type: eventType.trim(), p_sens: sens,
        p_compte: compteId, p_valide_du: validFrom || null, p_valide_jusquau: validUntil || null,
      });
      if (rpcError) throw rpcError;
      setEventType(""); setCompteId(""); setValidFrom(""); setValidUntil(""); setEditingMappingId(null);
    }, "Mapping enregistré en attente de validation.");
  }

  async function validateMapping(id: string) {
    await run(async () => {
      const { error: rpcError } = await supabaseBrowser().rpc("compta_plan_valider_mapping", { p_pharmacie: pharmacyId, p_mapping: id });
      if (rpcError) throw rpcError;
    }, "Mapping validé.");
  }

  async function saveJournal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await run(async () => {
      const { error: rpcError } = await supabaseBrowser().rpc("compta_config_enregistrer_journal", {
        p_pharmacie: pharmacyId, p_id: editingJournalId, p_evenement_type: journalEvent,
        p_journal_code: journalCode.trim(), p_valide_du: journalFrom, p_valide_jusquau: journalUntil || null,
      });
      if (rpcError) throw rpcError;
      setJournalCode(""); setJournalFrom(""); setJournalUntil(""); setEditingJournalId(null);
    }, "Journal enregistré en attente de validation.");
  }

  async function validateJournal(id: string) {
    await run(async () => {
      const { error: rpcError } = await supabaseBrowser().rpc("compta_config_valider_journal", {
        p_pharmacie: pharmacyId, p_parametre: id,
      });
      if (rpcError) throw rpcError;
    }, "Journal validé.");
  }

  async function openPeriod(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await run(async () => {
      const { error: rpcError } = await supabaseBrowser().rpc("compta_config_ouvrir_periode", {
        p_pharmacie: pharmacyId, p_date_debut: periodFrom, p_date_fin: periodUntil,
      });
      if (rpcError) throw rpcError;
      setPeriodFrom(""); setPeriodUntil("");
    }, "Période comptable ouverte.");
  }

  const canWrite = data?.ecriture_autorisee === true;
  return <div className="space-y-5">
    {role === "promoteur" && pharmacies.length > 1 ? <label className="block rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold">Pharmacie du réseau
      <select className="mt-2 w-full rounded-lg border border-slate-300 p-3" value={pharmacyId} onChange={e => setPharmacyId(e.target.value)}>
        {pharmacies.map(p => <option key={p.pharmacie_id} value={p.pharmacie_id}>{p.pharmacie_nom}</option>)}
      </select>
    </label> : pharmacies.length === 1 ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm">Pharmacie : <strong>{pharmacies[0].pharmacie_nom}</strong></p> : null}

    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold">Plan comptable</h2>{canWrite && (data?.comptes ?? []).some(a => a.statut === "a_valider") ? <button disabled={busy} onClick={() => void validatePlan()} className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Valider le plan comptable</button> : null}<span className={canWrite ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800" : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"}>{canWrite ? "Écriture & validation autorisées" : "Lecture seulement"}</span></div>
      {canWrite && <form onSubmit={saveAccount} className="mt-4 grid gap-3 sm:grid-cols-4">
        <input required maxLength={32} className="rounded-lg border p-3" placeholder="Code du compte" value={code} onChange={e => setCode(e.target.value)} />
        <input required maxLength={180} className="rounded-lg border p-3 sm:col-span-2" placeholder="Libellé" value={libelle} onChange={e => setLibelle(e.target.value)} />
        <select className="rounded-lg border p-3" value={classe} onChange={e => setClasse(e.target.value)}><option value="">Classe (facultatif)</option>{[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>Classe {n}</option>)}</select>
        <button disabled={busy} className="rounded-lg bg-naxa-green-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-4">{editingAccountId ? "Enregistrer les modifications" : "Ajouter un compte"}</button>
      </form>}
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-2">Code</th><th className="p-2">Libellé</th><th className="p-2">Classe</th><th className="p-2">État</th><th className="p-2">Action</th></tr></thead><tbody>
        {(data?.comptes ?? []).map(a => <tr key={a.id} className="border-b last:border-0"><td className="p-2 font-semibold">{a.code}</td><td className="p-2">{a.libelle}</td><td className="p-2">{a.classe ?? "—"}</td><td className="p-2">{a.statut === "valide" ? "Validé" : a.statut === "a_valider" ? "À valider" : a.statut}</td><td className="p-2">{canWrite && a.statut === "a_valider" ? <div className="flex gap-2"><button disabled={busy} onClick={() => { setEditingAccountId(a.id); setCode(a.code); setLibelle(a.libelle); setClasse(a.classe ? String(a.classe) : ""); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold">Modifier</button><button disabled={busy} onClick={() => void validateAccount(a.id)} className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-900 disabled:opacity-50">Valider</button></div> : "—"}</td></tr>)}
        {(!data?.comptes?.length) && <tr><td colSpan={5} className="p-4 text-slate-500">Aucun compte enregistré.</td></tr>}
      </tbody></table></div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">Journaux comptables</h2>
        <span className="text-xs text-slate-500">Codes à définir et valider par pharmacie</span>
      </div>
      {!configAvailable && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">La configuration des journaux et périodes sera disponible après application de la migration comptable correspondante sur cette base.</p>}
      {canWrite && configAvailable && <form onSubmit={saveJournal} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Événement
          <select required className="mt-1 w-full rounded-lg border p-3" value={journalEvent} onChange={e => setJournalEvent(e.target.value)}>
            {ACCOUNTING_EVENTS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Code du journal
          <input required maxLength={20} pattern="[A-Za-z0-9_-]{1,20}" className="mt-1 w-full rounded-lg border p-3" placeholder="Ex. VT, AC, OD" value={journalCode} onChange={e => setJournalCode(e.target.value)} />
        </label>
        <label className="text-sm">Valide à partir du<input required type="date" className="mt-1 w-full rounded-lg border p-3" value={journalFrom} onChange={e => setJournalFrom(e.target.value)} /></label>
        <label className="text-sm">Valide jusqu’au (facultatif)<input type="date" className="mt-1 w-full rounded-lg border p-3" value={journalUntil} onChange={e => setJournalUntil(e.target.value)} /></label>
        <button disabled={busy} className="rounded-lg bg-naxa-green-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{editingJournalId ? "Modifier le journal en attente" : "Ajouter le journal"}</button>
      </form>}
      <div className="mt-4 space-y-2">
        {(config?.journaux ?? []).map(j => <article key={j.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm">
          <div><p className="font-semibold">{ACCOUNTING_EVENTS.find(item => item.value === j.evenement_type)?.label ?? j.evenement_type} · {j.journal_code ?? "Code absent"}</p>
            <p className="text-xs text-slate-500">{j.statut === "valide" ? "Validé" : j.statut === "a_valider" ? "À valider" : j.statut} · {j.valide_du ?? "date absente"} → {j.valide_jusquau ?? "sans fin"}</p></div>
          {canWrite && j.statut === "a_valider" ? <div className="flex gap-2">
            <button disabled={busy} onClick={() => { setEditingJournalId(j.id); setJournalEvent(j.evenement_type); setJournalCode(j.journal_code ?? ""); setJournalFrom(j.valide_du ?? ""); setJournalUntil(j.valide_jusquau ?? ""); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold">Modifier</button>
            <button disabled={busy} onClick={() => void validateJournal(j.id)} className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-900">Valider</button>
          </div> : null}
        </article>)}
        {!config?.journaux?.length && <p className="text-sm text-slate-500">Aucun journal configuré.</p>}
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-extrabold">Périodes comptables</h2>
      {canWrite && configAvailable && <form onSubmit={openPeriod} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Date de début<input required type="date" className="mt-1 w-full rounded-lg border p-3" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} /></label>
        <label className="text-sm">Date de fin<input required type="date" min={periodFrom || undefined} className="mt-1 w-full rounded-lg border p-3" value={periodUntil} onChange={e => setPeriodUntil(e.target.value)} /></label>
        <button disabled={busy || !periodFrom || !periodUntil || periodUntil < periodFrom} className="rounded-lg bg-naxa-green-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">Ouvrir la période</button>
      </form>}
      <div className="mt-4 space-y-2">
        {(config?.periodes ?? []).map(p => <article key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm">
          <p className="font-semibold">{p.date_debut} → {p.date_fin}</p>
          <span className={p.statut === "ouverte" ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800" : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"}>{p.statut === "ouverte" ? "Ouverte" : "Clôturée"}</span>
        </article>)}
        {!config?.periodes?.length && <p className="text-sm text-slate-500">Aucune période comptable ouverte ou clôturée.</p>}
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-extrabold">Mappings débit / crédit</h2>
      {canWrite && <form onSubmit={saveMapping} className="mt-4 grid gap-3 sm:grid-cols-2">
        <select required className="rounded-lg border p-3" value={eventType} onChange={e => setEventType(e.target.value)}>
          <option value="">Choisir un événement pris en charge</option>
          {MAPPING_EVENTS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select className="rounded-lg border p-3" value={sens} onChange={e => setSens(e.target.value as "debit" | "credit")}><option value="debit">Débit</option><option value="credit">Crédit</option></select>
        <select required className="rounded-lg border p-3 sm:col-span-2" value={compteId} onChange={e => setCompteId(e.target.value)}><option value="">Choisir un compte validé</option>{validatedAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.libelle}</option>)}</select>
        <label className="text-sm">Valide à partir du<input type="date" className="mt-1 w-full rounded-lg border p-3" value={validFrom} onChange={e => setValidFrom(e.target.value)} /></label>
        <label className="text-sm">Valide jusqu’au<input type="date" className="mt-1 w-full rounded-lg border p-3" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></label>
        <button disabled={busy || !validatedAccounts.length} className="rounded-lg bg-naxa-green-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{editingMappingId ? "Enregistrer les modifications" : "Ajouter le mapping"}</button>
      </form>}
      <div className="mt-4 space-y-2">{(data?.mappings ?? []).map(m => <article key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm"><div><p className="font-semibold">{m.evenement_type} · {m.sens === "debit" ? "Débit" : "Crédit"}</p><p className="text-slate-600">{m.compte_code ?? "Compte absent"} — {m.compte_libelle ?? ""}</p><p className="text-xs text-slate-500">{m.statut === "valide" ? "Validé" : m.statut === "a_valider" ? "À valider" : m.statut} · {m.valide_du ?? "sans début"} → {m.valide_jusquau ?? "sans fin"}</p></div>{canWrite && m.statut === "a_valider" ? <div className="flex gap-2"><button disabled={busy} onClick={() => { setEditingMappingId(m.id); setEventType(m.evenement_type); setSens(m.sens); setCompteId(m.compte_id ?? ""); setValidFrom(m.valide_du ?? ""); setValidUntil(m.valide_jusquau ?? ""); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold">Modifier</button><button disabled={busy} onClick={() => void validateMapping(m.id)} className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-900 disabled:opacity-50">Valider mapping</button></div> : null}</article>)}
        {!data?.mappings?.length && <p className="text-sm text-slate-500">Aucun mapping enregistré.</p>}</div>
    </section>
    {!canWrite && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Votre accès est en lecture seule. Le Promoteur peut partager le droit d’écriture depuis « Droits comptables » ; ce retrait n’efface aucune donnée.</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
  </div>;
}
