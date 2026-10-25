"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PharmacieCarte = {
  id: string;
  nom: string;
  ville: string | null;
  quartier: string | null;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  de_garde: boolean;
  photo_url: string | null;
  photo_verified_at: string | null;
  distanceKm: number | null;
  horaires: string | null;
  stock_updated_at: string | null;
};

type Point = { lat: number; lng: number };

type LeafletLayer = { addTo(map: LeafletMap): LeafletLayer; bindPopup(html: string): LeafletLayer; openPopup(): LeafletLayer; on(event: string, handler: () => void): LeafletLayer; remove(): LeafletLayer };
type LeafletMap = {
  setView(point: [number, number], zoom: number): LeafletMap;
  fitBounds(bounds: [[number, number], [number, number]], options?: { padding?: [number, number]; maxZoom?: number }): LeafletMap;
  remove(): void;
  invalidateSize(): void;
};
type LeafletApi = {
  map(element: HTMLElement, options?: Record<string, unknown>): LeafletMap;
  tileLayer(url: string, options: Record<string, unknown>): LeafletLayer;
  marker(point: [number, number], options?: Record<string, unknown>): LeafletLayer;
  divIcon(options: Record<string, unknown>): unknown;
};
declare global {
  interface Window { L?: LeafletApi; }
}

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

