"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { lireOrdonnance, type LectureOrdonnance } from "@/lib/ocr";
import { BoutonNAXA } from "@/components/BoutonNAXA";
import { BulleErreur } from "@/components/BulleErreur";
import { textes } from "@/lib/accueil-textes";

type MedicamentRecherche = { id: string; name: string; brand: string | null; activeIngredient: string | null; form: string | null; definition: string | null; indications: string | null; imageUrl: string | null; imageSource: string | null; imageSourceUrl?: string | null; imageLicense?: string | null; imageAttribution?: string | null; imageTitle?: string | null; synonyms?: string[]; source: string[]; availability: "disponible" | "indisponible" | "non_verifiee"; partnerPharmacyCount: number | null; lowestPartnerPrice: number | null; localProductId: string | null; localInformationValidated: boolean; localInformationSource: string | null; cameroonRegulatoryStatus: "a_verifier"; cameroonRegulatoryReference: string };
const PHOTO_MEDICAMENT_PAR_DEFAUT = "/medicaments/placeholder.svg";
const CACHE_RECHERCHE_KEY = "naxa-medicament-search-v1";
type CacheRecherche = { updatedAt: number; byQuery: Record<string, MedicamentRecherche[]>; corpus: MedicamentRecherche[] };

function normaliserCache(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function lireCacheRecherche(): CacheRecherche {
  try {
    const raw = window.localStorage.getItem(CACHE_RECHERCHE_KEY);
    if (!raw) return { updatedAt: 0, byQuery: {}, corpus: [] };
    const parsed = JSON.parse(raw) as Partial<CacheRecherche>;
    return {
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
      byQuery: parsed.byQuery && typeof parsed.byQuery === "object" ? parsed.byQuery : {},
      corpus: Array.isArray(parsed.corpus) ? parsed.corpus : [],
    };
  } catch {
    return { updatedAt: 0, byQuery: {}, corpus: [] };
  }
}

function enregistrerCacheRecherche(query: string, results: MedicamentRecherche[]): void {
  try {
    const cache = lireCacheRecherche();
    cache.byQuery[normaliserCache(query)] = results;
    cache.byQuery = Object.fromEntries(Object.entries(cache.byQuery).slice(-80));
    const unique = new Map<string, MedicamentRecherche>();
    for (const item of [...cache.corpus, ...results]) unique.set(item.id, item);
    cache.corpus = [...unique.values()].slice(-500);
    cache.updatedAt = Date.now();
    window.localStorage.setItem(CACHE_RECHERCHE_KEY, JSON.stringify(cache));
  } catch {
    // Le stockage local est facultatif et ne bloque jamais la recherche en ligne.
  }
}

function enregistrerCatalogueHorsLigne(results: MedicamentRecherche[]): void {
  try {
    const cache = lireCacheRecherche();
    const unique = new Map<string, MedicamentRecherche>();
    for (const item of [...cache.corpus, ...results]) unique.set(item.id, item);
    cache.corpus = [...unique.values()].slice(-500);
    cache.updatedAt = Date.now();
    window.localStorage.setItem(CACHE_RECHERCHE_KEY, JSON.stringify(cache));
  } catch {
    // Le catalogue peut être rechargé lors d'une prochaine connexion.
  }
}

function rechercherDansCache(query: string): MedicamentRecherche[] {
  const cache = lireCacheRecherche();
  const needle = normaliserCache(query);
  const exact = cache.byQuery[needle];
  const matches = exact?.length ? exact : cache.corpus.filter((item) =>
    [item.name, item.brand, item.activeIngredient, item.form, ...(item.synonyms ?? [])]
      .filter((value): value is string => Boolean(value))
      .some((value) => { const normalized = normaliserCache(value); return normalized.length >= 2 && (normalized.includes(needle) || needle.includes(normalized)); })
  );
  return matches.slice(0, 10).map((item) => ({
    ...item,
    availability: "non_verifiee" as const,
    partnerPharmacyCount: null,
    lowestPartnerPrice: null,
  }));
}

export function Recherche({ langue, mode = "recherche" }: { langue: "fr" | "en"; mode?: "recherche" | "scanner" }) {
  const router = useRouter();
  const t = textes[langue];
  const [q, setQ] = useState("");
  const [suggestionsOuvertes, setSuggestionsOuvertes] = useState(false);
  const [lecture, setLecture] = useState<LectureOrdonnance | null>(null);
  const [liste, setListe] = useState<string[]>([]);
  const [etat, setEtat] = useState<"repos" | "lecture" | "erreur">("repos");
  const [choixScanner, setChoixScanner] = useState(mode === "scanner");
  const champ = useRef<HTMLInputElement>(null);
  const listeRef = useRef<HTMLDivElement>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [medicaments, setMedicaments] = useState<MedicamentRecherche[]>([]);
  const [rechercheCatalogue, setRechercheCatalogue] = useState<"repos" | "chargement" | "erreur">("repos");
  const [rechercheActive, setRechercheActive] = useState(false);

 
  const [horsConnexion, setHorsConnexion] = useState(false);
  const [resultatsEnCache, setResultatsEnCache] = useState(false);

  useEffect(() => {
    const terme = q.trim();
    setHorsConnexion(!navigator.onLine);
    setResultatsEnCache(false);
    if (terme.length < 2) {
      setMedicaments([]);
      setRechercheCatalogue("repos");
      setRechercheActive(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setRechercheActive(true);
      if (!navigator.onLine) {
        const cached = rechercherDansCache(terme);
        setMedicaments(cached);
        setResultatsEnCache(cached.length > 0);
        setRechercheCatalogue(cached.length ? "repos" : "erreur");
        return;
      }
      setRechercheCatalogue("chargement");
      try {
        const response = await fetch("/api/medicaments/recherche?q=" + encodeURIComponent(terme), { signal: controller.signal });
        if (!response.ok) throw new Error("catalogue indisponible");
        const data = await response.json() as { results?: MedicamentRecherche[] };
        const results = Array.isArray(data.results) ? data.results : [];
        if (controller.signal.aborted) return;
        setMedicaments(results);
        setRechercheCatalogue("repos");
        enregistrerCacheRecherche(terme, results);

        // La recherche des photos est indépendante et ne retarde pas les fiches médicaments.
        if (results.some((item) => !item.imageUrl)) {
          void fetch("/api/medicaments/photo?q=" + encodeURIComponent(terme), { signal: controller.signal })
            .then((photoResponse) => photoResponse.ok ? photoResponse.json() : null)
            .then((payload: { photo?: { url?: string; sourceUrl?: string; licence?: string; attribution?: string | null; title?: string } | null } | null) => {
              const photo = payload?.photo;
              if (!photo?.url || controller.signal.aborted) return;
              const needle = normaliserCache(terme);
              const matching = results.filter((item) =>
                [item.name, item.activeIngredient, item.brand]
                  .filter((value): value is string => Boolean(value))
                  .some((value) => {
                    const normalized = normaliserCache(value);
                    return normalized === needle || (needle.length >= 5 && normalized.includes(needle)) || (normalized.length >= 5 && needle.includes(normalized));
                  })
              );
              if (!matching.length) return;
              const updated = results.map((item) => matching.some((match) => match.id === item.id) && !item.imageUrl
                ? { ...item, imageUrl: photo.url!, imageSource: "Wikimedia Commons — licence et source disponibles", imageSourceUrl: photo.sourceUrl ?? null, imageLicense: photo.licence ?? null, imageAttribution: photo.attribution ?? null, imageTitle: photo.title ?? null }
                : item);
              setMedicaments((current) => current.map((item) => updated.find((next) => next.id === item.id) ?? item));
              enregistrerCacheRecherche(terme, updated);
            })
            .catch(() => undefined);
        }
      } catch {
        if (controller.signal.aborted) return;
        const cached = rechercherDansCache(terme);
        setMedicaments(cached);
        setResultatsEnCache(cached.length > 0);
        setRechercheCatalogue(cached.length ? "repos" : "erreur");
        setHorsConnexion(!navigator.onLine);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [q]);

  useEffect(() => {
    let active = true;
    const synchroniserCatalogue = async () => {
      if (!navigator.onLine) return;
      try {
        const response = await fetch("/api/medicaments/catalogue-hors-ligne", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { results?: MedicamentRecherche[] };
        if (active && Array.isArray(data.results) && data.results.length) {
          enregistrerCatalogueHorsLigne(data.results);
        }
      } catch {
        // Les résultats déjà enregistrés restent consultables sans réseau.
      }
    };
    void synchroniserCatalogue();
    window.addEventListener("online", synchroniserCatalogue);
    return () => {
      active = false;
      window.removeEventListener("online", synchroniserCatalogue);
    };
  }, []);

  useEffect(() => {
    const updateConnection = () => setHorsConnexion(!navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  const aller = (termes: string[]) => {
    const p = new URLSearchParams();
    termes.filter(Boolean).forEach((valeur) => p.append("q", valeur));
    setSuggestionsOuvertes(false);
    router.push(`/resultats?${p.toString()}`);
  };

  useEffect(() => {
    if (!suggestionsOuvertes) return;

    function clicExterieur(e: PointerEvent) {
      const cible = e.target as Node;
      if (
        !champ.current?.contains(cible) &&
        !listeRef.current?.contains(cible)
      ) {
        setSuggestionsOuvertes(false);
      }
    }

    function echap(e: KeyboardEvent) {
      if (e.key === "Escape") setSuggestionsOuvertes(false);
    }

    document.addEventListener("pointerdown", clicExterieur);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("pointerdown", clicExterieur);
      document.removeEventListener("keydown", echap);
    };
  }, [suggestionsOuvertes]);

  async function scanner(f: File) {
    setEtat("lecture");
    try {
      const resultat = await lireOrdonnance(f);
      setLecture(resultat);
      setListe(resultat.candidats);
      setEtat("repos");
    } catch {
      setEtat("erreur");
    }
  }

  return (
    <div className="w-full space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) aller([q.trim()]); }} className="flex gap-2">
        <input className="champ min-w-0 flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder={langue === "fr" ? "Ex. Paracétamol, Coartem, amoxicilline" : "E.g. Paracetamol, Coartem, amoxicillin"} aria-label={langue === "fr" ? "Médicament recherché" : "Medicine searched"} />
        <BoutonNAXA importance="importante" className="btn-canari shrink-0 !px-5" type="submit" data-naxa-ambulance="true">{langue === "fr" ? "Chercher" : "Search"}</BoutonNAXA>
      </form>

      {rechercheActive && (
        <section className="max-h-[45dvh] space-y-3 overflow-y-auto rounded-xl border border-naxa-green-100 bg-white p-3" aria-live="polite" aria-label="Résultats du catalogue médicaments">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-naxa-green-900">Résultats du catalogue</h2>\n            {horsConnexion && <span className="text-xs font-semibold text-amber-800">Hors connexion</span>}
            {rechercheCatalogue === "chargement" && <span className="text-xs text-slate-500">Recherche…</span>}
          </div>
          {rechercheCatalogue === "erreur" && <><p className="text-sm text-slate-600">{horsConnexion ? "Aucun résultat correspondant n’a été enregistré sur cet appareil. Reconnectez-vous pour enrichir le catalogue hors ligne." : "Le catalogue externe est momentanément indisponible. Vous pouvez toujours lancer la recherche dans les stocks partenaires."}</p><BulleErreur message={horsConnexion ? "Aucun résultat hors ligne en cache." : "Le catalogue externe est momentanément indisponible."} /></>}\n          {resultatsEnCache && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Résultats enregistrés sur cet appareil. Stocks et prix ne sont pas actualisés hors connexion.</p>}
          {rechercheCatalogue === "repos" && medicaments.length === 0 && <p className="text-sm text-slate-600">Aucun résultat confirmé par les sources interrogées. Essayez le nom de la substance active.</p>}
          <ul className="space-y-3">
            {medicaments.map((medicament) => (
              <li key={medicament.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-start gap-3">
                  <img
                    src={medicament.imageUrl || PHOTO_MEDICAMENT_PAR_DEFAUT}
                    onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = PHOTO_MEDICAMENT_PAR_DEFAUT; }}
                    alt={medicament.imageUrl ? "Image illustrative externe, vérifier la correspondance avec le médicament et son conditionnement" : "Photo non disponible"}
                    className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 bg-slate-50 object-contain"
                    loading="lazy" decoding="async"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-naxa-green-900">{medicament.name}</h3>
                    {medicament.brand && <p className="text-sm text-slate-700">{medicament.brand}</p>}
                    {medicament.activeIngredient && <p className="text-sm"><span className="font-semibold">Substance active :</span> {medicament.activeIngredient}</p>}
                    {medicament.form && <p className="text-sm"><span className="font-semibold">Forme :</span> {medicament.form}</p>}
                  </div>
                </div>
                {medicament.definition && <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Définition :</span> {medicament.definition}</p>}
                {medicament.indications && <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Indications générales :</span> {medicament.indications}</p>}
                {medicament.imageSource && <p className="mt-2 text-xs text-slate-500">{medicament.imageSource}{medicament.imageAttribution ? " · " + medicament.imageAttribution : ""}{medicament.imageSourceUrl ? <> · <a href={medicament.imageSourceUrl} target="_blank" rel="noreferrer" className="underline">Source photo</a></> : ""}</p>}
                <div className="mt-2 space-y-1">
                  <p className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${medicament.availability === "disponible" ? "bg-emerald-100 text-emerald-800" : medicament.availability === "indisponible" ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-800"}`}>
                    {medicament.availability === "disponible" ? "Disponible chez nos partenaires" : medicament.availability === "indisponible" ? "Indisponible dans le réseau partenaire" : "Stock non vérifié"}
                  </p>
                  {medicament.availability === "disponible" && medicament.partnerPharmacyCount !== null && (
                    <p className="text-xs text-slate-600">
                      {medicament.partnerPharmacyCount} pharmacie{medicament.partnerPharmacyCount > 1 ? "s" : ""} partenaire{medicament.partnerPharmacyCount > 1 ? "s" : ""} avec un stock positif confirmé
                      {medicament.lowestPartnerPrice !== null ? ` · dès ${new Intl.NumberFormat("fr-FR").format(medicament.lowestPartnerPrice)} FCFA` : ""}
                    </p>
                  )}
                  {medicament.availability === "non_verifiee" && <p className="text-xs text-slate-500">Le statut ne sera confirmé qu'après vérification des stocks NAXA.</p>}
                  {medicament.localInformationValidated && <p className="text-xs font-semibold text-emerald-700">Fiche locale validée par NAXA</p>}
                  <a href={medicament.cameroonRegulatoryReference} target="_blank" rel="noreferrer" className="inline-block text-xs font-semibold text-naxa-green-800 underline">Vérifier l’autorisation au Cameroun (DPML)</a>
                </div>
                <p className="mt-2 text-xs text-slate-500">Sources : {medicament.source.join(", ") || "aucune source externe confirmée"}. Les données médicales sont informatives et ne remplacent pas l’avis d’un pharmacien.</p>
                <button type="button" className="btn btn-vert mt-3 w-full" onClick={() => aller([medicament.name])}>
                  Vérifier le stock des pharmacies partenaires
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <input ref={fichier} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && scanner(e.target.files[0])} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && scanner(e.target.files[0])} />
      <BoutonNAXA importance="importante" className="btn-clair w-full" type="button" onClick={() => setChoixScanner(true)} disabled={etat === "lecture"}>
        {etat === "lecture" ? "Lecture de l'ordonnance…" : "Scanner mon ordonnance"}
      </BoutonNAXA>

      <p className="flex items-start gap-1.5 text-xs text-slate-600">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        {t.confidentialiteScan}
      </p>

      {choixScanner && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="choix-ordonnance"
        >
          <div className="carte w-full max-w-sm space-y-4">
            <h2 id="choix-ordonnance" className="text-xl font-extrabold">{t.scanner}</h2>
            <p className="text-sm text-slate-600">
              {langue === "fr"
                ? "Choisissez comment fournir l’ordonnance. L’image reste dans votre navigateur et n’est pas envoyée à NAXA."
                : "Choose how to provide your prescription. The image stays in your browser and is not sent to NAXA."}
            </p>
            <div className="grid gap-2">
              <button type="button" className="btn btn-vert w-full" onClick={() => { setChoixScanner(false); fichier.current?.click(); }}>
                {t.importImage}
              </button>
              <button type="button" className="btn btn-clair w-full" onClick={() => { setChoixScanner(false); camera.current?.click(); }}>
                {t.camera}
              </button>
              <button type="button" className="btn btn-clair w-full" onClick={() => setChoixScanner(false)}>
                {t.annuler}
              </button>
            </div>
          </div>
        </div>
      )}

      {etat === "erreur" && (
        <>
          <p role="alert" className="text-sm text-red-700">{t.erreurLecture}</p>
          <BulleErreur message={t.erreurLecture} />
        </>
      )}

      {lecture && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={t.verifierLecture}
        >
          <div className="carte max-h-[85dvh] w-full max-w-xl space-y-3 overflow-y-auto">
            <h2 className="font-semibold">{t.verifierLecture}</h2>
            <p className="text-sm text-slate-600">
              {t.confianceLecture} : {lecture.confiance} %.{" "}
              {lecture.confiance < 70 && t.faibleConfiance}
            </p>
            <ul className="space-y-2">
              {liste.map((medicament, i) => (
                <li key={i} className="flex gap-2">
                  <input
                    className="champ !min-h-[44px]"
                    value={medicament}
                    onChange={(e) =>
                      setListe(liste.map((x, j) => (j === i ? e.target.value : x)))
                    }
                    aria-label={`${langue === "fr" ? "Médicament" : "Medicine"} ${i + 1}`}
                  />
                  <button
                    type="button"
                    className="btn btn-clair !px-4"
                    onClick={() => setListe(liste.filter((_, j) => j !== i))}
                    aria-label={langue === "fr" ? "Supprimer cette ligne" : "Remove this line"}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-clair" onClick={() => setListe([...liste, ""])}>
                {t.ajouterLigne}
              </button>
              <button type="button" className="btn btn-clair" onClick={() => { setLecture(null); setListe([]); }}>
                {t.annuler}
              </button>
              <button type="button" className="btn btn-vert flex-1" onClick={() => aller(liste)} disabled={!liste.some((l) => l.trim())}>
                {t.chercherStock}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
