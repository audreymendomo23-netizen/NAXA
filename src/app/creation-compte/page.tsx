"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

function FormulaireCreation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const retour = searchParams.get("retour") || "/";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  async function creerCompte(e: React.FormEvent) {
    e.preventDefault();
    setOccupe(true);
    setErreur("");

    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    setOccupe(false);

    if (error) {
      setErreur(
        "Impossible d'envoyer le code. Vérifiez l'adresse e-mail et réessayez dans une minute."
      );
      return;
    }

    setEnvoye(true);
  }

  async function verifierCode(e: React.FormEvent) {
    e.preventDefault();
    setOccupe(true);
    setErreur("");

    const { error } = await supabaseBrowser().auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    setOccupe(false);

    if (error) {
      setErreur("Code incorrect ou expiré. Demandez un nouveau code.");
      return;
    }

    router.push(retour);
    router.refresh();
  }

  return (
    <form
      onSubmit={envoye ? verifierCode : creerCompte}
      className="carte w-full max-w-sm space-y-4"
    >
      <div>
        <h1 className="text-2xl font-extrabold">Créer mon compte</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Créez votre compte NAXA avec votre adresse e-mail. Aucun mot de passe
          n&apos;est nécessaire.
        </p>
      </div>

      {!envoye ? (
        <>
          <label className="block text-sm font-semibold">
            Adresse e-mail
            <input
              className="champ mt-1"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />
          </label>

          <button className="btn btn-vert w-full" disabled={occupe}>
            {occupe ? "Envoi..." : "Créer mon compte"}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-slate-600">
            Un code de confirmation a été envoyé à <strong>{email}</strong>.
          </p>

          <label className="block text-sm font-semibold">
            Code reçu
            <input
              className="champ mt-1 tracking-widest"
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              aria-label="Code de confirmation reçu par e-mail"
            />
          </label>

          <button className="btn btn-vert w-full" disabled={occupe}>
            {occupe ? "Vérification..." : "Valider mon compte"}
          </button>

          <button
            type="button"
            className="btn btn-clair w-full"
            disabled={occupe}
            onClick={() => {
              setEnvoye(false);
              setCode("");
              setErreur("");
            }}
          >
            Modifier mon e-mail
          </button>
        </>
      )}

      {erreur && (
        <p role="alert" className="text-sm text-red-700">
          {erreur}
        </p>
      )}

      <p className="text-center text-sm text-slate-600">
        Vous avez déjà un compte ?{" "}
        <Link
          href={`/connexion?retour=${encodeURIComponent(retour)}`}
          className="font-bold text-naxa-green-700 underline underline-offset-2"
        >
          Se connecter
        </Link>
      </p>
    </form>
  );
}

export default function CreationCompte() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-naxa-green-900 px-5">
      <Logo />
      <Suspense>
        <FormulaireCreation />
      </Suspense>
    </main>
  );
}
