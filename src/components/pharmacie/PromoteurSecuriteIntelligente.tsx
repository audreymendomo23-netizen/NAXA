"use client";

import { useMemo, useState } from "react";

type Pharmacy = { id: string; nom: string; ville: string | null; quartier: string | null };
type Installation = { id: string; pharmacie_id: string; status: string; legal_review_status: string; privacy_notice_status: string; updated_at: string };
type Gateway = { id: string; pharmacie_id: string; tunnel_status: string; last_seen_at: string | null };
type Camera = { id: string; pharmacie_id: string; status: string; model: string | null; zone_label: string };
type SecurityEvent = { id: string; pharmacie_id: string; event_type: string; severity: string; status: string; summary: string; detected_at: string };
type CameraConnection = { id: string; pharmacie_id: string; camera_id: string; adapter_key: string; protocol: string; connection_status: string; last_tested_at: string | null; last_error_code: string | null; is_primary: boolean };

type Props = {
  pharmacies: Pharmacy[];
  installations: Installation[];
  gateways: Gateway[];
  cameras: Camera[];
  connections: CameraConnection[];
  events: SecurityEvent[];
  registryAvailable: boolean;
};

const installationLabel: Record<string, string> = {
  draft: "Brouillon",
  inventory: "Inventaire",
  awaiting_review: "En attente de validation",
  pilot_ready: "Prêt pour pilote",
  pilot_active: "Pilote actif",
  suspended: "Suspendu",
  retired: "Retiré",
};

const connectionStatusLabel: Record<string, string> = {
  draft: "À configurer",
  discovered: "Détectée",
  requires_credentials: "Identifiants requis",
  testing: "Test en cours",
  connected: "Connexion testée",
  limited: "Connectivité partielle",
  unsupported: "Non compatible",
  failed: "Échec de connexion",
  disabled: "Désactivée",
};

const protocolLabel: Record<string, string> = {
  onvif: "ONVIF",
  rtsp: "RTSP",
  rtsps: "RTSPS chiffré",
  http_api: "API HTTP",
  https_api: "API HTTPS",
  vendor_sdk: "SDK fabricant",
  nvr_channel: "Canal NVR/DVR",
  analog_encoder: "Encodeur analogique",
  cloud_api: "API Cloud officielle",
};

function eventLabel(value: string) {
  const labels: Record<string, string> = {
    motion: "Mouvement",
    intrusion: "Intrusion",
    line_crossing: "Franchissement de ligne",
    camera_tamper: "Sabotage caméra",
    camera_obstructed: "Caméra obstruée",
    signal_lost: "Perte de signal",
    after_hours_presence: "Présence hors horaires",
    system_offline: "Passerelle hors ligne",
    other: "Autre événement",
  };
  return labels[value] ?? value;
}

function connectionForCamera(cameraId: string, connections: CameraConnection[]) {
  const matching = connections.filter((connection) => connection.camera_id === cameraId);
  return matching.find((connection) => connection.is_primary) ?? matching[0] ?? null;
}

function CameraGlyph({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5h11.5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H3z" />
      <path d="m16.5 11 4.5-2.5v9L16.5 15" />
      <path d="M7 8.5 8.5 6h4L14 8.5" />
    </svg>
  );
}

