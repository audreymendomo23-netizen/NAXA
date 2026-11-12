"use client";

export type LectureOrdonnance = {
  texte: string;
  confiance: number;
  candidats: string[];
};

const BRUIT = /^(?:dr\.?|docteur|date|nom|pr[ée]nom|âge?|ordonnance|signature|cachet|le\s|n°|tél?)/i;

export async function lireOrdonnance(image: File | Blob): Promise<LectureOrdonnance> {
  const { createWorker } = await import("tesseract.js");
  const base = typeof window === "undefined" ? "" : window.location.origin;

  // Les ressources sont servies par NAXA et mises en cache par le service worker.
  // Après le premier chargement en ligne, le moteur et le modèle français restent disponibles hors ligne.
  const worker = await createWorker("fra", 1, {
    workerPath: base + "/api/ocr-assets/tesseract/worker.min.js",
    langPath: base + "/api/ocr-assets/tesseract/lang",
    corePath: base + "/api/ocr-assets/tesseract/core",
    cachePath: "naxa-ocr-fra-v1",
    cacheMethod: "write",
    workerBlobURL: false,
  });

  try {
    const { data } = await worker.recognize(image);
    const candidats = Array.from(
      new Set(
        data.text
          .split(/\r?\n/)
          .map((ligne: string) =>
            ligne
              .replace(/^[\s\-•*\d.)]+/, "")
              .replace(/\s+/g, " ")
              .trim()
          )
          .filter(
            (ligne: string) =>
              ligne.length >= 3 &&
              /[a-zA-ZÀ-ÿ]{3,}/.test(ligne) &&
              !BRUIT.test(ligne) &&
              !/\b(?:prendre|posologie|matin|midi|soir|fois par jour|\d+\s*(?:cp|comprim[eé]s?|g[eé]lules?|ml|mg))\b/i.test(ligne)
          )
      )
    ).slice(0, 12);

    return {
      texte: data.text,
      confiance: Math.round(data.confidence),
      candidats,
    };
  } finally {
    await worker.terminate();
  }
}
