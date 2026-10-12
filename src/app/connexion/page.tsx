"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { BoutonNAXA } from "@/components/BoutonNAXA";

type Bulle = { x: number; y: number; vx: number; vy: number; r: number };
type Particule = { x: number; y: number; vx: number; vy: number; vie: number; rayon: number; couleur: string };
type Halo = { x: number; y: number; vie: number };

const d = (n: number) => ({ "--i": n } as React.CSSProperties);

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

function TitreEspace() {
  const search = useSearchParams();
  const titre = search.get("espace") === "pharmacie" ? "Espace pharmacie" : "Espace client";

  return (
    <p
      className="reveal whitespace-nowrap text-lg font-bold text-naxa-green-900 sm:text-xl"
      style={d(0)}
    >
      {titre}
    </p>
  );
}

function Formulaire() {
  const router = useRouter();
  const search = useSearchParams();
  const retour = search.get("retour") || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    try {
      const { error: authError } = await supabaseBrowser().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            search.get("retour") && retour !== "/"
              ? retour
              : "/connexion?redirectionRole=1"
          )}`,
        },
      });

      if (authError) {
        setBusy(false);
        setError("Connexion via Gmail indisponible : le fournisseur Google n'est pas encore activé dans NAXA.");
      }
    } catch {
      setBusy(false);
      setError("Connexion via Gmail indisponible. Réessayez plus tard.");
    }
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
          className="pointer-events-none absolute left-5 top-2 text-xs font-semibold text-naxa-canari transition-all duration-200 ease-out peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:font-normal peer-placeholder-shown:text-naxa-canari peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-semibold peer-focus:text-naxa-canari"
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
          className="pointer-events-none absolute left-5 top-2 text-xs font-semibold text-naxa-canari transition-all duration-200 ease-out peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:font-normal peer-placeholder-shown:text-naxa-canari peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-semibold peer-focus:text-naxa-canari"
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
        className="reveal flex items-center justify-between gap-3 text-sm text-naxa-green-900"
        style={d(5)}
      >
        <label className="flex items-center gap-2">
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
          className="font-semibold underline text-naxa-green-900"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      <button
        className="reveal btn btn-canari w-full !min-h-[54px] !mt-5"
        style={d(6)}
        disabled={busy}
      >
        {busy ? "Connexion..." : "Connexion"}
      </button>

      <div
        className="reveal relative py-0.5 text-center text-xs text-slate-600 !text-naxa-green-700"
        style={d(7)}
      >
        <span className="bg-white !bg-transparent px-2">ou</span>
      </div>

      <button
        type="button"
        onClick={google}
        className="reveal btn btn-clair w-full !min-h-[54px]"
        style={d(8)}
        disabled={busy}
      >
        <GoogleIcon />
        Connexion via Gmail
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <p
        className="reveal text-center text-sm text-slate-600 !text-naxa-green-900"
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

export default function Connexion() {
  return (
    <main
      className="auth-ecran relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-naxa-green-900 px-6 !h-auto !min-h-[100dvh] !overflow-y-auto"
      style={{ backgroundColor: "#F2FAF5" }}
    >
      <BullesConnexion />
      <div
        className="relative z-10 w-full shrink-0 pt-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="logo-pastille reveal" style={d(0)}>
            <Logo taille={30} />
          </div>
          <Suspense fallback={<span aria-hidden="true" className="h-6 w-28" />}>
            <TitreEspace />
          </Suspense>
        </div>
      </div>
      <div className="relative z-10 flex w-full flex-1 items-center justify-center py-8">
        <div className="w-full max-w-[360px]">
          <Suspense>
            <Formulaire />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
