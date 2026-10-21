"use client";

import { useState } from "react";

export function GeolocalisationChamps({ className = "champ mt-1" }: { className?: string }) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  function localiser() {
    if (!navigator.geolocation) {
      setStatus("La géolocalisation n’est pas prise en charge par cet appareil.");
      return;
    }
    setLoading(true);
    setStatus("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLat(coords.latitude.toFixed(7));
        setLng(coords.longitude.toFixed(7));
        setLoading(false);
        setStatus("Coordonnées récupérées. Vérifiez que le point correspond à la pharmacie.");
      },
      (error) => {
        setLoading(false);
        setStatus(error.code === error.PERMISSION_DENIED
          ? "Autorisez la localisation dans votre navigateur puis réessayez."
          : "Position indisponible. Vérifiez le GPS et réessayez.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return <section className="space-y-2">
    <div className="grid grid-cols-2 gap-3">
      <label className="block text-sm font-semibold">Latitude<input name="lat" type="number" step="any" min="-90" max="90" required value={lat} onChange={e => setLat(e.target.value)} className={className}/></label>
      <label className="block text-sm font-semibold">Longitude<input name="lng" type="number" step="any" min="-180" max="180" required value={lng} onChange={e => setLng(e.target.value)} className={className}/></label>
    </div>
    <button type="button" onClick={localiser} disabled={loading} className="btn w-full border border-naxa-green-700 text-naxa-green-900 disabled:opacity-60">
      {loading ? "Localisation en cours…" : "◎ Utiliser ma position pour remplir les coordonnées"}
    </button>
    {status && <p role="status" className="text-sm text-slate-600">{status}</p>}
  </section>;
}
