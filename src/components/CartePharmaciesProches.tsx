"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  telephone?: string | null;
  stock_updated_at: string | null;
  livraison_active?: boolean;
  distanceRoutiereKm?: number | null;
  dureeTrajetMinutes?: number | null;
  fraisLivraisonIndicatifs?: number | null;
  googleMapsUrl?: string | null;
};
type Point = { lat: number; lng: number };
type LeafletLayer = { addTo(map: LeafletMap): LeafletLayer; remove(): LeafletLayer };
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
declare global { interface Window { L?: LeafletApi; } }

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
  const markersRef = useRef<LeafletLayer[]>([]);
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const pharmaciesAvecGPS = useMemo(
    () => pharmacies.filter(p => p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [pharmacies],
  );
  const pharmaciesAvecContact = useMemo(() => pharmacies
    .filter(p => p.nom.trim())
    .slice()
    .sort((a, b) => (a.distanceRoutiereKm ?? a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceRoutiereKm ?? b.distanceKm ?? Number.POSITIVE_INFINITY))
    .slice(0, 5), [pharmacies]);

  useEffect(() => {
    let cancelled = false;
    void chargerLeaflet().then(L => {
      if (cancelled || !mapElement.current || mapRef.current) return;
      const map = L.map(mapElement.current, { scrollWheelZoom: false, preferCanvas: true });
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);
      map.setView(position ? [position.lat, position.lng] : [6.0, 12.5], position ? 13 : 6);
      setMapReady(true);
    }).catch(() => {
      if (!cancelled) setMapError("La carte interactive est indisponible. Vous pouvez toujours utiliser la recherche.");
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L || !mapReady) return;
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    const bounds: [number, number][] = [];
    pharmaciesAvecGPS.forEach(p => {
      const point: [number, number] = [p.lat as number, p.lng as number];
      const marker = L.marker(point, {
        icon: L.divIcon({
          className: "naxa-pharmacy-marker-wrap",
          html: '<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:' + (p.de_garde ? "#FFE23D" : "#0F6B3F") + ';box-shadow:0 2px 8px #0005"><span style="transform:rotate(45deg);font-weight:900;color:' + (p.de_garde ? "#0B3D26" : "#fff") + ';font-size:13px">+</span></span>',
          iconSize: [30, 36],
          iconAnchor: [15, 34],
        }),
      }).addTo(map);
      markersRef.current.push(marker);
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
      }).addTo(map);
      markersRef.current.push(you);
      bounds.push([position.lat, position.lng]);
    }
    if (bounds.length > 1) {
      const southWest: [number, number] = [Math.min(...bounds.map(p => p[0])), Math.min(...bounds.map(p => p[1]))];
      const northEast: [number, number] = [Math.max(...bounds.map(p => p[0])), Math.max(...bounds.map(p => p[1]))];
      map.fitBounds([southWest, northEast], { padding: [24, 24], maxZoom: 14 });
    } else if (bounds.length === 1) map.setView(bounds[0], 14);
    else if (position) map.setView([position.lat, position.lng], 13);
    window.setTimeout(() => map.invalidateSize(), 100);
  }, [pharmaciesAvecGPS, position, mapReady]);

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#D7E7DC] bg-white shadow-[0_12px_28px_rgba(5,74,41,0.12)]" aria-labelledby="naxa-map-title">
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <h3 id="naxa-map-title" className="text-lg font-extrabold text-[#0B3D26]">Pharmacies à proximité</h3>
          <p className="mt-1 text-sm text-[#64776B]">Localisation et coordonnées publiques des pharmacies proches. Les stocks ne sont pas affichés ici.</p>
        </div>
        <button type="button" onClick={onLocaliser} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-[#FFE23D] px-3 text-sm font-extrabold text-[#0B3D26]" aria-label="Activer le GPS pour trouver la pharmacie la plus proche">
          <span aria-hidden="true">⌖</span> Ma position
        </button>
      </div>
      <div className="relative">
        <div ref={mapElement} className="h-[280px] w-full bg-[#E2F2EF] sm:h-[340px]" role="application" aria-label="Carte des repères des pharmacies partenaires, sans fiches détaillées" />
        {!mapReady && !mapError && <div className="absolute inset-0 flex items-center justify-center bg-[#E2F2EF]/90 p-4 text-center text-sm font-semibold text-[#0B3D26]">Chargement de la carte…</div>}
        {mapError && <div role="status" className="absolute inset-x-3 top-3 rounded-xl bg-white/95 p-3 text-sm text-[#53685C] shadow">{mapError}</div>}
        {pharmaciesAvecGPS.length === 0 && <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-white/95 p-3 text-sm text-[#53685C] shadow">Aucune pharmacie partenaire avec coordonnées GPS disponibles. Les positions manquantes ne sont pas inventées.</div>}
      </div>
      <div className="space-y-2 border-t border-[#E5EEE8] p-3 sm:p-4" aria-label="Coordonnées publiques des pharmacies proches">
        {pharmaciesAvecContact.map(p => {
          const telephone = typeof p.telephone === "string" ? p.telephone.replace(/[^+\d]/g, "") : "";
          const lieu = [p.adresse, p.quartier, p.ville].filter((value): value is string => Boolean(value?.trim())).join(", ");
          return <article key={p.id} className="rounded-2xl border border-[#DCE9DF] bg-[#F8FBF8] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="font-extrabold leading-5 text-[#0B3D26]">{p.nom}</h4>
                {lieu && <p className="mt-1 text-sm leading-5 text-[#53685C]">{lieu}</p>}
                {p.distanceRoutiereKm != null
                  ? <p className="mt-1 text-xs font-bold text-[#0F6B3F]">{p.distanceRoutiereKm.toLocaleString("fr-FR",{maximumFractionDigits:1})} km par la route{p.dureeTrajetMinutes ? " · environ " + p.dureeTrajetMinutes + " min" : ""}</p>
                  : p.distanceKm != null && <p className="mt-1 text-xs text-[#64776B]">{p.distanceKm.toLocaleString("fr-FR",{maximumFractionDigits:1})} km à vol d’oiseau · route indisponible</p>}
                {p.livraison_active && p.fraisLivraisonIndicatifs != null && <p className="mt-1 text-xs font-semibold text-[#53685C]">Livraison estimée : {p.fraisLivraisonIndicatifs.toLocaleString("fr-FR")} FCFA (à confirmer au devis)</p>}
                {p.horaires?.trim() && <p className="mt-1 text-xs leading-5 text-[#64776B]">Horaires publiés : {p.horaires}</p>}
                {!telephone && <p className="mt-1 text-xs leading-5 text-[#64776B]">Téléphone public non renseigné.</p>}
                {position && <a className="mt-2 inline-flex text-xs font-extrabold text-[#0F6B3F] underline" href={p.googleMapsUrl || ("https://www.google.com/maps/dir/?api=1&origin=" + position.lat + "," + position.lng + "&destination=" + p.lat + "," + p.lng + "&travelmode=driving")} target="_blank" rel="noreferrer">Ouvrir l’itinéraire dans Google Maps</a>}
              </div>
              {telephone && <a href={"tel:" + telephone} aria-label={"Appeler " + p.nom + " au " + p.telephone} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#0F6B3F] px-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#0B3D26] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6B3F]">
                <span aria-hidden="true">☎</span> Appeler
              </a>}
            </div>
          </article>;
        })}
        {pharmaciesAvecContact.length === 0 && <p className="rounded-xl bg-[#F8FBF8] p-3 text-sm text-[#53685C]">Aucune coordonnée publique de pharmacie n’est disponible pour le moment.</p>}
      </div>
      <p className="border-t border-[#E5EEE8] px-4 py-3 text-[11px] leading-4 text-[#738277]">Carte © OpenStreetMap contributors. Les coordonnées, horaires et téléphones ne sont affichés que s’ils sont renseignés dans les données publiques; aucun stock n’est présenté.</p>
    </section>
  );
}
