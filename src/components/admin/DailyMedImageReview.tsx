"use client";

import { useState, type FormEvent } from "react";

type Candidate = {
  setid: string;
  title: string;
  publishedDate: string | null;
  matchedBy: string;
  rxcui: string | null;
  rxnormScore: number | null;
  imageUrl: string | null;
  imageName: string | null;
  imageKind: "comprime" | null;
  labelUrl: string;
};

type SearchResponse = {
  results?: Candidate[];
  rxnormCandidates?: Array<{ rxcui: string; name: string; score: number | null }>;
  notice?: string;
  error?: string;
};

export function DailyMedImageReview() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [rxnorm, setRxnorm] = useState<SearchResponse["rxnormCandidates"]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 3) {
      setError("Saisissez au moins trois caractères.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    setResults([]);
    setRxnorm([]);
    try {
      const response = await fetch("/api/admin/medicaments-images/dailymed?q=" + encodeURIComponent(term), {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = await response.json() as SearchResponse;
      if (!response.ok) throw new Error(data.error || "Recherche impossible.");
      setResults(data.results ?? []);
      setRxnorm(data.rxnormCandidates ?? []);
      setNotice(data.notice ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recherche DailyMed indisponible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-5">
      <form onSubmit={search} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
        <label className="min-w-0 flex-1 text-sm font-bold text-slate-800">
          Nom du médicament ou substance active
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={100}
            placeholder="Ex. paracétamol, amoxicilline…"
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <button type="submit" disabled={loading} className="min-h-12 rounded-xl bg-[#0F6B3F] px-5 py-3 font-bold text-white disabled:opacity-60 sm:self-end">
          {loading ? "Recherche en cours…" : "Rechercher dans DailyMed"}
        </button>
      </form>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">{notice}</p>}

      {rxnorm && rxnorm.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-extrabold text-slate-950">Rapprochements RxNorm</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {rxnorm.map((item) => (
              <span key={item.rxcui} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {item.name} · RxCUI {item.rxcui}{item.score !== null ? " · " + item.score : ""}
              </span>
            ))}
          </div>
        </section>
      )}

      {results.length === 0 && !loading && notice && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          Aucun SPLIMAGE exploitable trouvé dans les notices retournées. Les notices peuvent exister sans image de comprimé.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {results.map((item) => (
          <article key={item.setid} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid gap-4 p-4 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div className="flex min-h-40 items-center justify-center rounded-xl bg-slate-50 p-2">
                {item.imageUrl ? (
                  // Image candidate réservée à la revue Admin, jamais publiée directement au client.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={"Image SPLIMAGE candidate : " + item.title} className="max-h-48 w-full object-contain" loading="lazy"/>
                ) : (
                  <span className="px-3 text-center text-xs text-slate-500">Aucune image SPLIMAGE dans cette notice</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">DailyMed · Notice SPL</p>
                <h3 className="mt-1 break-words font-extrabold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-600">Rapprochement : {item.matchedBy}</p>
                {item.rxcui && <p className="mt-1 text-xs text-slate-600">RxCUI {item.rxcui}{item.rxnormScore !== null ? " · score " + item.rxnormScore : ""}</p>}
                {item.publishedDate && <p className="mt-1 text-xs text-slate-600">Notice publiée : {item.publishedDate}</p>}
                {item.imageName && <p className="mt-1 break-all text-xs text-slate-500">Fichier : {item.imageName}</p>}
                <a href={item.labelUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center text-sm font-bold text-emerald-800 underline underline-offset-4">
                  Ouvrir la notice DailyMed
                </a>
              </div>
            </div>
            {item.imageUrl && (
              <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">
                Image de comprimé/gélule issue de la notice. Ce n’est pas une photo de boîte. Les droits de reproduction doivent être confirmés avant publication.
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
