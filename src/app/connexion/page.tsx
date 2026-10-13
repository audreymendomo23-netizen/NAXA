"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { BullesAuthentification } from "@/components/BullesAuthentification";
import { BulleErreur } from "@/components/BulleErreur";
import { BoutonNAXA } from "@/components/BoutonNAXA";
import { activateLocalDevice, getLocalDeviceIdentity, getLocalInstallationId, hasLocalDevice, saveTokenEncryptedForSession, unlockLocalDevice } from "@/lib/offline-db";

function d(index: number): React.CSSProperties {
  return { "--i": index } as React.CSSProperties;
}

type Bulle = { x: number; y: number; vx: number; vy: number; r: number };
type Particule = { x: number; y: number; vx: number; vy: number; vie: number; rayon: number; couleur: string };
type Halo = { x: number; y: number; vie: number };

function BullesConnexion() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let previous = 0;
    let dernierGeste = 0;
    const bulles: Bulle[] = [];
    const particules: Particule[] = [];
    const halos: Halo[] = [];
    const couleurs = ["rgba(255, 227, 61,", "rgba(10, 107, 58,", "rgba(255, 255, 255,"];

    const redimensionner = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (bulles.length === 0) {
        for (let i = 0; i < 10; i++) {
          const r = 15 + Math.random() * 45;
          bulles.push({
            x: r + Math.random() * Math.max(1, width - r * 2),
            y: r + Math.random() * Math.max(1, height - r * 2),
            vx: (Math.random() - 0.5) * 0.34,
            vy: (Math.random() - 0.5) * 0.34,
            r,
          });
        }
      } else {
        bulles.forEach((b) => {
          b.x = Math.min(width - b.r, Math.max(b.r, b.x));
          b.y = Math.min(height - b.r, Math.max(b.r, b.y));
        });
      }
      if (reduceMotion) dessiner(performance.now(), false);
    };

    const ajouterInteraction = (clientX: number, clientY: number, nombre: number) => {
      if (reduceMotion) return;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      halos.push({ x, y, vie: 1 });
      for (let i = 0; i < nombre; i++) {
        const angle = Math.random() * Math.PI * 2;
        const vitesse = 0.45 + Math.random() * 1.8;
        particules.push({
          x,
          y,
          vx: Math.cos(angle) * vitesse,
          vy: Math.sin(angle) * vitesse,
          vie: 1,
          rayon: 1 + Math.random() * 1.8,
          couleur: couleurs[Math.floor(Math.random() * couleurs.length)],
        });
      }
      if (particules.length > 140) particules.splice(0, particules.length - 140);
      if (halos.length > 12) halos.splice(0, halos.length - 12);
    };

    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.buttons === 0) {
        const now = performance.now();
        if (now - dernierGeste < 42) return;
        dernierGeste = now;
        ajouterInteraction(event.clientX, event.clientY, 2);
      } else {
        const now = performance.now();
        if (now - dernierGeste < 42) return;
        dernierGeste = now;
        ajouterInteraction(event.clientX, event.clientY, 3);
      }
    };
    const pointerDown = (event: PointerEvent) => ajouterInteraction(event.clientX, event.clientY, 12);

    function dessiner(now: number, animer = true) {
      const delta = Math.min(2, previous ? (now - previous) / 16.67 : 1);
      previous = now;
      context!.clearRect(0, 0, width, height);

      bulles.forEach((b, index) => {
        if (animer && !reduceMotion) {
          b.x += b.vx * delta;
          b.y += b.vy * delta;
          if (b.x < b.r || b.x > width - b.r) b.vx *= -1;
          if (b.y < b.r || b.y > height - b.r) b.vy *= -1;
          b.x = Math.min(width - b.r, Math.max(b.r, b.x));
          b.y = Math.min(height - b.r, Math.max(b.r, b.y));
        }
        const reflet = context!.createRadialGradient(
          b.x - b.r * 0.3, b.y - b.r * 0.35, 1, b.x, b.y, b.r
        );
        reflet.addColorStop(0, "rgba(255,255,255,0)");
        reflet.addColorStop(0.78, index % 2 ? "rgba(10,107,58,0.015)" : "rgba(255,227,61,0.02)");
        reflet.addColorStop(1, index % 2 ? "rgba(10,107,58,0.08)" : "rgba(184,143,0,0.12)");
        context!.beginPath();
        context!.fillStyle = reflet;
        context!.strokeStyle = index % 2 ? "rgba(10,107,58,0.14)" : "rgba(184,143,0,0.19)";
        context!.lineWidth = 1;
        context!.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        context!.fill();
        context!.stroke();
      });

      if (animer && !reduceMotion) {
        halos.forEach((h) => {
          h.vie -= delta / 60;
          const progression = 1 - h.vie;
          const rayon = 8 + progression * 35;
          const gradient = context!.createRadialGradient(h.x, h.y, 0, h.x, h.y, rayon);
          gradient.addColorStop(0, `rgba(255,227,61,${Math.max(0, h.vie) * 0.10})`);
          gradient.addColorStop(1, "rgba(255,227,61,0)");
          context!.beginPath();
          context!.fillStyle = gradient;
          context!.arc(h.x, h.y, rayon, 0, Math.PI * 2);
          context!.fill();
        });
        halos.splice(0, halos.length, ...halos.filter((h) => h.vie > 0));

        particules.forEach((p) => {
          p.x += p.vx * delta;
          p.y += p.vy * delta;
          p.vx *= 0.985;
          p.vy *= 0.985;
          p.vie -= delta / 60;
          context!.beginPath();
          context!.fillStyle = `${p.couleur}${Math.max(0, p.vie) * 0.65})`;
          context!.arc(p.x, p.y, p.rayon, 0, Math.PI * 2);
          context!.fill();
        });
        particules.splice(0, particules.length, ...particules.filter((p) => p.vie > 0));
        frame = window.requestAnimationFrame((t) => dessiner(t, true));
      }
    }

    redimensionner();
    const observer = new ResizeObserver(redimensionner);
    observer.observe(canvas);
    if (!reduceMotion) {
      window.addEventListener("pointermove", pointerMove, { passive: true });
      window.addEventListener("pointerdown", pointerDown, { passive: true });
      frame = window.requestAnimationFrame((t) => dessiner(t, true));
    }

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerdown", pointerDown);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 0, background: "transparent" }}
    />
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path fill="#4285F4" d="M21.6 12.23c0-.7-.06-1.37-.18-2.02H12v3.83h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.22c1.89-1.74 2.99-4.3 2.99-7.34Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.43l-3.22-2.51c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.06v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.89A6 6 0 0 1 6.08 12c0-.66.11-1.3.31-1.89V7.52H3.06A10 10 0 0 0 2 12c0 1.61.39 3.13 1.06 4.48l3.33-2.59Z" />
      <path fill="#EA4335" d="M12 5.98c1.47 0 2.79.51 3.83 1.51l2.87-2.87C16.95 2.9 14.7 2 12 2a10 10 0 0 0-8.94 5.52l3.33 2.59C7.18 7.74 9.39 5.98 12 5.98Z" />
    </svg>
  );
}

