type Pharmacy = { id: string; nom: string; ville: string | null; quartier: string | null };
type Installation = { id: string; pharmacie_id: string; status: string; legal_review_status: string; privacy_notice_status: string; updated_at: string };
type Gateway = { id: string; pharmacie_id: string; tunnel_status: string; last_seen_at: string | null };
type Camera = { id: string; pharmacie_id: string; status: string; model: string | null; zone_label: string };
type SecurityEvent = { id: string; pharmacie_id: string; event_type: string; severity: string; status: string; summary: string; detected_at: string };
type CameraConnection = { id: string; pharmacie_id: string; camera_id: string; adapter_key: string; protocol: string; connection_status: string; last_tested_at: string | null; last_error_code: string | null; is_primary: boolean };

const installationLabel: Record<string, string> = {
  draft: "Brouillon", inventory: "Inventaire", awaiting_review: "En attente de validation",
  pilot_ready: "Prêt pour pilote", pilot_active: "Pilote actif", suspended: "Suspendu", retired: "Retiré",
};
function eventLabel(value: string) {
  const labels: Record<string, string> = {
    motion: "Mouvement", intrusion: "Intrusion", line_crossing: "Franchissement de ligne",
    camera_tamper: "Sabotage caméra", camera_obstructed: "Caméra obstruée",
    signal_lost: "Perte de signal", after_hours_presence: "Présence hors horaires",
    system_offline: "Passerelle hors ligne", other: "Autre événement",
  };
  return labels[value] ?? value;
}

