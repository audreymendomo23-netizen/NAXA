"use client";

import { useEffect, useState } from "react";
import { DebloquerAppareil } from "@/components/pharmacie/DebloquerAppareil";
import { EtatHorsLigne } from "@/components/pharmacie/EtatHorsLigne";
import {
  activateLocalDevice,
  assertLocalDeviceActivationAllowed,
  lockLocalDevice,
  LOCAL_IDLE_LOCK_MS,
  touchLocalDeviceActivity,
  getLocalDeviceIdentity,
  getLocalInstallationId,
  getUnlockedDevice,
  hasLocalDevice,
} from "@/lib/offline-db";

type Props = {
  pharmacyId: string;
  pharmacyName: string;
  onUnlocked?: () => void;
};

export function AppareilHorsLigne({ pharmacyId, pharmacyName, onUnlocked }: Props) {
  const [knownDevice, setKnownDevice] = useState(false);
  const [samePharmacy, setSamePharmacy] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [deviceName, setDeviceName] = useState("Poste pharmacie");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setOnline(navigator.onLine);
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!unlocked || !samePharmacy) return;
    let timer: number | undefined;
    const lock = () => {
      lockLocalDevice();
      setUnlocked(false);
      setError("Session locale verrouillée après 15 minutes d'inactivité. Déverrouillez à nouveau avec le PIN local.");
    };
    const resetIdleTimer = () => {
      if (!touchLocalDeviceActivity()) {
        lock();
        return;
      }
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(lock, LOCAL_IDLE_LOCK_MS);
    };
    const activityEvents = ["pointerdown", "keydown", "touchstart", "click", "input"];
    activityEvents.forEach(event => window.addEventListener(event, resetIdleTimer, { passive: true }));
    document.addEventListener("visibilitychange", resetIdleTimer);
    resetIdleTimer();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      activityEvents.forEach(event => window.removeEventListener(event, resetIdleTimer));
      document.removeEventListener("visibilitychange", resetIdleTimer);
    };
  }, [unlocked, samePharmacy]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [identity, exists] = await Promise.all([getLocalDeviceIdentity(), hasLocalDevice()]);
      if (cancelled) return;
      setKnownDevice(exists);
      setSamePharmacy(Boolean(identity && identity.pharmacyId === pharmacyId));
      const active = getUnlockedDevice();
      setUnlocked(Boolean(active && active.pharmacyId === pharmacyId));
      if (active && active.pharmacyId === pharmacyId) onUnlocked?.();
      if (identity && identity.pharmacyId !== pharmacyId) {
        setError("Cet appareil local est déjà associé à une autre pharmacie. Les données en attente doivent être traitées avant tout changement d'association.");
      } else if (exists && !identity) {
        setError("Les informations de l'appareil local sont incomplètes. Ne réinitialisez pas la file hors ligne avant vérification.");
      }
    })();
    return () => { cancelled = true; };
  }, [pharmacyId, onUnlocked]);

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
      await assertLocalDeviceActivationAllowed();
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
      const role = String(activationData.role ?? "");
      const canEditStock = activationData.canEditStock === true;
      if (!token || !deviceId || linkedPharmacyId !== pharmacyId || (role !== "pharmacie" && role !== "caisse") || !canEditStock) {
        throw new Error("La réponse d'activation ne correspond pas à la pharmacie active.");
      }

      // Persist the device token before the first sync. If the network drops,
      // the enrolled device remains recoverable and the queue is never orphaned.
      const activationServerTime = Number(activationData.serverTimeMs);
      await activateLocalDevice({
        pin,
        deviceId,
        pharmacyId,
        pharmacyName: String(activationData.pharmacyName ?? pharmacyName),
        role: role as "pharmacie" | "caisse",
        canEditStock: true,
        token,
        serverTimeMs: Number.isSafeInteger(activationServerTime) && activationServerTime > 0 ? activationServerTime : undefined,
        nextDeviceSequence: Number(activationData.nextDeviceSequence ?? 0),
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
          <EtatHorsLigne onReferenceUpdated={onUnlocked} />
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
            onUnlocked?.();
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
        <p className="text-sm text-slate-600">L'activation enregistre d'abord le jeton chiffré localement ; le premier échange serveur charge ensuite la référence de stock.</p>
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
      <button type="button" className="btn btn-vert" disabled={busy || !online} onClick={() => void activate()}>
        {busy ? "Activation et synchronisation…" : "Activer ce poste"}
      </button>
    </section>
  );
}