function safeInternalPath(value: string | null) {
  if (!value || !value.startsWith("/")) return "/";
  try {
    const target = new URL(value, "https://naxa.invalid");
    return target.origin === "https://naxa.invalid"
      ? target.pathname + target.search + target.hash
      : "/";
  } catch {
    return "/";
  }
}

function Formulaire() {
  const router = useRouter();
  const search = useSearchParams();
  const retour = safeInternalPath(search.get("retour"));
  const espace = search.get("espace");
  const titre = espace === "pharmacie" ? "Espace pharmacie" : "Espace client";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (search.get("erreur") === "oauth") {
      setError("La connexion Google a échoué. Vérifiez la configuration Google et les URL de redirection dans Supabase Auth.");
    }
  }, [search]);

  useEffect(() => {
    if (search.get("redirectionRole") !== "1") return;

    let annule = false;
    void (async () => {
      try {
        const sb = supabaseBrowser();
        const { data: auth } = await sb.auth.getUser();
        if (!auth.user) {
          if (!annule) router.replace("/");
          return;
        }

        const { data: profile } = await sb
          .from("profiles")
          .select("role")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (annule) return;

        const espacesParRole: Record<string, string> = {
          client: "/client",
          pharmacie: "/pharmacie",
          promoteur: "/pharmacie",
          caisse: "/pharmacie",
          admin: "/admin",
        };
        router.replace(
          profile?.role && espacesParRole[profile.role]
            ? espacesParRole[profile.role]
            : "/"
        );
        router.refresh();
      } catch {
        if (!annule) router.replace("/");
      }
    })();

    return () => {
      annule = true;
    };
  }, [router, search]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, remember }),
      });
      const d = await r.json();

      if (!r.ok) {
        setError(d.error || "Identifiants incorrects.");
        return;
      }

      // Une erreur de stockage local ne doit pas annuler une authentification réussie.
      try {
        window.localStorage.setItem("naxa-remember", remember ? "1" : "0");
      } catch {
        // Le choix ne pourra pas être mémorisé sur cet appareil.
      }

      let destination = retour;

      // Si aucune destination protégée n’a été demandée, ouvrir l’espace du profil réel.
      if (!search.get("retour") || retour === "/") {
        try {
          const sb = supabaseBrowser();
          const { data: auth } = await sb.auth.getUser();
          if (auth.user) {
            const { data: profile } = await sb
              .from("profiles")
              .select("role")
              .eq("id", auth.user.id)
              .maybeSingle();

            const espacesParRole: Record<string, string> = {
              client: "/client",
              pharmacie: "/pharmacie",
              promoteur: "/pharmacie",
              caisse: "/pharmacie",
              admin: "/admin",
            };
            if (profile?.role && espacesParRole[profile.role]) {
              destination = espacesParRole[profile.role];
            }
          }
        } catch {
          // La connexion est déjà réussie : conserver la destination de repli.
        }
      }

      router.push(destination);
      router.refresh();
    } catch {
      setError("Connexion impossible. Vérifiez votre connexion internet et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError("");
    setBusy(true);
    const next = search.get("retour") && retour !== "/"
      ? retour
      : "/connexion?redirectionRole=1";
    // Le démarrage OAuth côté serveur garde le verifier PKCE dans un cookie
    // lisible par la route /auth/callback, contrairement au stockage local seul.
    window.location.assign("/api/auth/google?next=" + encodeURIComponent(next));
  }

  return (
    <form
      onSubmit={login}
      className="carte w-full max-w-sm space-y-3 !max-w-none !rounded-none !border-0 !bg-transparent !p-0 !shadow-none !space-y-3 text-naxa-green-900"
    >
      <div className="connexion-titre text-center">
        <h1
          className="reveal !m-0 !p-0 text-center text-4xl font-extrabold text-naxa-green-900 !leading-[1.05]"
          style={d(1)}
        >
          Connexion
        </h1>
        <p
          className="reveal !mb-0 !mt-1 !p-0 text-center text-sm font-semibold !leading-[1.3]"
          style={{ ...d(2), color: "#9B7A00" }}
        >
          Entrez votre Nom d'utilisateur et votre Mot de passe
        </p>
      </div>

      <div className="reveal relative !mt-6" style={d(3)}>
        <input
          id="username"
          placeholder=" "
          className="champ peer w-full !min-h-[62px] !pt-6 !pb-1 !border-naxa-green-100"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          autoComplete="username"
        />
        <label
          htmlFor="username"
          className="pointer-events-none absolute left-5 top-2 text-xs font-semibold !text-[#9B7A00] transition-all duration-200 ease-out peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:font-normal peer-placeholder-shown:!text-[#9B7A00] peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-semibold peer-focus:!text-[#9B7A00]"
        >
          Nom d'utilisateur
        </label>
      </div>

      <div className="reveal relative" style={d(4)}>
        <input
          id="password"
          placeholder=" "
          className="champ peer w-full pr-20 !min-h-[62px] !pt-6 !pb-1 !border-naxa-green-100"
          required
          type={show ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <label
          htmlFor="password"
          className="pointer-events-none absolute left-5 top-2 text-xs font-semibold !text-[#9B7A00] transition-all duration-200 ease-out peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:font-normal peer-placeholder-shown:!text-[#9B7A00] peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-semibold peer-focus:!text-[#9B7A00]"
        >
          Mot de passe
        </label>
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 text-xs font-bold text-naxa-green-900"
          onClick={() => setShow(!show)}
        >
          {show ? "Masquer" : "Afficher"}
        </button>
      </div>

      <div
        className="reveal flex items-center justify-between gap-2 whitespace-nowrap text-base text-naxa-green-900"
        style={d(5)}
      >
        <label className="flex items-center gap-1.5 whitespace-nowrap font-bold">
          <input
            type="checkbox"
            className="accent-naxa-canari h-5 w-5"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Rester connecté
        </label>
        <Link
          href={`/mot-de-passe-oublie?retour=${encodeURIComponent(retour)}`}
          className="whitespace-nowrap text-base font-semibold underline text-naxa-green-900"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      <BoutonNAXA type="submit" importance="importante" loading={busy} className="btn-canari w-full" disabled={busy}>
        {busy ? "Connexion..." : "Connexion"}
      </BoutonNAXA>

      <div
        className="reveal relative py-0.5 text-center text-xs text-slate-600 !text-naxa-green-700"
        style={d(7)}
      >
        <span className="bg-white !bg-transparent px-2">ou</span>
      </div>

      <BoutonNAXA type="button" importance="importante" loading={busy} onClick={google} className="btn-clair w-full" disabled={busy}>
        <GoogleIcon />
        Connexion via Gmail
      </BoutonNAXA>

      {error && <BulleErreur message={error} />}

      <p
        className="reveal text-center text-base text-slate-600 !text-naxa-green-900"
        style={d(9)}
      >
        Vous n'avez pas de compte ?{" "}
        <Link
          href={`/creation-compte?retour=${encodeURIComponent(retour)}`}
          className="font-bold underline text-naxa-green-900"
        >
          Créer un compte
        </Link>
      </p>
    </form>
  );
}


function PharmacieFormulaire() {
  const router = useRouter();
  const codeRef = useRef<HTMLInputElement | null>(null);
  const [etape, setEtape] = useState<1 | 2>(1);
  const [nomPharmacie, setNomPharmacie] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [offlineUnlock, setOfflineUnlock] = useState(false);
  const [offlineUnavailable, setOfflineUnavailable] = useState(false);
  const [activation, setActivation] = useState<{deviceId:string;token:string;pharmacyId:string;pharmacyName:string;existingLocal:boolean}|null>(null);
  const [pinLocal, setPinLocal] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [pinOffline, setPinOffline] = useState("");

  useEffect(() => {
    let mounted = true;
    const checkOffline = async () => { const has = Boolean(await getLocalDeviceIdentity().catch(() => null)); if (mounted) { setOfflineUnlock(!navigator.onLine && has); setOfflineUnavailable(!navigator.onLine && !has); } };
    void checkOffline();
    const online = () => { if (mounted) { setOfflineUnlock(false); setOfflineUnavailable(false); } };
    const offline = () => { void checkOffline(); };
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    return () => { mounted = false; window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, []);

  async function deverrouillerHorsLigne(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await unlockLocalDevice(pinOffline);
      router.push("/pharmacie");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Déverrouillage hors ligne impossible.");
    } finally {
      setPinOffline("");
      setBusy(false);
    }
  }

  async function verifierCode(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const code = codeRef.current?.value ?? "";
      const response = await fetch("/api/pharmacie/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Code pharmacie invalide."); return; }
      setNomPharmacie(String(data.nom || ""));
      setEtape(2);
      if (codeRef.current) codeRef.current.value = "";
    } catch { setError("Vérification impossible. Réessayez."); }
    finally { setBusy(false); }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password, remember: false, espace: "pharmacie" }) });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "PHARMACY_SESSION_EXPIRED") { setEtape(1); setNomPharmacie(""); }
        setError(data.error || "Identifiants non valides pour cette pharmacie."); return;
      }
      const existingLocal = await hasLocalDevice();
      const deviceResponse = await fetch("/api/appareils/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: navigator.userAgent.includes("Mobile") ? "Appareil mobile pharmacie" : "Poste pharmacie", installationId: await getLocalInstallationId() }) });
      const deviceData = await deviceResponse.json();
      if (!deviceResponse.ok) { setError(deviceData.error || "Activation de cet appareil impossible."); return; }
      if (existingLocal) {
        const localIdentity = await getLocalDeviceIdentity();
        if (!localIdentity ||
            localIdentity.deviceId !== String(deviceData.deviceId) ||
            localIdentity.pharmacyId !== String(deviceData.pharmacyId)) {
          await supabaseBrowser().auth.signOut().catch(() => undefined);
          setActivation(null);
          setError("Les données hors ligne de cet appareil appartiennent à une autre pharmacie. Elles ont été conservées. Reconnectez-vous depuis le profil d’appareil de cette pharmacie ; aucune donnée locale ni opération en attente n’a été supprimée.");
          return;
        }
      }
      setActivation({ ...deviceData, existingLocal });
    } catch { setError("Connexion impossible. Vérifiez votre connexion internet."); }
    finally { setBusy(false); }
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/update-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, currentPassword, newPassword }) });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "PHARMACY_SESSION_EXPIRED") { setEtape(1); setNomPharmacie(""); }
        setError(data.error || "Mise à jour impossible."); return;
      }
      setCurrentPassword(""); setNewPassword(""); setShowUpdate(false);
      setMessage("Mot de passe mis à jour. Vous pouvez vous connecter.");
    } catch { setError("Mise à jour momentanément indisponible."); }
    finally { setBusy(false); }
  }

  async function changerPharmacie() {
    setBusy(true); setError(""); setMessage("");
    try { await fetch("/api/pharmacie/code/reset", { method: "POST" }); }
    finally { setEtape(1); setNomPharmacie(""); setUsername(""); setPassword(""); setShowUpdate(false); setActivation(null); setBusy(false); }
  }


  async function confirmerActivation(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!activation) return;
    if (!/^\d{4,6}$/.test(pinLocal) || (!activation.existingLocal && pinLocal !== pinConfirmation)) {
      setError(activation.existingLocal ? "Saisissez le PIN local existant." : "Choisissez un PIN de 4 à 6 chiffres et confirmez-le.");
      return;
    }
    setBusy(true);
    try {
      if (activation.existingLocal) {
        await unlockLocalDevice(pinLocal);
        await saveTokenEncryptedForSession(pinLocal, activation.token);
        await unlockLocalDevice(pinLocal);
      } else {
        await activateLocalDevice({ pin: pinLocal, deviceId: activation.deviceId, pharmacyId: activation.pharmacyId, pharmacyName: activation.pharmacyName || nomPharmacie, token: activation.token });
      }
      router.push("/pharmacie"); router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de sécuriser les données locales sur cet appareil.");
    } finally { setPinLocal(""); setPinConfirmation(""); setBusy(false); }
  }


  return (
    <div className="carte w-full max-w-sm space-y-3 !max-w-none !rounded-none !border-0 !bg-transparent !p-0 !shadow-none text-naxa-green-900">
      <div className="connexion-titre text-center">
        <h1 className="reveal !m-0 !p-0 text-center text-4xl font-extrabold text-naxa-green-900 !leading-[1.05]" style={d(1)}>Connexion</h1>
        <p className="reveal !mb-0 !mt-1 !p-0 text-center text-sm font-semibold !leading-[1.3]" style={{ ...d(2), color: "#9B7A00" }}>
          {offlineUnlock ? "Déverrouillage hors ligne" : etape === 1 ? "Étape 1 — Code Pharmacie" : "Étape 2 — Identifiants de connexion"}
        </p>
      </div>

      {offlineUnlock ? (
        <form onSubmit={deverrouillerHorsLigne} className="space-y-3">
          <p className="rounded-xl border border-naxa-green-100 bg-white/70 px-4 py-3 text-sm font-semibold">
            Aucun réseau détecté. Déverrouillez l’appareil déjà activé avec son PIN local.
          </p>
          <input
            aria-label="PIN local hors ligne"
            placeholder="PIN local (4 à 6 chiffres)"
            required
            inputMode="numeric"
            minLength={4}
            maxLength={6}
            pattern="[0-9]{4,6}"
            autoComplete="off"
            value={pinOffline}
            onChange={e => setPinOffline(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="champ w-full !min-h-[54px]"
          />
          <button className="btn btn-canari w-full !min-h-[54px]" disabled={busy}>
            {busy ? "Déverrouillage..." : "Déverrouiller hors ligne"}
          </button>
          {offlineUnavailable && (
            <p role="status" className="text-sm font-semibold text-red-700">
              Aucun appareil pharmacie activé n’est enregistré sur cet appareil. Une première activation nécessite une connexion.
            </p>
          )}
        </form>
      ) : offlineUnavailable ? (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold">
          Vous êtes hors connexion et aucun appareil pharmacie n’est activé ici. Reconnectez-vous pour vous authentifier et activer cet appareil.
        </p>
      ) : etape === 1 ? (
        <form onSubmit={verifierCode} className="space-y-3">
          <div className="reveal relative !mt-6" style={d(3)}>
            <input ref={codeRef} id="code-pharmacie" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" placeholder=" " required className="champ peer w-full !min-h-[62px] !pt-6 !pb-1 !border-naxa-green-100" aria-label="Code Pharmacie à 4 chiffres" />
            <label htmlFor="code-pharmacie" className="pointer-events-none absolute left-5 top-2 text-xs font-semibold !text-[#9B7A00] transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:font-normal peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs">Code Pharmacie (4 chiffres)</label>
          </div>
          <button className="reveal btn btn-canari w-full !min-h-[54px] !mt-5" style={d(4)} disabled={busy}>{busy ? "Vérification..." : "Continuer"}</button>
        </form>
      ) : (
        <>
          <div className="reveal flex items-center justify-between gap-3 rounded-xl border border-naxa-green-100 bg-white/70 px-4 py-3" style={d(3)}>
            <span className="min-w-0 truncate font-extrabold text-[#064B2A]">{nomPharmacie}</span>
            <button type="button" onClick={changerPharmacie} disabled={busy} className="shrink-0 text-xs font-bold underline">Changer de pharmacie</button>
          </div>
          {activation ? (
            <form onSubmit={confirmerActivation} className="space-y-3">
              <p className="text-sm font-semibold">{activation.existingLocal ? "Cet appareil est déjà activé. Saisissez votre PIN local existant." : "Activez cet appareil pour le mode hors ligne. Le PIN ne sera jamais envoyé au serveur."}</p>
              <input aria-label="PIN local" placeholder="PIN local (4 à 6 chiffres)" required inputMode="numeric" minLength={4} maxLength={6} pattern="[0-9]{4,6}" value={pinLocal} onChange={e => setPinLocal(e.target.value.replace(/\\D/g, "").slice(0,6))} className="champ w-full !min-h-[54px]" autoComplete="off" />
              {!activation.existingLocal && (<input aria-label="Confirmer le PIN local" placeholder="Confirmer le PIN local" required inputMode="numeric" minLength={4} maxLength={6} pattern="[0-9]{4,6}" value={pinConfirmation} onChange={e => setPinConfirmation(e.target.value.replace(/\\D/g, "").slice(0,6))} className="champ w-full !min-h-[54px]" autoComplete="off" />)}
              <button className="btn btn-canari w-full !min-h-[54px]" disabled={busy}>{busy ? "Sécurisation..." : activation.existingLocal ? "Déverrouiller et continuer" : "Activer cet appareil"}</button>
            </form>
          ) : !showUpdate ? (
            <form onSubmit={login} className="space-y-3">
              <div className="reveal relative !mt-4" style={d(4)}>
                <input id="pharmacy-username" placeholder=" " required autoComplete="username" value={username} onChange={e => setUsername(e.target.value.toLowerCase())} className="champ peer w-full !min-h-[62px] !pt-6 !pb-1 !border-naxa-green-100" />
                <label htmlFor="pharmacy-username" className="pointer-events-none absolute left-5 top-2 text-xs font-semibold !text-[#9B7A00] transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:font-normal peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs">Nom d&apos;utilisateur</label>
              </div>
              <div className="reveal relative" style={d(5)}>
                <input id="pharmacy-password" placeholder=" " required type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="champ peer w-full pr-20 !min-h-[62px] !pt-6 !pb-1 !border-naxa-green-100" />
                <label htmlFor="pharmacy-password" className="pointer-events-none absolute left-5 top-2 text-xs font-semibold !text-[#9B7A00] transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:font-normal peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs">Mot de passe</label>
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 px-2 text-xs font-bold" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Masquer" : "Afficher"}</button>
              </div>
              <button className="reveal btn btn-canari w-full !min-h-[54px] !mt-5" style={d(6)} disabled={busy}>{busy ? "Connexion..." : "Connexion"}</button>
              <button type="button" onClick={() => { setShowUpdate(true); setError(""); setMessage(""); }} className="reveal w-full text-center text-sm font-bold underline text-naxa-green-900" style={d(7)}>Mettre à jour le mot de passe</button>
            </form>
          ) : (
            <form onSubmit={updatePassword} className="space-y-3">
              <p className="text-sm font-semibold">Vérifiez votre mot de passe actuel avant d’en choisir un nouveau.</p>
              <input aria-label="Nom d'utilisateur" placeholder="Nom d'utilisateur" required value={username} onChange={e => setUsername(e.target.value.toLowerCase())} className="champ w-full !min-h-[54px]" autoComplete="username" />
              <input aria-label="Mot de passe actuel" placeholder="Mot de passe actuel" required type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="champ w-full !min-h-[54px]" autoComplete="current-password" />
              <input aria-label="Nouveau mot de passe" placeholder="Nouveau mot de passe (8 caractères minimum)" required minLength={8} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="champ w-full !min-h-[54px]" autoComplete="new-password" />
              <button className="btn btn-canari w-full !min-h-[54px]" disabled={busy}>{busy ? "Mise à jour..." : "Confirmer le nouveau mot de passe"}</button>
              <button type="button" onClick={() => { setShowUpdate(false); setError(""); }} className="w-full text-sm font-bold underline">Retour à la connexion</button>
            </form>
          )}
        </>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm font-semibold text-green-800">{message}</p>}
    </div>
  );
}

function FondConnexion() {
  const searchParams = useSearchParams();
  return searchParams.get("espace") === "pharmacie"
    ? <BullesAuthentification />
    : <BullesConnexion />;
}

function ChoixFormulaire() {
  const searchParams = useSearchParams();
  return searchParams.get("espace") === "pharmacie" ? <PharmacieFormulaire /> : <Formulaire />;
}

function TitreEspace() {
  const searchParams = useSearchParams();
  const titre = searchParams.get("espace") === "pharmacie" ? "Espace pharmacie" : "Espace client";

  return (
    <p
      className="reveal inline-flex items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-naxa-green-100 bg-white/70 px-4 py-2 text-xl font-extrabold tracking-tight text-[#064B2A] shadow-sm"
      style={d(0)}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-full bg-[#FFE33D] ring-[3px] ring-[#FFE33D]/40"
      />
      {titre}
    </p>
  );
}

export default function Connexion() {
  return (
    <main
      className="auth-ecran relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-naxa-green-900 px-6 !h-auto !min-h-[100dvh] !overflow-y-auto"
      style={{ backgroundColor: "#F2FAF5" }}
    >
      <Suspense fallback={null}><FondConnexion /></Suspense>
      <div
        className="relative z-10 w-full shrink-0 pt-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <div className="flex w-full items-center justify-between gap-3">
          <div className="logo-pastille reveal" style={d(0)}>
            <Logo taille={30} />
          </div>
          <Suspense fallback={<span aria-hidden="true" className="h-6 w-28" />}>
            <TitreEspace />
          </Suspense>
        </div>
      </div>
      <div className="relative z-10 flex w-full flex-1 items-center justify-center py-8">
        <div className="mt-[-60px] w-full max-w-[360px]">
          <Suspense>
            <ChoixFormulaire />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
