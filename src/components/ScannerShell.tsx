"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { lireOrdonnance, type LectureOrdonnance } from "@/lib/ocr";

type Ecran = "camera" | "crop" | "results";
type ModeScan = "ordonnance" | "boite";
type ProduitDetecte = { id: string; nom: string; quantite: number; statut: "Disponible" | "Sur ordonnance" | "À confirmer" };
type BrouillonPosologie = { medicament: string; dose: string; unite: string; prises?: number; heures: string[]; heureDebut?: string; rappels: boolean };
type DetectionCode = { rawValue: string };
type DetecteurCode = { detect: (source: CanvasImageSource) => Promise<DetectionCode[]> };
type ConstructeurDetecteur = new (options?: { formats?: string[] }) => DetecteurCode;

const CLE_RESULTATS = "naxa:scanner:results";
const CLE_BROUILLON = "naxa:scanner:posologie:draft";
const CLE_POSOLOGIE = "naxa:scanner:posologie:pending";
const TAILLE_MAX = 10 * 1024 * 1024;
const HEURES_PAR_DEFAUT = ["07:00", "12:00", "19:00"];

function extrairePosologie(lecture: LectureOrdonnance): BrouillonPosologie {
  const lignes = lecture.texte.split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const ligneMedicament = lecture.candidats.find(nom => !/\b(fois|par jour|\/j|matin|midi|soir|comprim[eé]|g[eé]lule|prendre|posologie|dose)\b/i.test(nom));
  const medicament = (ligneMedicament || lecture.candidats[0] || "").slice(0, 100);
  const instruction = lignes.find(l => /\b(fois|\/j|par jour|matin|midi|soir|prendre|posologie|comprim[eé]|g[eé]lule|cp)\b/i.test(l)) || lecture.texte;
  const doseMatch = instruction.match(/\b(\d+(?:[.,]\d+)?)\s*(comprim[eé]s?|cp|g[eé]lules?|capsules?|sachets?|gouttes?|ml|applications?|doses?)\b/i);
  let dose = "";
  let unite = "";
  if (doseMatch) {
    dose = doseMatch[1].replace(",", ".");
    const unit = doseMatch[2].toLowerCase();
    unite = /^(cp|comprim)/.test(unit) ? "comprimé(s)"
      : /g[eé]lule/.test(unit) ? "gélule(s)"
      : /capsule/.test(unit) ? "gélule(s)"
      : /sachet/.test(unit) ? "sachet(s)"
      : /goutte/.test(unit) ? "goutte(s)"
      : unit === "ml" ? "ml"
      : /application/.test(unit) ? "application(s)" : "dose(s)";
  }
  const heures = Array.from(new Set(Array.from(lecture.texte.matchAll(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/g), m => String(m[1]).padStart(2, "0") + ":" + m[2]))).slice(0, 8);
  const frequence = lecture.texte.match(/\b([1-8])\s*(?:fois|prises?)\s*(?:par|\/)\s*(?:jour|j)\b/i);
  const prisesDetectees = heures.length || (frequence && Number(frequence[1]) === 3 ? 3 : undefined);
  const horaires = heures.length ? heures : prisesDetectees === 3 ? HEURES_PAR_DEFAUT : [];
  return { medicament, dose, unite, prises: prisesDetectees, heures: horaires, heureDebut: horaires[0], rappels: true };
}

