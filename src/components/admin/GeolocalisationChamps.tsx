"use client";

import { useState } from "react";

export function GeolocalisationChamps({ className = "champ mt-1" }: { className?: string }) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"gps" | "saisie_manuelle">("saisie_manuelle");

  function localiser() {
    if (!window.isSecureContext) {
      setStatus("La localisation nécessite une connexion sécurisée HTTPS. Ouvrez NAXA avec son adresse https://.");
      return;
    }
    if (!navigator.geolocation) {
      setStatus("Ce navigateur ne prend pas en charge la géolocalisation. Saisissez les coordonnées manuellement.");
      return;
    }

    setLoading(true);
    setStatus("Recherche de votre position GPS… Vérifiez que la localisation est activée sur le téléphone.");

    const success = ({ coords }: GeolocationPosition) => {
      setLat(coords.latitude.toFixed(7));
      setLng(coords.longitude.toFixed(7));
      setSource("gps");
      setLoading(false);
      setStatus("Coordonnées récupérées. Vérifiez que le point correspond bien à la pharmacie avant d’enregistrer.");
    };

    const failure = (error: GeolocationPositionError) => {
      setLoading(false);
      if (error.code === error.PERMISSION_DENIED) {
        setStatus("Accès refusé. Dans les paramètres Android, activez Localisation, puis autorisez la localisation pour Chrome (Paramètres du site → Localisation). Rechargez la page et réessayez.");
      } else if (error.code === error.TIMEOUT) {
        setStatus("Le GPS n’a pas répondu à temps. Activez la localisation précise, rapprochez-vous d’une fenêtre ou de l’extérieur, puis réessayez.");
      } else {
        setStatus("Position indisponible. Activez le GPS et les services de localisation, vérifiez l’autorisation de Chrome, puis réessayez.");
      }
    };

    // First request a precise GPS fix. If it times out, retry with a recent/network-assisted position.
    navigator.geolocation.getCurrentPosition(
      success,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          failure(error);
          return;
        }
        setStatus("Recherche GPS précise infructueuse ; tentative avec la position réseau…");
        navigator.geolocation.getCurrentPosition(
          success,
          failure,
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 120000 }
        );
      },
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
    );
  }

  return <section className="space-y-2">
    <input type="hidden" name="geo_source_type" value={source}/>
    <div className="grid grid-cols-2 gap-3">
      <label className="block text-sm font-semibold">Latitude<input name="lat" type="number" step="any" min="-90" max="90" required value={lat} onChange={e => { setLat(e.target.value); setSource("saisie_manuelle"); }} className={className}/></label>
      <label className="block text-sm font-semibold">Longitude<input name="lng" type="number" step="any" min="-180" max="180" required value={lng} onChange={e => { setLng(e.target.value); setSource("saisie_manuelle"); }} className={className}/></label>
    </div>
    <button type="button" onClick={localiser} disabled={loading} className="btn w-full border border-naxa-green-700 text-naxa-green-900 disabled:opacity-60">
      {loading ? "Recherche de la position…" : "◎ Utiliser ma position pour remplir les coordonnées"}
    </button>
    {status && <p role="status" aria-live="polite" className="text-sm text-slate-600">{status}</p>}
  </section>;
}
