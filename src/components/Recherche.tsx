"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { lireOrdonnance, type LectureOrdonnance } from "@/lib/ocr";
import {
  normaliserRecherche,
  suggestionsMedicaments,
  textes,
  type Langue,
} from "@/lib/accueil-textes";

type MedicamentRecherche = { id: string; name: string; brand: string | null; activeIngredient: string | null; form: string | null; definition: string | null; indications: string | null; imageUrl: string | null; imageSource: string | null; source: string[]; availability: string };
const PHOTO_MEDICAMENT_PAR_DEFAUT = "/medicaments/placeholder.svg";

export function Recherche({ langue }: { langue: "fr" | "en" }) {
  const router = useRouter();
  const t = textes[langue];
  const [q, setQ] = useState("");
  const [suggestionsOuvertes, setSuggestionsOuvertes] = useState(false);
  const [lecture, setLecture] = useState<LectureOrdonnance | null>(null);
  const [liste, setListe] = useState<string[]>([]);
  const [etat, setEtat] = useState<"repos" | "lecture" | "erreur">("repos");
  const [choixScanner, setChoixScanner] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  const listeRef = useRef<HTMLDivElement>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [medicaments, setMedicaments] = useState<MedicamentRecherche[]>([]);
  const [rechercheCatalogue, setRechercheCatalogue] = useState<"repos" | "chargement" | "erreur">("repos");
  const [rechercheActive, setRechercheActive] = useState(false);

  useEffect(() => {
    const terme = q.trim();
    if (terme.length < 2) {
      setMedicaments([]);
      setRechercheCatalogue("repos");
      setRechercheActive(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setRechercheCatalogue("chargement");
      setRechercheActive(true);
      try {
        const response = await fetch("/api/medicaments/recherche?q=" + encodeURIComponent(terme), { signal: controller.signal });
        if (!response.ok) throw new Error("catalogue indisponible");
        const data = await response.json() as { results?: MedicamentRecherche[] };
        setMedicaments(Array.isArray(data.results) ? data.results : []);
        setRechercheCatalogue("repos");
      } catch {
        if (controller.signal.aborted) return;
        setMedicaments([]);
        setRechercheCatalogue("erreur");
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [q]);

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
        <button className="btn btn-canari shrink-0 !px-5" type="submit">{langue === "fr" ? "Chercher" : "Search"}</button>
      </form>

      {rechercheActive && (
        <section className="max-h-[45dvh] space-y-3 overflow-y-auto rounded-xl border border-naxa-green-100 bg-white p-3" aria-live="polite" aria-label="Résultats du catalogue médicaments">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-naxa-green-900">Résultats du catalogue</h2>
            {rechercheCatalogue === "chargement" && <span className="text-xs text-slate-500">Recherche…</span>}
          </div>
          {rechercheCatalogue === "erreur" && <p className="text-sm text-slate-600">Le catalogue externe est momentanément indisponible. Vous pouvez toujours lancer la recherche dans les stocks partenaires.</p>}
          {rechercheCatalogue === "repos" && medicaments.length === 0 && <p className="text-sm text-slate-600">Aucun résultat confirmé par les sources interrogées. Essayez le nom de la substance active.</p>}
          <ul className="space-y-3">
            {medicaments.map((medicament) => (
              <li key={medicament.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-start gap-3">
                  <img
                    src={medicament.imageUrl || PHOTO_MEDICAMENT_PAR_DEFAUT}
                    onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = PHOTO_MEDICAMENT_PAR_DEFAUT; }}
                    alt={medicament.imageUrl ? "Image issue de l'étiquetage externe, pas nécessairement du conditionnement camerounais" : "Photo non disponible"}
                    className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 bg-slate-50 object-contain"
                    loading="lazy"
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
                {medicament.imageSource && <p className="mt-2 text-xs text-slate-500">{medicament.imageSource}</p>}
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
      <button className="btn btn-clair w-full" type="button" onClick={() => setChoixScanner(true)} disabled={etat === "lecture"}>
        {etat === "lecture" ? "Lecture de l'ordonnance…" : "Scanner mon ordonnance"}
      </button>

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
        <p role="alert" className="text-sm text-red-700">{t.erreurLecture}</p>
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
