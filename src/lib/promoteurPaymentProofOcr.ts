"use client";

export type LecturePreuvePaiement = {
  texte: string;
  confiance: number;
  pagesTraitees: number;
  mode: "image" | "pdf_text" | "pdf_ocr" | "pdf_mixte";
};

async function createPaymentOcrWorker() {
  const { createWorker } = await import("tesseract.js");
  const base = typeof window === "undefined" ? "" : window.location.origin;
  return createWorker("fra", 1, {
    workerPath: base + "/api/ocr-assets/tesseract/worker.min.js",
    langPath: base + "/api/ocr-assets/tesseract/lang",
    corePath: base + "/api/ocr-assets/tesseract/core",
    cachePath: "naxa-payment-proof-ocr-fra-v1",
    cacheMethod: "write",
    workerBlobURL: false,
  });
}

/** OCR local image ou PDF. Le texte complet reste dans le navigateur et n'est jamais persisté. */
export async function lirePreuvePaiement(file: File | Blob): Promise<LecturePreuvePaiement> {
  if (!file || file.size <= 0 || file.size > 25 * 1024 * 1024) {
    throw new Error("La preuve doit peser entre 1 octet et 25 Mo.");
  }
  const isPdf = file.type === "application/pdf" ||
    (file instanceof File && file.name.toLowerCase().endsWith(".pdf"));

  const worker = await createPaymentOcrWorker();
  try {
    if (!isPdf) {
      const { data } = await worker.recognize(file);
      return {
        texte: String(data.text ?? "").slice(0, 12000),
        confiance: Math.max(0, Math.min(100, Math.round(Number(data.confidence) || 0))),
        pagesTraitees: 1,
        mode: "image",
      };
    }

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const base = typeof window === "undefined" ? "" : window.location.origin;
    pdfjs.GlobalWorkerOptions.workerSrc = base + "/api/ocr-assets/pdfjs/pdf.worker.mjs";
    const loading = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      useWorkerFetch: false,
      isEvalSupported: false,
    });
    const pdf = await loading.promise;
    const pageCount = Math.min(pdf.numPages, 3);
    const fragments: string[] = [];
    const confidences: number[] = [];
    let usedTextLayer = false;
    let usedOcr = false;

    try {
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: unknown) => {
            if (!item || typeof item !== "object" || !("str" in item)) return "";
            return String((item as { str?: unknown }).str ?? "");
          })
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (pageText.length >= 40) {
          fragments.push("[Page " + pageNumber + "] " + pageText);
          usedTextLayer = true;
          continue;
        }

        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Impossible de preparer la page PDF pour l'OCR.");
        await page.render({ canvasContext: context, viewport }).promise;
        const { data } = await worker.recognize(canvas);
        const recognized = String(data.text ?? "").trim();
        if (recognized) fragments.push("[Page " + pageNumber + "] " + recognized);
        confidences.push(Number(data.confidence) || 0);
        usedOcr = true;
        canvas.width = 0;
        canvas.height = 0;
      }
    } finally {
      await pdf.destroy();
    }

    const text = fragments.join("\n\n").slice(0, 12000);
    if (!text) throw new Error("Aucun texte exploitable n'a ete detecte dans le PDF.");
    const confidence = confidences.length
      ? Math.round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length)
      : 100;
    return {
      texte: text,
      confiance: Math.max(0, Math.min(100, confidence)),
      pagesTraitees: pageCount,
      mode: usedTextLayer && usedOcr ? "pdf_mixte" : usedOcr ? "pdf_ocr" : "pdf_text",
    };
  } finally {
    await worker.terminate();
  }
}