export function PromoteurSecuriteIntelligente({
  pharmacies, installations, gateways, cameras, connections, events, registryAvailable,
}: {
  pharmacies: Pharmacy[];
  installations: Installation[];
  gateways: Gateway[];
  cameras: Camera[];
  connections: CameraConnection[];
  events: SecurityEvent[];
  registryAvailable: boolean;
}) {
  const installationByPharmacy = new Map(installations.map((item) => [item.pharmacie_id, item]));
  const openEvents = events.filter((event) => !["closed", "false_positive"].includes(event.status));
  const protocolLabel: Record<string, string> = {
    onvif: "ONVIF", rtsp: "RTSP", rtsps: "RTSPS chiffré",
    http_api: "API HTTP", https_api: "API HTTPS", vendor_sdk: "SDK fabricant",
    nvr_channel: "Canal NVR/DVR", analog_encoder: "Encodeur analogique", cloud_api: "API Cloud officielle",
  };
  const connectionStatusLabel: Record<string, string> = {
    draft: "À configurer", discovered: "Détectée", requires_credentials: "Identifiants requis",
    testing: "Test en cours", connected: "Connectée et testée", limited: "Connectivité partielle",
    unsupported: "Non compatible", failed: "Échec de connexion", disabled: "Désactivée",
  };
  return (
    <section className="rounded-3xl border border-naxa-green-100 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-naxa-green-700">NAXA · Phase 1</p>
          <h2 className="mt-1 text-lg font-extrabold">Sécurité intelligente</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Architecture multi-marques : ONVIF, RTSP/RTSPS, API/SDK officiels, NVR/DVR et anciennes caméras analogiques via encodeur réseau.
          </p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">Fondation en construction</span>
      </div>
      {!registryAvailable ? (
        <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Le registre de sécurité n’a pas pu être lu. Son état n’est pas interprété et aucun équipement n’est déclaré comme absent.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Pharmacies suivies</p><p className="text-2xl font-extrabold tabular-nums">{pharmacies.length}</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Passerelles déclarées</p><p className="text-2xl font-extrabold tabular-nums">{gateways.length}</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Caméras déclarées</p><p className="text-2xl font-extrabold tabular-nums">{cameras.length}</p></div>
          </div>
          <div className="mt-4 space-y-3">
            {pharmacies.map((pharmacy) => {
              const installation = installationByPharmacy.get(pharmacy.id);
              const pharmacyGateways = gateways.filter((item) => item.pharmacie_id === pharmacy.id);
              const pharmacyCameras = cameras.filter((item) => item.pharmacie_id === pharmacy.id);
              const pharmacyEvents = openEvents.filter((item) => item.pharmacie_id === pharmacy.id);
              return (
                <article key={pharmacy.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><h3 className="font-bold">{pharmacy.nom}</h3><p className="text-xs text-slate-500">{[pharmacy.quartier, pharmacy.ville].filter(Boolean).join(" · ") || "Localisation non renseignée"}</p></div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{installation ? (installationLabel[installation.status] ?? installation.status) : "Non déclarée au registre"}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    <p><span className="text-slate-500">Passerelles :</span> <strong>{pharmacyGateways.length}</strong></p>
                    <p><span className="text-slate-500">Caméras :</span> <strong>{pharmacyCameras.length}</strong></p>
                    <p><span className="text-slate-500">Événements ouverts :</span> <strong>{pharmacyEvents.length}</strong></p>
                  </div>
                  {installation && <p className="mt-2 text-xs text-slate-500">Validation juridique : {installation.legal_review_status} · Information des personnes : {installation.privacy_notice_status}</p>}
                  {pharmacyCameras.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {pharmacyCameras.map((camera) => {
                        const cameraConnections = connections.filter((connection) => connection.camera_id === camera.id);
                        return (
                          <li key={camera.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                            <p className="font-semibold">{camera.zone_label} · {camera.model || "Modèle à identifier"}</p>
                            <p className="mt-1 text-xs text-slate-600">État matériel déclaré : {camera.status}</p>
                            {cameraConnections.length === 0 ? (
                              <p className="mt-1 text-xs text-amber-800">Aucun connecteur configuré.</p>
                            ) : (
                              <ul className="mt-2 space-y-1">
                                {cameraConnections.map((connection) => (
                                  <li key={connection.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <span>{protocolLabel[connection.protocol] ?? connection.protocol} · {connection.adapter_key}</span>
                                    <span className="font-semibold">{connectionStatusLabel[connection.connection_status] ?? connection.connection_status}{connection.is_primary ? " · principal" : ""}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </article>
              );
            })}
            {pharmacies.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Aucune pharmacie active n’est actuellement rattachée à ce réseau.</p>}
          </div>
          <div className="mt-4">
            <h3 className="font-bold">Événements récents</h3>
            {events.length === 0 ? <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Aucun événement enregistré à ce stade.</p> : (
              <ul className="mt-2 space-y-2">
                {events.slice(0, 8).map((event) => {
                  const pharmacy = pharmacies.find((item) => item.id === event.pharmacie_id);
                  return <li key={event.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <p className="font-semibold">{eventLabel(event.event_type)} · {pharmacy?.nom ?? "Pharmacie du réseau"}</p>
                    <p className="mt-1 text-slate-600">{event.summary}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(event.detected_at).toLocaleString("fr-FR")} · {event.severity} · {event.status}</p>
                  </li>;
                })}
              </ul>
            )}
          </div>
        </>
      )}
      <div className="mt-4 rounded-2xl border border-slate-200 p-3 text-sm leading-6 text-slate-700">
        <strong>Compatibilité visée :</strong> caméras IP de marques différentes, caméras Wi-Fi exposant un flux/API autorisé, enregistreurs NVR/DVR multi-canaux et caméras analogiques derrière encodeur. Chaque appareil sera détecté puis qualifié par modèle, firmware et fonctions réellement disponibles. Les APIs/SDK propriétaires ne seront utilisés que lorsqu'ils sont officiellement accessibles.
      </div>
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
        <strong>Non activé à ce stade :</strong> aucun flux vidéo en direct, enregistrement, analyse IA opérationnelle, sonnerie mobile en arrière-plan ou déclenchement physique de sirène n’est fourni par cette phase. Aucun équipement non déclaré n’est supposé installé. L’accès aux écrans de vidéosurveillance restera fermé jusqu’aux validations du pilote.
      </div>
    </section>
  );
}
