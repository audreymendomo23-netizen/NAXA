const ASSETS: Record<string, { url: string; type: string }> = {
  "pdfjs/pdf.worker.mjs": {
    url: "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/build/pdf.worker.mjs",
    type: "text/javascript; charset=utf-8",
  },
  "tesseract/worker.min.js": {
    url: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
    type: "text/javascript; charset=utf-8",
  },
  "tesseract/core/tesseract-core.wasm.js": {
    url: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js",
    type: "text/javascript; charset=utf-8",
  },
  "tesseract/core/tesseract-core-simd.wasm.js": {
    url: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd.wasm.js",
    type: "text/javascript; charset=utf-8",
  },
  "tesseract/core/tesseract-core-lstm.wasm.js": {
    url: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm.js",
    type: "text/javascript; charset=utf-8",
  },
  "tesseract/core/tesseract-core-simd-lstm.wasm.js": {
    url: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js",
    type: "text/javascript; charset=utf-8",
  },
  "tesseract/core/tesseract-core.wasm": {
    url: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm",
    type: "application/wasm",
  },
  "tesseract/core/tesseract-core-simd.wasm": {
    url: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd.wasm",
    type: "application/wasm",
  },
  "tesseract/core/tesseract-core-lstm.wasm": {
    url: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm",
    type: "application/wasm",
  },
  "tesseract/core/tesseract-core-simd-lstm.wasm": {
    url: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm",
    type: "application/wasm",
  },
  "tesseract/lang/fra.traineddata.gz": {
    url: "https://tessdata.projectnaptha.com/4.0.0/fra.traineddata.gz",
    type: "application/gzip",
  },
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string[] }> }
) {
  const { asset: assetSegments } = await params;
  const key = Array.isArray(assetSegments) ? assetSegments.join("/") : "";
  const asset = ASSETS[key];

  if (!asset) {
    return new Response("Ressource OCR inconnue.", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const upstream = await fetch(asset.url, {
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 * 30 },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response("Ressource OCR temporairement indisponible.", {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": asset.type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Ressource OCR temporairement indisponible.", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
