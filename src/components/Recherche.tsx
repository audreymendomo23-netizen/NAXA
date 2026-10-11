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

export function Recherche({ langue }: { langue: Langue }) {
  const router = useRouter();
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
  const t = textes[langue];

  const terme = normaliserRecherche(q);
  const correspondances = terme
    ? suggestionsMedicaments.filter(
        (item) =>
          normaliserRecherche(item.fr).includes(terme) ||
          normaliserRecherche(item.en).includes(terme)
      )
    : [];

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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) aller([q.trim()]);
        }}
        className="flex gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <input
            ref={champ}
            className="champ"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSuggestionsOuvertes(true);
            }}
            onFocus={() => setSuggestionsOuvertes(true)}
            placeholder={t.recherchePlaceholder}
            aria-label={langue === "fr" ? "Médicament recherché" : "Medicine searched"}
            aria-autocomplete="list"
            aria-expanded={suggestionsOuvertes && correspondances.length > 0}
          />
          {suggestionsOuvertes && correspondances.length > 0 && (
            <div
              ref={listeRef}
              role="listbox"
              className="absolute inset-x-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-naxa-green-100 bg-white p-1 text-naxa-green-900 shadow-lg"
            >
              {correspondances.map((item) => (
                <button
                  key={item.fr}
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => {
                    setQ(item.fr);
                    aller([item.fr]);
                  }}
                  className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm hover:bg-naxa-green-100"
                >
                  {item[langue]}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn-canari shrink-0 !px-5" type="submit">
          {t.chercher}
        </button>
      </form>

      <input
        ref={fichier}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => e.target.files?.[0] && scanner(e.target.files[0])}
      />
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => e.target.files?.[0] && scanner(e.target.files[0])}
      />

      <button
        className="btn btn-clair w-full"
        type="button"
        onClick={() => setChoixScanner(true)}
        disabled={etat === "lecture"}
      >
        {etat === "lecture" ? t.lectureOrdonnance : t.scanner}
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