export function PromoteurSecuriteIntelligente({
  pharmacies,
  installations,
  gateways,
  cameras,
  connections,
  events,
  registryAvailable,
}: Props) {
  const [selectedPharmacyId, setSelectedPharmacyId] = useState("all");
  const [focusedCameraId, setFocusedCameraId] = useState<string | null>(null);
  const [cameraPage, setCameraPage] = useState(0);

  const visibleCameras = useMemo(
    () => selectedPharmacyId === "all"
      ? cameras
      : cameras.filter((camera) => camera.pharmacie_id === selectedPharmacyId),
    [cameras, selectedPharmacyId],
  );
  const visibleEvents = selectedPharmacyId === "all"
    ? events
    : events.filter((event) => event.pharmacie_id === selectedPharmacyId);
  const openEvents = visibleEvents.filter((event) => !["closed", "false_positive"].includes(event.status));
  const connectedCount = connections.filter((connection) => connection.connection_status === "connected").length;
  const pageCount = Math.max(1, Math.ceil(visibleCameras.length / 4));
  const safePage = Math.min(cameraPage, pageCount - 1);
  const pageCameras = visibleCameras.slice(safePage * 4, safePage * 4 + 4);
  const focusedCamera = visibleCameras.find((camera) => camera.id === focusedCameraId) ?? null;
  const installationByPharmacy = new Map(installations.map((item) => [item.pharmacie_id, item]));
  const pharmacyById = new Map(pharmacies.map((item) => [item.id, item]));

  const changePharmacy = (value: string) => {
    setSelectedPharmacyId(value);
    setCameraPage(0);
    setFocusedCameraId(null);
  };

  const moveFocus = (direction: -1 | 1) => {
    if (!focusedCamera) return;
    const index = visibleCameras.findIndex((camera) => camera.id === focusedCamera.id);
    const nextIndex = (index + direction + visibleCameras.length) % visibleCameras.length;
    setFocusedCameraId(visibleCameras[nextIndex]?.id ?? null);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-naxa-green-100 bg-white">
      <header className="bg-naxa-green-900 p-4 text-white sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-white/70">NAXA · Surveillance du réseau</p>
            <h2 className="mt-1 text-xl font-extrabold sm:text-2xl">Sécurité intelligente</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
              Retrouvez les caméras des pharmacies autorisées, regroupez-les par quatre et passez d’un site à l’autre depuis votre téléphone.
            </p>
          </div>
          <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-extrabold text-amber-950">Centre de surveillance en préparation</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-[11px] text-white/70">Caméras déclarées</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{cameras.length}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-[11px] text-white/70">Connexions testées</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{connectedCount}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-[11px] text-white/70">Alertes ouvertes</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{openEvents.length}</p>
          </div>
        </div>
      </header>

      <div className="space-y-5 p-4 sm:p-6">
        {!registryAvailable ? (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Le registre de sécurité n’a pas pu être lu. Son état n’est pas interprété et aucun équipement n’est déclaré comme absent.
          </p>
        ) : (
          <>
            <section aria-label="Sélection du périmètre de surveillance" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Pharmacie à surveiller</span>
                <select
                  value={selectedPharmacyId}
                  onChange={(event) => changePharmacy(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-naxa-green-700 focus:ring-2 focus:ring-naxa-green-100"
                >
                  <option value="all">Toutes mes pharmacies</option>
                  {pharmacies.map((pharmacy) => (
                    <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.nom} · {[pharmacy.quartier, pharmacy.ville].filter(Boolean).join(" · ")}</option>
                  ))}
                </select>
              </label>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <strong>{visibleCameras.length}</strong> caméra(s) dans cette vue
              </div>
            </section>

            {focusedCamera ? (
              <section role="dialog" aria-modal="true" aria-label="Vue caméra agrandie" className="fixed inset-0 z-[120] overflow-y-auto bg-white p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" onClick={() => setFocusedCameraId(null)} className="min-h-10 rounded-full border border-slate-300 px-4 text-sm font-bold text-slate-800 hover:bg-slate-50">
                    ← Retour aux quatre écrans
                  </button>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => moveFocus(-1)} className="min-h-10 rounded-full border border-slate-300 px-3 text-sm font-bold" aria-label="Caméra précédente">‹ Précédente</button>
                    <button type="button" onClick={() => moveFocus(1)} className="min-h-10 rounded-full border border-slate-300 px-3 text-sm font-bold" aria-label="Caméra suivante">Suivante ›</button>
                  </div>
                </div>
                <article className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-slate-950 p-5 text-center text-white">
                    <CameraGlyph className="h-12 w-12 text-slate-400" />
                    <p className="font-bold">Flux vidéo réel non encore connecté</p>
                    <p className="max-w-md text-xs leading-5 text-slate-300">Cette vue grand format est prête pour le lecteur sécurisé. Elle ne diffuse pas d’image simulée ni de flux provenant d’une caméra non testée.</p>
                  </div>
                  <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div>
                      <h3 className="font-extrabold">{focusedCamera.zone_label}</h3>
                      <p className="text-sm text-slate-600">{pharmacyById.get(focusedCamera.pharmacie_id)?.nom ?? "Pharmacie du réseau"} · {focusedCamera.model || "Modèle à identifier"}</p>
                    </div>
                    <CameraConnectionBadge camera={focusedCamera} connections={connections} />
                  </div>
                </article>
              </section>
            ) : (
              <section aria-label="Vue multi-caméras">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold">Vue multi-écrans</h3>
                    <p className="text-xs text-slate-500">Quatre emplacements · sélectionnez une case pour l’agrandir</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">Vue {safePage + 1}/{pageCount}</span>
                </div>

                {pageCameras.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                    <CameraGlyph className="mx-auto h-10 w-10 text-slate-400" />
                    <h3 className="mt-2 font-bold">Aucune caméra déclarée pour cette vue</h3>
                    <p className="mt-1 text-sm text-slate-600">Les caméras apparaîtront ici après leur inventaire et leur rattachement à une pharmacie de votre réseau.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {pageCameras.map((camera) => (
                      <button
                        key={camera.id}
                        type="button"
                        onClick={() => setFocusedCameraId(camera.id)}
                        className="group min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-naxa-green-700 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naxa-green-700"
                        aria-label={"Agrandir " + camera.zone_label}
                      >
                        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-slate-950 p-2 text-center text-white">
                          <CameraGlyph className="h-7 w-7 text-slate-400 sm:h-8 sm:w-8" />
                          <span className="text-[10px] font-extrabold uppercase tracking-wide text-amber-200 sm:text-xs">Flux non activé</span>
                          <span className="text-[10px] text-slate-300">Aperçu sécurisé à connecter</span>
                        </div>
                        <div className="space-y-1 p-2 sm:p-3">
                          <p className="truncate text-xs font-extrabold sm:text-sm">{camera.zone_label}</p>
                          <p className="truncate text-[10px] text-slate-500 sm:text-xs">{pharmacyById.get(camera.pharmacie_id)?.nom ?? "Pharmacie"} · {camera.model || "Modèle à identifier"}</p>
                          <CameraConnectionBadge camera={camera} connections={connections} compact />
                        </div>
                      </button>
                    ))}
                    {Array.from({ length: Math.max(0, 4 - pageCameras.length) }).map((_, index) => (
                      <div key={"empty-" + index} className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2 text-center text-xs text-slate-500">
                        Emplacement caméra libre
                      </div>
                    ))}
                  </div>
                )}

                {pageCount > 1 && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <button type="button" disabled={safePage === 0} onClick={() => setCameraPage((page) => Math.max(0, page - 1))} className="min-h-10 rounded-full border border-slate-300 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40">← Précédentes</button>
                    <span className="text-xs text-slate-500">Caméras {safePage * 4 + 1} à {Math.min((safePage + 1) * 4, visibleCameras.length)} sur {visibleCameras.length}</span>
                    <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setCameraPage((page) => Math.min(pageCount - 1, page + 1))} className="min-h-10 rounded-full border border-slate-300 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40">Suivantes →</button>
                  </div>
                )}
              </section>
            )}

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-extrabold">État des installations</h3>
                <span className="text-xs text-slate-500">{pharmacies.length} pharmacie(s) dans le réseau autorisé</span>
              </div>
              {pharmacies.map((pharmacy) => {
                const installation = installationByPharmacy.get(pharmacy.id);
                const pharmacyGateways = gateways.filter((item) => item.pharmacie_id === pharmacy.id);
                const pharmacyCameras = cameras.filter((item) => item.pharmacie_id === pharmacy.id);
                return (
                  <article key={pharmacy.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold">{pharmacy.nom}</h4>
                        <p className="text-xs text-slate-500">{[pharmacy.quartier, pharmacy.ville].filter(Boolean).join(" · ") || "Localisation non renseignée"}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{installation ? (installationLabel[installation.status] ?? installation.status) : "Non déclarée au registre"}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:text-sm">
                      <p><span className="text-slate-500">Passerelles :</span> <strong>{pharmacyGateways.length}</strong></p>
                      <p><span className="text-slate-500">Caméras :</span> <strong>{pharmacyCameras.length}</strong></p>
                      <p><span className="text-slate-500">Alertes :</span> <strong>{openEvents.filter((event) => event.pharmacie_id === pharmacy.id).length}</strong></p>
                    </div>
                    {installation && <p className="mt-2 text-xs text-slate-500">Validation juridique : {installation.legal_review_status} · Information des personnes : {installation.privacy_notice_status}</p>}
                  </article>
                );
              })}
            </section>

            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-extrabold">Événements de sécurité</h3>
                <span className="text-xs text-slate-500">Historique enregistré, pas un flux temps réel</span>
              </div>
              {visibleEvents.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Aucun événement enregistré à ce stade.</p>
              ) : (
                <ul className="space-y-2">
                  {visibleEvents.slice(0, 10).map((event) => (
                    <li key={event.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold">{eventLabel(event.event_type)} · {pharmacyById.get(event.pharmacie_id)?.nom ?? "Pharmacie du réseau"}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold">{event.severity}</span>
                      </div>
                      <p className="mt-1 text-slate-600">{event.summary}</p>
                      <p className="mt-1 text-xs text-slate-500">{new Date(event.detected_at).toLocaleString("fr-FR")} · {event.status}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <div className="rounded-2xl border border-slate-200 p-3 text-sm leading-6 text-slate-700">
          <strong>Compatibilité visée :</strong> caméras IP de marques différentes, caméras Wi-Fi exposant un flux/API autorisé, enregistreurs NVR/DVR multi-canaux et caméras analogiques derrière encodeur. Chaque appareil doit être qualifié par modèle, firmware et fonctions disponibles. Les APIs/SDK propriétaires ne sont utilisés que lorsqu'ils sont officiellement accessibles.
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          <strong>Limite actuelle :</strong> la grille, le filtre par pharmacie, la sélection d'une caméra et la navigation entre caméras sont construits. Les zones vidéo restent volontairement inactives : aucun flux réel, enregistrement, analyse IA, notification sonore en arrière-plan ou déclenchement physique de sirène n'est encore validé sur matériel.
        </div>
      </div>
    </section>
  );
}

function CameraConnectionBadge({ camera, connections, compact = false }: { camera: Camera; connections: CameraConnection[]; compact?: boolean }) {
  const connection = connectionForCamera(camera.id, connections);
  if (!connection) {
    return <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-900">Connecteur à configurer</span>;
  }
  const tested = connection.connection_status === "connected";
  return (
    <span className={"inline-flex max-w-full flex-wrap items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold " + (tested ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900")}>
      <span>{tested ? "Connexion testée" : (connectionStatusLabel[connection.connection_status] ?? connection.connection_status)}</span>
      {!compact && <span>· {protocolLabel[connection.protocol] ?? connection.protocol}</span>}
    </span>
  );
}