function chargerLeaflet(): Promise<LeafletApi> {
  return new Promise((resolve, reject) => {
    if (window.L) { resolve(window.L); return; }
    if (!document.querySelector('link[data-naxa-leaflet="css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      link.dataset.naxaLeaflet = "css";
      document.head.appendChild(link);
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-naxa-leaflet="js"]');
    if (existing) {
      existing.addEventListener("load", () => window.L ? resolve(window.L) : reject(new Error("Leaflet indisponible.")), { once: true });
      existing.addEventListener("error", () => reject(new Error("Impossible de charger la carte.")), { once: true });
      if (window.L) resolve(window.L);
      return;
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.dataset.naxaLeaflet = "js";
    script.onload = () => window.L ? resolve(window.L) : reject(new Error("Leaflet indisponible."));
    script.onerror = () => reject(new Error("Impossible de charger la carte."));
    document.head.appendChild(script);
  });
}

export default function CartePharmaciesProches({
  pharmacies,
  position,
  onLocaliser,
}: {
  pharmacies: PharmacieCarte[];
  position: Point | null;
  onLocaliser: () => void;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletLayer>>(new Map());
  const userMarkerRef = useRef<LeafletLayer | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const pharmaciesAvecGPS = useMemo(
    () => pharmacies.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat !== null && p.lng !== null),
    [pharmacies],
  );

  useEffect(() => {
    let cancelled = false;
    void chargerLeaflet().then(L => {
      if (cancelled || !mapElement.current || mapRef.current) return;
      const map = L.map(mapElement.current, { scrollWheelZoom: false, preferCanvas: true });
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);
      map.setView(position ? [position.lat, position.lng] : [3.848, 11.502], position ? 13 : 12);
      setMapReady(true);
    }).catch(() => {
      if (!cancelled) setMapError("La carte interactive est indisponible. La liste des pharmacies reste accessible ci-dessous.");
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L || !mapReady) return;
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    const bounds: [number, number][] = [];
    pharmaciesAvecGPS.forEach(p => {
      const point: [number, number] = [p.lat as number, p.lng as number];
      const marker = L.marker(point, {
        icon: L.divIcon({
          className: "naxa-pharmacy-marker-wrap",
          html: '<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:' + (p.de_garde ? "#FFE23D" : "#0F6B3F") + ';box-shadow:0 2px 8px #0005"><span style="transform:rotate(45deg);font-weight:900;color:' + (p.de_garde ? "#0B3D26" : "#fff") + ';font-size:13px">+</span></span>',
          iconSize: [30, 36],
          iconAnchor: [15, 34],
          popupAnchor: [0, -30],
        }),
      }).addTo(map);
      marker.on("click", () => setSelectedId(p.id));
      markersRef.current.set(p.id, marker);
      bounds.push(point);
    });
    if (position) {
      const you = L.marker([position.lat, position.lng], {
        icon: L.divIcon({
          className: "naxa-user-marker-wrap",
          html: '<span style="display:block;width:16px;height:16px;border:3px solid white;border-radius:50%;background:#2563EB;box-shadow:0 0 0 7px #2563EB33"></span>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
        title: "Votre position",
      }).addTo(map);
      userMarkerRef.current = you;
      bounds.push([position.lat, position.lng]);
    }
    if (bounds.length > 1) map.fitBounds([bounds.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1])], [90, 180]), bounds.reduce((a, p) => [Math.max(a[0], p[0]), Math.max(a[1], p[1])], [-90, -180])] as [[number, number], [number, number]], { padding: [24, 24], maxZoom: 14 });
    else if (bounds.length === 1) map.setView(bounds[0], 14);
    else if (position) map.setView([position.lat, position.lng], 13);
    window.setTimeout(() => map.invalidateSize(), 100);
  }, [pharmaciesAvecGPS, position, mapReady]);

  const ouvrirPharmacie = useCallback((p: PharmacieCarte) => {
    setSelectedId(p.id);
    const map = mapRef.current;
    const marker = markersRef.current.get(p.id);
    if (map && p.lat != null && p.lng != null) {
      map.setView([p.lat, p.lng], 16);

    }
  }, []);

  return () => { active = false; };
    }
    setDisponibilites([]);
    setDisponibilitesState("loading");
    void (async () => {
      try {
        const sb = supabaseBrowser();
        const today = new Date().toISOString().slice(0, 10);
        const { data: stocks, error: stockError } = await sb
          .from("stocks")
          .select("produit_id,prix,quantite,date_peremption")
          .eq("pharmacie_id", selectedPharmacyId)
          .gt("quantite", 0)
          .or(`date_peremption.is.null,date_peremption.gte.${today}`)
          .limit(100);
        if (stockError) throw stockError;
        const rows = stocks ?? [];
        const ids = [...new Set(rows.map((row) => row.produit_id).filter(Boolean))];
        const { data: products, error: productsError } = ids.length
          ? await sb.from("produits").select("id,nom,dosage,forme").in("id", ids)
          : { data: [], error: null };
        if (productsError) throw productsError;
        if (!active) return;
        const productById = new Map((products ?? []).map((product) => [product.id, product]));
        setDisponibilites(rows.flatMap((row) => {
          const product = productById.get(row.produit_id);
          if (!product || Number(row.quantite) <= 0) return [];
          return [{
            id: row.produit_id,
            nom: product.nom,
            dosage: product.dosage ?? null,
            forme: product.forme ?? null,
            prix: Number(row.prix),
            quantite: Number(row.quantite),
          }];
        }));
        setDisponibilitesState("ready");
      } catch {
        if (active) setDisponibilitesState("error");
      }
    })();
    return () => { active = false; };
  }, [selectedPharmacyId]);

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#D7E7DC] bg-white shadow-[0_12px_28px_rgba(5,74,41,0.12)]" aria-labelledby="naxa-map-title">
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <h3 id="naxa-map-title" className="text-lg font-extrabold text-[#0B3D26]">Pharmacies à proximité</h3>
          <p className="mt-1 text-sm text-[#64776B]">{pharmacies.length} partenaire{pharmacies.length === 1 ? "" : "s"} · {pharmaciesAvecGPS.length} position{pharmaciesAvecGPS.length === 1 ? "" : "s"} GPS vérifiable{pharmaciesAvecGPS.length === 1 ? "" : "s"}</p>
        </div>
        <button type="button" onClick={onLocaliser} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-[#FFE23D] px-3 text-sm font-extrabold text-[#0B3D26]" aria-label="Activer le GPS pour calculer les distances">
          <span aria-hidden="true">⌖</span> Ma position
        </button>
      </div>
      <div className="relative">
        <div ref={mapElement} className="h-[280px] w-full bg-[#E2F2EF] sm:h-[340px]" role="application" aria-label="Carte interactive des pharmacies partenaires NAXA" />
        {!mapReady && !mapError && <div className="absolute inset-0 flex items-center justify-center bg-[#E2F2EF]/90 p-4 text-center text-sm font-semibold text-[#0B3D26]">Chargement de la carte…</div>}
        {mapError && <div role="status" className="absolute inset-x-3 top-3 rounded-xl bg-white/95 p-3 text-sm text-[#53685C] shadow">{mapError}</div>}
        {pharmaciesAvecGPS.length === 0 && <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-white/95 p-3 text-sm text-[#53685C] shadow">Aucune pharmacie partenaire avec coordonnées GPS disponibles dans les données chargées. Les positions manquantes ne sont pas inventées.</div>}
      </div>
      <p className="border-t border-[#E5EEE8] px-4 py-3 text-[11px] leading-4 text-[#738277]">Carte © OpenStreetMap contributors. Les marqueurs représentent uniquement les pharmacies partenaires NAXA dont les coordonnées sont disponibles. La carte ne confirme pas le stock.</p>
    </section>
  );
}
