"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PharmacyDutyRow = {
  id: string;
  nom: string;
  ville: string | null;
  region: string | null;
  de_garde: boolean;
  garde_debut: string | null;
  garde_fin: string | null;
  garde_source_url: string | null;
  garde_verifiee_le: string | null;
};

function doualaInputValue(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Douala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

function doualaIso(value: string): string {
  return new Date(value + ":00+01:00").toISOString();
}

function dateLisible(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Douala",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function GardesAdminClient() {
  const [pharmacies, setPharmacies] = useState<PharmacyDutyRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [debut, setDebut] = useState(() => doualaInputValue(new Date()));
  const [fin, setFin] = useState(() => doualaInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [sourceUrl, setSourceUrl] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/gardes", { cache: "no-store" });
      const data = await response.json() as { pharmacies?: PharmacyDutyRow[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Chargement impossible.");
      const rows = Array.isArray(data.pharmacies) ? data.pharmacies : [];
      setPharmacies(rows);
      setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger les pharmacies.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selected = pharmacies.find((row) => row.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!needle) return pharmacies;
    return pharmacies.filter((row) => [row.nom, row.ville, row.region]
      .filter(Boolean).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(needle));
  }, [pharmacies, query]);

  const submit = async (action: "publier" | "retirer") => {
    if (!selected) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = action === "publier"
        ? { pharmacyId: selected.id, action, debut: doualaIso(debut), fin: doualaIso(fin), sourceUrl }
        : { pharmacyId: selected.id, action };
      const response = await fetch("/api/admin/gardes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { error?: string; ok?: boolean };
      if (!response.ok || !data.ok) throw new Error(data.error || "Opération refusée.");
      setSuccess(action === "publier" ? "Période publiée et vérifiée à l’instant." : "Garde retirée.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Opération impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
        <label htmlFor="garde-pharmacy-search" className="mb-2 block text-sm font-semibold text-slate-700">Filtrer par pharmacie, ville ou région</label>
        <input id="garde-pharmacy-search" value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex. Bafoussam, Nord, Pharmacie…" className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"/>
        <div className="mt-3 max-h-[45dvh] space-y-2 overflow-y-auto" aria-live="polite">
          {loading ? <p className="p-3 text-sm text-slate-500">Chargement des pharmacies partenaires…</p>
            : filtered.length === 0 ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              {pharmacies.length === 0
                ? "Aucune pharmacie partenaire active et publiée n’est présente dans cette base QA. Les pharmacies de démonstration ne sont pas proposées."
                : "Aucune pharmacie ne correspond à votre filtre."}
            </p>
            : filtered.map((row) => (
              <button type="button" key={row.id} onClick={() => {
                setSelectedId(row.id);
                setSourceUrl(row.garde_source_url ?? "");
                setDebut(row.garde_debut ? doualaInputValue(new Date(row.garde_debut)) : doualaInputValue(new Date()));
                setFin(row.garde_fin ? doualaInputValue(new Date(row.garde_fin)) : doualaInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
                setSuccess("");
              }} aria-pressed={selectedId === row.id}
                className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${selectedId === row.id ? "border-emerald-700 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-slate-900">{row.nom}</strong>
                  <span className="block truncate text-xs text-slate-600">{[row.ville, row.region].filter(Boolean).join(" · ") || "Localisation non renseignée"}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${row.de_garde && row.garde_fin && Date.parse(row.garde_fin) > Date.now() ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                  {row.de_garde && row.garde_fin && Date.parse(row.garde_fin) > Date.now() ? "Garde programmée" : "Sans garde active"}
                </span>
              </button>
            ))}
        </div>
      </section>

      {selected && (
        <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Période de garde</p>
          <h2 className="mt-1 text-lg font-extrabold text-slate-900">{selected.nom}</h2>
          <p className="text-sm text-slate-600">{[selected.ville, selected.region].filter(Boolean).join(" · ")}</p>
          {selected.garde_debut && selected.garde_fin && (
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              Actuellement enregistrée : {dateLisible(selected.garde_debut)} → {dateLisible(selected.garde_fin)}.
              <br/>Dernière vérification : {dateLisible(selected.garde_verifiee_le)}.
            </p>
          )}
          <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void submit("publier"); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Début (heure de Douala)
                <input type="datetime-local" required step={300} value={debut} onChange={(event) => setDebut(event.target.value)}
                  className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 px-3 text-base text-slate-900"/>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Fin (heure de Douala)
                <input type="datetime-local" required step={300} value={fin} onChange={(event) => setFin(event.target.value)}
                  className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 px-3 text-base text-slate-900"/>
              </label>
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              Source HTTPS du planning vérifié
              <input type="url" required value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://…" className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 px-3 text-base text-slate-900"/>
            </label>
            <p className="text-xs leading-5 text-slate-500">
              L’heure saisie est interprétée en heure de Douala (UTC+1). La publication confirme que vous avez contrôlé la source et la période.
              Une garde non revérifiée pendant 24 heures cesse d’être présentée comme actuelle.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={saving} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-800 px-4 py-2 font-bold text-white disabled:opacity-50">
                {saving ? "Enregistrement…" : "Publier et vérifier"}
              </button>
              {selected.de_garde && (
                <button type="button" disabled={saving} onClick={() => void submit("retirer")}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-200 px-4 py-2 font-bold text-red-700 disabled:opacity-50">
                  Retirer la garde
                </button>
              )}
            </div>
          </form>
        </section>
      )}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {success && <p role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
    </div>
  );
}