export function ScannerShell() {
  const router = useRouter();
  const params = useSearchParams();
  const modePosologie = params.get("mode") === "posologie";
  const initialResults = params.get("view") === "results";
  const [ecran, setEcran] = useState<Ecran>(initialResults ? "results" : "camera");
  const [modeScan, setModeScan] = useState<ModeScan>("ordonnance");
  const [flux, setFlux] = useState<MediaStream | null>(null);
  const [erreurCamera, setErreurCamera] = useState("");
  const [erreur, setErreur] = useState("");
  const [lectureEnCours, setLectureEnCours] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState("");
  const [zoomRecadrage, setZoomRecadrage] = useState(100);
  const [produits, setProduits] = useState<ProduitDetecte[]>([]);
  const [configurerRappels, setConfigurerRappels] = useState(true);
  const video = useRef<HTMLVideoElement>(null);
  const inputFichier = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!initialResults) return;
    try {
      const raw = sessionStorage.getItem(CLE_RESULTATS);
      const parsed = raw ? JSON.parse(raw) as ProduitDetecte[] : [];
      setProduits(Array.isArray(parsed) ? parsed.filter(p => typeof p.nom === "string").slice(0, 12) : []);
      const draft = sessionStorage.getItem(CLE_BROUILLON);
      if (draft) setConfigurerRappels((JSON.parse(draft) as BrouillonPosologie).rappels !== false);
    } catch {
      setProduits([]);
    }
    setEcran("results");
  }, [initialResults]);

  useEffect(() => {
    if (ecran !== "crop" || !fichier) { setApercu(""); return; }
    const url = URL.createObjectURL(fichier);
    setApercu(url);
    return () => URL.revokeObjectURL(url);
  }, [ecran, fichier]);

  useEffect(() => {
    if (ecran !== "camera") {
      setFlux(current => {
        current?.getTracks().forEach(track => track.stop());
        return null;
      });
      return;
    }
    let annule = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setErreurCamera("La caméra n’est pas disponible sur ce navigateur. Vous pouvez importer une image.");
      return;
    }
    setErreurCamera("");
    void navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }
    }).then(stream => {
      if (annule) { stream.getTracks().forEach(track => track.stop()); return; }
      setFlux(stream);
      if (video.current) {
        video.current.srcObject = stream;
        void video.current.play().catch(() => undefined);
      }
    }).catch(() => {
      if (!annule) setErreurCamera("Autorisez l’accès à la caméra ou importez une image.");
    });
    return () => {
      annule = true;
      setFlux(current => {
        current?.getTracks().forEach(track => track.stop());
        return null;
      });
    };
  }, [ecran, modeScan]);

  useEffect(() => {
    if (video.current && flux && video.current.srcObject !== flux) {
      video.current.srcObject = flux;
      void video.current.play().catch(() => undefined);
    }
  }, [flux, ecran]);

  const quitter = useCallback(() => {
    if (modePosologie) router.push("/client/posologie");
    else router.push("/");
  }, [modePosologie, router]);

  const ouvrirRecadrage = useCallback(async (f: File) => {
    setErreur("");
    if (f.size > TAILLE_MAX) {
      setErreur("Le fichier dépasse 10 Mo. Choisissez une image plus légère.");
      return;
    }
    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
      setErreur("La lecture locale des PDF multipages nécessite un moteur de conversion PDF absent du projet. Importez une image de l’ordonnance.");
      return;
    }
    if (!/^image\\/(jpeg|png|webp|heic|heif|jpg)/i.test(f.type) && !/\\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)) {
      setErreur("Format non pris en charge. Choisissez JPEG, PNG, WebP ou HEIC.");
      return;
    }
    let fichierImage = f;
    if (f.type === "image/heic" || f.type === "image/heif" || /\\.(heic|heif)$/i.test(f.name)) {
      try {
        const bitmap = await createImageBitmap(f);
        const conversion = document.createElement("canvas");
        conversion.width = bitmap.width;
        conversion.height = bitmap.height;
        const context = conversion.getContext("2d");
        if (!context) throw new Error("canvas indisponible");
        context.drawImage(bitmap, 0, 0);
        bitmap.close();
        const blob = await new Promise<Blob | null>(resolve => conversion.toBlob(resolve, "image/jpeg", 0.92));
        if (!blob || blob.size > TAILLE_MAX) throw new Error("conversion indisponible ou trop volumineuse");
        fichierImage = new File([blob], f.name.replace(/\\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
      } catch {
        setErreur("Ce navigateur ne peut pas convertir cette image HEIC localement. Exportez-la en JPEG puis réessayez.");
        return;
      }
    }
    setFichier(fichierImage);
    setZoomRecadrage(100);
    setEcran("crop");
  }, []);

  const lireImage = useCallback(async (blob: Blob) => {
    setLectureEnCours(true);
    setErreur("");
    try {
      const resultat = await lireOrdonnance(blob);
      if (!resultat.texte.trim() || resultat.candidats.length === 0) {
        setErreur(modePosologie
          ? "Posologie illisible. Réessayez ou saisissez-la manuellement."
          : "Aucun médicament reconnu. Réessayez avec une image plus nette.");
        return;
      }
      const draft = extrairePosologie(resultat);
      try { sessionStorage.setItem(CLE_BROUILLON, JSON.stringify(draft)); } catch {}
      if (modePosologie) {
        try {
          sessionStorage.setItem(CLE_POSOLOGIE, JSON.stringify(draft));
          sessionStorage.removeItem(CLE_BROUILLON);
        } catch {}
        setFichier(null);
        router.push("/client/posologie?scanner=1");
        return;
      }
      const nouveaux = resultat.candidats.slice(0, 12).map((nom, index) => ({
        id: String(index) + "-" + nom.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        nom,
        quantite: 1,
        statut: "À confirmer" as const
      }));
      setProduits(nouveaux);
      try { sessionStorage.setItem(CLE_RESULTATS, JSON.stringify(nouveaux)); } catch {}
      setFichier(null);
      setEcran("results");
      router.replace("/scanner?view=results");
    } catch {
      setErreur(modePosologie
        ? "Posologie illisible. Réessayez ou saisissez-la manuellement."
        : "La lecture n’a pas abouti. Réessayez avec une image plus nette.");
    } finally {
      setLectureEnCours(false);
    }
  }, [modePosologie, router]);

  const recadrerEtLire = useCallback(async () => {
    if (!fichier || !apercu) return;
    if (fichier.type === "image/heic" || fichier.type === "image/heif" || /\.(heic|heif)$/i.test(fichier.name)) {
      try { await createImageBitmap(fichier); } catch {
        setErreur("Ce navigateur ne peut pas convertir cette image HEIC localement. Exportez-la en JPEG puis réessayez.");
        return;
      }
    }
    const image = new Image();
    image.onload = () => {
      const source = canvas.current;
      const context = source?.getContext("2d");
      if (!source || !context) { setErreur("Le recadrage n’est pas disponible sur cet appareil."); return; }
      const facteur = zoomRecadrage / 100;
      const largeur = Math.max(1, Math.floor(image.naturalWidth * 0.86 / facteur));
      const hauteur = Math.max(1, Math.floor(image.naturalHeight * 0.68 / facteur));
      const x = Math.max(0, Math.floor((image.naturalWidth - largeur) / 2));
      const y = Math.max(0, Math.floor((image.naturalHeight - hauteur) / 2));
      source.width = largeur;
      source.height = hauteur;
      context.drawImage(image, x, y, largeur, hauteur, 0, 0, largeur, hauteur);
      source.toBlob(blob => {
        if (blob) void lireImage(blob);
        else setErreur("Impossible de préparer l’image. Réessayez.");
      }, "image/jpeg", 0.94);
    };
    image.onerror = () => setErreur("Cette image ne peut pas être lue sur cet appareil. Essayez un JPEG ou PNG.");
    image.src = apercu;
  }, [fichier, apercu, zoomRecadrage, lireImage]);

  const capturer = useCallback(async () => {
    const videoElement = video.current;
    if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
      setErreur("La caméra n’est pas prête. Autorisez son accès ou importez une image.");
      return;
    }
    setErreur("");
    if (modeScan === "boite") {
      const Constructor = (window as Window & { BarcodeDetector?: ConstructeurDetecteur }).BarcodeDetector;
      if (!Constructor) {
        setErreur("Lecture du code-barres indisponible sur ce navigateur.");
        return;
      }
      try {
        const detector = new Constructor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"] });
        const detected = await detector.detect(videoElement);
        const code = detected[0]?.rawValue?.trim();
        if (!code) { setErreur("Aucun code-barres détecté. Cadrez la boîte puis réessayez."); return; }
        const item: ProduitDetecte = { id: "barcode-" + code, nom: code, quantite: 1, statut: "À confirmer" };
        setProduits([item]);
        try { sessionStorage.setItem(CLE_RESULTATS, JSON.stringify([item])); } catch {}
        setEcran("results");
        router.replace("/scanner?view=results");
      } catch {
        setErreur("Lecture du code-barres impossible. Réessayez ou recherchez le nom du médicament.");
      }
      return;
    }
    const source = canvas.current;
    const context = source?.getContext("2d");
    if (!source || !context) { setErreur("La capture n’est pas disponible sur cet appareil."); return; }
    source.width = videoElement.videoWidth;
    source.height = videoElement.videoHeight;
    context.drawImage(videoElement, 0, 0, source.width, source.height);
    source.toBlob(blob => {
      if (!blob) { setErreur("La capture a échoué. Réessayez."); return; }
      setFichier(new File([blob], "ordonnance.jpg", { type: "image/jpeg" }));
      setZoomRecadrage(100);
      setEcran("crop");
    }, "image/jpeg", 0.94);
  }, [modeScan, router]);

  const mettreAJourProduit = (id: string, patch: Partial<ProduitDetecte>) => {
    setProduits(previous => {
      const next = previous.map(item => item.id === id ? { ...item, ...patch } : item);
      try { sessionStorage.setItem(CLE_RESULTATS, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const ouvrirPrix = (nom: string) => router.push("/resultats?q=" + encodeURIComponent(nom));
  const voirPharmacies = () => {
    const termes = produits.map(p => p.nom.trim()).filter(Boolean);
    if (!termes.length) return;
    try {
      if (configurerRappels) {
        const raw = sessionStorage.getItem(CLE_BROUILLON);
        if (raw) sessionStorage.setItem(CLE_POSOLOGIE, JSON.stringify({ ...(JSON.parse(raw) as BrouillonPosologie), rappels: true }));
      } else sessionStorage.removeItem(CLE_POSOLOGIE);
    } catch {}
    router.push("/resultats?" + termes.map(nom => "q=" + encodeURIComponent(nom)).join("&"));
  };
  const verifierPosologie = () => {
    try {
      const raw = sessionStorage.getItem(CLE_BROUILLON);
      const draft = raw ? JSON.parse(raw) as BrouillonPosologie : { medicament: produits[0]?.nom || "", dose: "", unite: "", heures: [], rappels: configurerRappels };
      sessionStorage.setItem(CLE_POSOLOGIE, JSON.stringify({ ...draft, rappels: configurerRappels }));
      sessionStorage.removeItem(CLE_BROUILLON);
      sessionStorage.removeItem(CLE_RESULTATS);
    } catch {}
    router.push("/client/posologie?scanner=1");
  };
  const rescanner = () => {
    try {
      sessionStorage.removeItem(CLE_RESULTATS);
      sessionStorage.removeItem(CLE_BROUILLON);
      sessionStorage.removeItem(CLE_POSOLOGIE);
    } catch {}
    setProduits([]);
    setErreur("");
    setFichier(null);
    setModeScan("ordonnance");
    setEcran("camera");
    router.replace("/scanner" + (modePosologie ? "?mode=posologie" : ""));
  };

  const fond = "fixed inset-0 z-40 flex min-h-dvh flex-col overflow-hidden bg-[#0B1F15] text-white";
  if (ecran === "crop") {
    return <main className={fond} style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <header className="mx-auto flex w-full max-w-[480px] items-center justify-between px-4 py-3">
        <button type="button" onClick={() => { setFichier(null); setEcran("camera"); }} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl" aria-label="Retour">‹</button>
        <h1 className="text-base font-extrabold">Recadrer l’image</h1>
        <span className="w-11"/>
      </header>
      <div className="relative mx-auto flex min-h-0 w-[calc(100%-2rem)] max-w-[448px] flex-1 items-center justify-center overflow-hidden rounded-[28px] bg-black">
        {apercu && <img src={apercu} alt="Aperçu de l’ordonnance à recadrer" className="max-h-full max-w-full object-contain transition-transform duration-200 motion-reduce:transition-none" style={{ transform: "scale(" + zoomRecadrage / 100 + ")" }}/>}
        <div className="pointer-events-none absolute inset-[12%] rounded-2xl border-2 border-[#FFE23D] shadow-[0_0_0_999px_rgba(0,0,0,.34)]"><span className="absolute left-1/2 top-2 h-1 w-14 -translate-x-1/2 rounded-full bg-[#FFE23D] motion-safe:animate-pulse motion-reduce:animate-none"/></div>
      </div>
      <div className="mx-auto w-full max-w-[480px] space-y-4 px-5 pb-5 pt-4">
        <label className="block text-sm font-semibold">Ajuster le cadrage <span className="float-right text-white/70">{zoomRecadrage}%</span>
          <input type="range" min="100" max="140" step="5" value={zoomRecadrage} onChange={e => setZoomRecadrage(Number(e.target.value))} className="mt-3 w-full accent-[#FFE23D]"/>
        </label>
        {erreur && <p role="alert" className="rounded-xl bg-red-950/70 p-3 text-sm text-red-100">{erreur}</p>}
        {modePosologie && erreur && <button type="button" onClick={() => router.push("/client/posologie")} className="min-h-11 w-full rounded-full border border-white/30 px-4 text-sm font-bold text-white">Saisir manuellement</button>}
        <button type="button" onClick={() => void recadrerEtLire()} disabled={lectureEnCours || !apercu} className="min-h-14 w-full rounded-full bg-[#FFE23D] px-5 font-extrabold text-[#0B3D26] transition-transform active:scale-[.98] disabled:opacity-60">{lectureEnCours ? "Lecture en cours…" : modePosologie && erreur ? "Réessayer" : "Lire l’image"}</button>
      </div>
      <canvas ref={canvas} className="hidden" aria-hidden="true"/>
    </main>;
  }

  if (ecran === "results") {
    return <main className="min-h-dvh bg-[#F4F8F5] px-4 pb-[calc(100px+env(safe-area-inset-bottom,0px))] pt-[max(16px,env(safe-area-inset-top,0px))] text-[#0B3D26]">
      <header className="mx-auto flex max-w-[480px] items-center justify-between gap-3 py-3">
        <button type="button" onClick={rescanner} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#DFF0E3] text-2xl" aria-label="Rescanner">↶</button>
        <h1 className="flex-1 text-lg font-extrabold">{modePosologie ? "Posologie détectée" : "Résultats de l’ordonnance"}</h1>
        <span className="rounded-full bg-[#FFE23D] px-3 py-1 text-xs font-extrabold">{produits.length} trouvé{produits.length === 1 ? "" : "s"}</span>
      </header>
      <section className="mx-auto max-w-[480px]">
        <p className="mb-4 text-sm leading-5 text-[#53685C]">Vérifiez les noms reconnus. La disponibilité réelle et le statut d’ordonnance sont à confirmer par les données des pharmacies partenaires.</p>
        {produits.length ? <div className="space-y-3">{produits.map(item => <article key={item.id} className="rounded-[22px] border border-[#DCE8DF] bg-white p-4 shadow-sm">
          <label className="block text-xs font-bold text-[#53685C]">Médicament reconnu
            <input value={item.nom} onChange={e => mettreAJourProduit(item.id, { nom: e.target.value })} maxLength={120} className="mt-2 min-h-12 w-full rounded-xl border border-[#D8E5DC] bg-[#FBFDFC] px-3 text-sm font-bold text-[#0B3D26] outline-none focus:border-[#0F6B3F] focus:ring-4 focus:ring-[#0F6B3F]/10"/>
          </label>
          <div className="mt-3 flex items-center justify-between gap-3">
            <label className="text-xs font-semibold text-[#53685C]">Quantité
              <input type="number" min="1" max="10" value={item.quantite} onChange={e => mettreAJourProduit(item.id, { quantite: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} className="mt-1 block h-10 w-20 rounded-xl border border-[#D8E5DC] bg-white px-2 text-sm font-bold text-[#0B3D26]"/>
            </label>
            <span className="rounded-full bg-[#FFF4BE] px-3 py-2 text-xs font-extrabold text-[#6B5700]">{item.statut}</span>
          </div>
          <button type="button" onClick={() => ouvrirPrix(item.nom)} className="mt-3 min-h-10 rounded-full border border-[#0F6B3F] px-4 text-xs font-extrabold text-[#0F6B3F]">Voir les prix</button>
        </article>)}</div> : <div className="rounded-2xl bg-white p-5 text-sm text-[#53685C]">Aucun résultat à afficher. Rescannez une ordonnance plus lisible.</div>}
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#D8E5DC] bg-white p-4">
          <input type="checkbox" checked={configurerRappels} onChange={e => setConfigurerRappels(e.target.checked)} className="mt-1 h-5 w-5 accent-[#0F6B3F]"/>
          <span><strong className="block text-sm">Configurer mes rappels</strong><span className="mt-1 block text-xs leading-5 text-[#64776B]">Les horaires restent modifiables. Aucun schéma ni rappel n’est enregistré avant votre validation.</span></span>
        </label>
        <div className="mt-4 grid gap-3">
          <button type="button" onClick={voirPharmacies} disabled={!produits.length} className="min-h-12 w-full rounded-full bg-[#0F6B3F] px-5 font-extrabold text-white disabled:opacity-50">Voir les pharmacies</button>
          <button type="button" onClick={verifierPosologie} className="min-h-12 w-full rounded-full bg-[#FFE23D] px-5 font-extrabold text-[#0B3D26]">Vérifier la posologie</button>
          <button type="button" onClick={rescanner} className="min-h-12 w-full rounded-full border border-[#0F6B3F] bg-white px-5 font-extrabold text-[#0F6B3F]">Rescanner</button>
        </div>
      </section>
    </main>;
  }

  return <main className={fond} style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
    <header className="mx-auto flex w-full max-w-[480px] items-center justify-between gap-3 px-4 py-3">
      <button type="button" onClick={quitter} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl" aria-label="Retour">‹</button>
      <div className="min-w-0 flex-1 text-center">
        <h1 className="text-base font-extrabold">{modePosologie ? "Scanner une posologie" : modeScan === "boite" ? "Scanner une boîte" : "Scanner mon ordonnance"}</h1>
        <p className="mt-1 inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-[#FFE23D]">{modePosologie ? "Cadrez la posologie écrite" : modeScan === "boite" ? "Cadrez le code-barres" : "Cadrez l’ordonnance"}</p>
      </div>
      <span className="w-10"/>
    </header>
    {!modePosologie && <div className="mx-auto mt-1 grid w-[calc(100%-2rem)] max-w-[448px] grid-cols-2 rounded-full bg-white/10 p-1">
      <button type="button" aria-pressed={modeScan === "ordonnance"} onClick={() => { setModeScan("ordonnance"); setErreur(""); }} className={"min-h-10 rounded-full text-sm font-bold transition-colors " + (modeScan === "ordonnance" ? "bg-[#FFE23D] text-[#0B3D26]" : "text-white/80")}>Ordonnance</button>
      <button type="button" aria-pressed={modeScan === "boite"} onClick={() => { setModeScan("boite"); setErreur(""); }} className={"min-h-10 rounded-full text-sm font-bold transition-colors " + (modeScan === "boite" ? "bg-[#FFE23D] text-[#0B3D26]" : "text-white/80")}>Boîte de médicament</button>
    </div>}
    <div className="relative mx-auto mt-4 flex min-h-0 w-[calc(100%-2rem)] max-w-[448px] flex-1 items-center justify-center overflow-hidden rounded-[30px] border border-white/10 bg-black">
      <video ref={video} autoPlay muted playsInline aria-label="Aperçu de la caméra" className="absolute inset-0 h-full w-full object-cover"/>
      <div className="pointer-events-none absolute inset-[9%] rounded-[24px] border-2 border-[#FFE23D]/90 shadow-[0_0_0_999px_rgba(0,0,0,.25)]">
        <span className="absolute left-1/2 top-0 h-0.5 w-[78%] -translate-x-1/2 bg-[#FFE23D] shadow-[0_0_14px_#FFE23D] motion-safe:animate-[scanner-line_2.2s_ease-in-out_infinite] motion-reduce:animate-none"/>
        <span className="absolute -left-0.5 -top-0.5 h-7 w-7 rounded-tl-2xl border-l-4 border-t-4 border-[#FFE23D]"/>
        <span className="absolute -right-0.5 -top-0.5 h-7 w-7 rounded-tr-2xl border-r-4 border-t-4 border-[#FFE23D]"/>
        <span className="absolute -bottom-0.5 -left-0.5 h-7 w-7 rounded-bl-2xl border-b-4 border-l-4 border-[#FFE23D]"/>
        <span className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-br-2xl border-b-4 border-r-4 border-[#FFE23D]"/>
      </div>
      {!flux && <div className="relative z-10 max-w-[250px] rounded-2xl bg-black/60 p-4 text-center text-sm text-white/90">{erreurCamera || "Activation de la caméra…"}</div>}
    </div>
    <div className="mx-auto w-full max-w-[480px] space-y-3 px-5 pb-5 pt-4">
      {modePosologie && <p className="text-center text-xs text-white/70">Votre posologie reste privée • Traitée localement</p>}
      {erreur && <p role="alert" className="rounded-xl bg-red-950/70 p-3 text-center text-sm text-red-100">{erreur}</p>}
      <div className="flex items-center justify-center gap-6">
        <button type="button" onClick={() => inputFichier.current?.click()} className="flex min-h-12 min-w-[112px] flex-col items-center justify-center rounded-2xl bg-white/10 px-4 py-2 text-xs font-bold text-white transition-transform active:scale-[.97]"><span className="text-lg">▧</span>Importer</button>
        <button type="button" onClick={() => void capturer()} disabled={lectureEnCours} aria-label={modeScan === "boite" ? "Lire le code-barres" : "Prendre une photo"} className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[5px] border-white/90 shadow-[0_0_0_6px_rgba(255,226,61,.22)] transition-transform active:scale-95 motion-reduce:transition-none disabled:opacity-50"><span className="h-[58px] w-[58px] rounded-full bg-[#FFE23D]"/></button>
        <button type="button" onClick={quitter} className="flex min-h-12 min-w-[112px] flex-col items-center justify-center rounded-2xl bg-white/10 px-4 py-2 text-xs font-bold text-white transition-transform active:scale-[.97]"><span className="text-lg">×</span>Fermer</button>
      </div>
      <input ref={inputFichier} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.pdf,.heic,.heif" className="hidden" onChange={e => { const f=e.target.files?.[0]; e.target.value=""; if(f) ouvrirRecadrage(f); }}/>
      <canvas ref={canvas} className="hidden" aria-hidden="true"/>
    </div>
  </main>;
}
