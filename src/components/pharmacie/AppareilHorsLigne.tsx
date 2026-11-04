"use client";

import { useEffect, useState } from "react";
import { DebloquerAppareil } from "@/components/pharmacie/DebloquerAppareil";
import { EtatHorsLigne } from "@/components/pharmacie/EtatHorsLigne";
import {
  activateLocalDevice,
  getLocalDeviceIdentity,
  getLocalInstallationId,
  getUnlockedDevice,
  hasLocalDevice,
} from "@/lib/offline-db";

type Props = {
  pharmacyId: string;
  pharmacyName: string;
};

export function AppareilHorsLigne({ pharmacyId, pharmacyName }: Props) {
  const [knownDevice, setKnownDevice] = useState(false);
  const [samePharmacy, setSamePharmacy] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [deviceName, setDeviceName] = useState("Poste pharmacie");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [identity, exists] = await Promise.all([getLocalDeviceIdentity(), hasLocalDevice()]);
      if (cancelled) return;
      setKnownDevice(exists);
      setSamePharmacy(Boolean(identity && identity.pharmacyId === pharmacyId));
      const active = getUnlockedDevice();
      setUnlocked(Boolean(active && active.pharmacyId === pharmacyId));
      if (identity && identity.pharmacyId !== pharmacyId) {
        setError("Cet appareil local est déjà associé à une autre pharmacie. Les données en attente doivent être traitées avant tout changement d'association.");
      } else if (exists && !identity) {
        setError("Les informations de l'appareil local sont incomplètes. Ne réinitialisez pas la file hors ligne avant vérification.");
      }
    })();
    return () => { cancelled = true; };
  }, [pharmacyId]);

  async function activate() {
    setError("");
    if (!/^\d{4,6}$/.test(pin) || pin !== confirmPin) {
      setError("Saisissez deux fois le même PIN de 4 à 6 chiffres.");
      return;
    }
    if (!navigator.onLine) {
      setError("L'activation initiale nécessite une connexion internet.");
      return;
    }
    setBusy(true);
    try {
      const installationId = await getLocalInstallationId();
      const activation = await fetch("/api/appareils/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId, name: deviceName }),
      });
      const activationData = await activation.json() as Record<string, unknown>;
      if (!activation.ok) throw new Error(typeof activationData.error === "string" ? activationData.error : "Activation du poste impossible.");

      const token = String(activationData.token ?? "");
      const deviceId = String(activationData.deviceId ?? "");
      const linkedPharmacyId = String(activationData.pharmacyId ?? "");
      if (!token || !deviceId || linkedPharmacyId !== pharmacyId) {
        throw new Error("La réponse d'activation ne correspond pas à la pharmacie active.");
      }

      const ping = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ operations: [] }),
      });
      const syncData = await ping.json() as Record<string, unknown>;
      if (!ping.ok || typeof syncData.serverTimeMs !== "number") {
        throw new Error("L'appareil est créé, mais son horloge serveur et son stock de référence n'ont pas pu être initialisés. Réessayez en ligne.");
      }

      await activateLocalDevice({
        pin,
        deviceId,
        pharmacyId,
        pharmacyName: String(activationData.pharmacyName ?? pharmacyName),
        token,
        serverTimeMs: syncData.serverTimeMs,
        reference: syncData.reference,
      });
      setKnownDevice(true);
      setSamePharmacy(true);
      setUnlocked(true);
      setPin("");
      setConfirmPin("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Activation locale impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (unlocked && samePharmacy) {
    return (
      <section className="carte my-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-extrabold">Synchronisation hors ligne</h2>
            <p className="text-xs text-slate-600">File chiffrée · chronologie ancrée au serveur · opérations idempotentes</p>
          </div>
          <EtatHorsLigne />
        </div>
      </section>
    );
  }

  if (knownDevice && samePharmacy) {
    return (
      <section className="carte my-4">
        <DebloquerAppareil onUnlocked={(value) => {
          if (value.pharmacyId === pharmacyId) {
            setError("");
            setUnlocked(true);
          } else {
            setError("L'appareil déverrouillé appartient à une autre pharmacie.");
          }
        }} />
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      </section>
    );
  }

  if (knownDevice) {
    return <section className="carte my-4" role="alert"><h2 className="font-extrabold">Appareil local indisponible</h2><p className="mt-2 text-sm">{error || "Une association locale existe déjà."}</p></section>;
  }

  return (
    <section className="carte my-4 space-y-3">
      <div>
        <h2 className="font-extrabold">Activer ce poste hors ligne</h2>
        <p className="text-sm text-slate-600">L'activation enregistre un jeton d'appareil chiffré localement et initialise une référence de stock avec l'heure du serveur.</p>
      </div>
      <label className="block text-sm font-semibold">Nom du poste
        <input className="champ mt-1 w-full" maxLength={100} value={deviceName} onChange={(event) => setDeviceName(event.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold">PIN local (4 à 6 chiffres)
          <input className="champ mt-1 w-full" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} />
        </label>
        <label className="block text-sm font-semibold">Confirmer le PIN
          <input className="champ mt-1 w-full" inputMode="numeric" autoComplete="new-password" maxLength={6} value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))} />
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="button" className="btn btn-vert" disabled={busy || !navigator.onLine} onClick={() => void activate()}>
        {busy ? "Activation et synchronisation…" : "Activer ce poste"}
      </button>
    </section>
  );
}
