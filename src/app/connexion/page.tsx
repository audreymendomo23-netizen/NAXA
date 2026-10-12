"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

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

function Formulaire() {
  const router = useRouter();
  const search = useSearchParams();
  const retour = search.get("retour") || "/";
  const espace = search.get("espace");
  const titre = espace === "pharmacie" ? "Espace pharmacie" : "Espace client";

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
    const next = search.get("retour") && retour !== "/"
      ? retour
      : "/connexion?redirectionRole=1";
    // Le démarrage OAuth côté serveur garde le verifier PKCE dans un cookie
    // lisible par la route /auth/callback, contrairement au stockage local seul.
    window.location.assign("/api/auth/google?next=" + encodeURIComponent(next));
  }

  return (
    <form onSubmit={login} className="carte w-full max-w-sm space-y-3">
      <h1 className="text-2xl font-extrabold">{titre}</h1>

      <label className="block text-sm font-semibold">
        Nom d'utilisateur
        <input
          className="champ mt-1"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          autoComplete="username"
        />
      </label>

      <label className="block text-sm font-semibold">
        Mot de passe
        <span className="relative mt-1 block">
          <input
            className="champ pr-20"
            required
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 text-xs font-bold"
            onClick={() => setShow(!show)}
          >
            {show ? "Masquer" : "Afficher"}
          </button>
        </span>
      </label>

      <div className="flex items-center justify-between gap-3 text-sm">
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
          className="font-semibold underline"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      <button className="btn btn-canari w-full" disabled={busy}>
        {busy ? "Connexion..." : "Connexion"}
      </button>

      <div className="relative py-0.5 text-center text-xs text-slate-600">
        <span className="bg-white px-2">ou</span>
      </div>

      <button type="button" onClick={google} className="btn btn-clair w-full" disabled={busy}>
        <GoogleIcon />
        Connexion via Gmail
      </button>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <p className="text-center text-sm text-slate-600">
        Vous n'avez pas de compte ?{" "}
        <Link
          href={`/creation-compte?retour=${encodeURIComponent(retour)}`}
          className="font-bold underline"
        >
          Créer un compte
        </Link>
      </p>
    </form>
  );
}

export default function Connexion() {
  return (
    <main className="auth-ecran flex flex-col items-center justify-center gap-3 bg-naxa-green-900 px-5 py-2">
      <Logo />
      <Suspense>
        <Formulaire />
      </Suspense>
    </main>
  );
}
