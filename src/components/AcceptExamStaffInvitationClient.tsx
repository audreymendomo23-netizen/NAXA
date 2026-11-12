"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type AcceptedInvite = {
  accepted?: boolean;
  center_id?: string;
  role_key?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function AcceptExamStaffInvitationClient({ token }: { token: string }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [changingAccount, setChangingAccount] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  const tokenValid = UUID.test(token);
  const invitationHref = tokenValid
    ? "/invitation/personnel-examen?token=" + encodeURIComponent(token)
    : "/invitation/personnel-examen";
  const signInHref = "/connexion?retour=" + encodeURIComponent(invitationHref);
  const signUpHref = "/creation-compte?retour=" + encodeURIComponent(invitationHref);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!mounted) return;
      setEmail(data.user?.email ?? null);
      if (authError) setError("La session NAXA n’a pas pu être vérifiée. Connectez-vous à nouveau.");
      setLoadingUser(false);
    }).catch(() => {
      if (!mounted) return;
      setError("La session NAXA n’a pas pu être vérifiée. Connectez-vous à nouveau.");
      setLoadingUser(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setEmail(session?.user?.email ?? null);
      setLoadingUser(false);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function acceptInvitation() {
    if (!tokenValid || !email || accepting || changingAccount) return;
    setError("");
    setAccepting(true);

    const { data, error: rpcError } = await supabase.rpc("exam_accept_staff_invite", {
      p_token: token,
    });

    if (rpcError) {
      const message = rpcError.message || "L’invitation n’a pas pu être acceptée.";
      setError(/invitation invalide, expirée, déjà utilisée ou destinée à une autre adresse/i.test(message)
        ? "NAXA n’a pas accepté ce lien : il peut être expiré, révoqué, déjà utilisé ou destiné à une autre adresse. Vérifiez le compte connecté ou changez de compte."
        : message);
      setAccepting(false);
      return;
    }

    const result = data as AcceptedInvite | null;
    if (!result?.accepted || !result.center_id || !UUID.test(result.center_id)) {
      setError("La réponse du serveur est incomplète. L’affectation n’a pas été confirmée.");
      setAccepting(false);
      return;
    }

    setAccepted(true);
    router.replace("/centre-examens?centre=" + encodeURIComponent(result.center_id));
    router.refresh();
  }

  async function changeAccount() {
    if (!tokenValid || changingAccount || accepting) return;
    setError("");
    setChangingAccount(true);

    // Fermer uniquement cette session de navigateur, sans déconnecter les autres appareils.
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) {
      setError("Impossible de changer de compte. Réessayez ou ouvrez le lien dans un autre navigateur.");
      setChangingAccount(false);
      return;
    }

    router.replace(signInHref);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <section className="mx-auto max-w-xl rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-widest text-blue-700">NAXA · Centres d’examens</p>
        <h1 className="mt-2 text-2xl font-black">Invitation au personnel</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Le même lien peut être rouvert tant que l’invitation n’a pas été acceptée.
          Il expire après 7 jours et devient inutilisable dès que l’affectation est validée.
        </p>

        {!tokenValid ? (
          <div role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-900">
            Le lien d’invitation est incomplet ou invalide. Demandez au responsable du centre de créer un nouveau lien.
          </div>
        ) : loadingUser ? (
          <p className="mt-5 text-sm text-slate-600">Vérification de votre session NAXA…</p>
        ) : accepted ? (
          <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
            Invitation acceptée. Ouverture de votre espace professionnel…
          </p>
        ) : !email ? (
          <div className="mt-5 rounded-xl bg-blue-50 p-4">
            <h2 className="font-bold text-blue-950">Ouvrir l’invitation avec votre compte NAXA</h2>
            <p className="mt-2 text-sm leading-6 text-blue-900">
              Vous pouvez utiliser un compte Client déjà créé ou en créer un nouveau.
              Après connexion ou finalisation du profil, NAXA vous ramènera automatiquement sur cette invitation.
              L’adresse du compte doit correspondre exactement à celle indiquée par le responsable du centre et être confirmée.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link
                href={signInHref}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-900 px-4 text-center text-sm font-bold text-white"
              >
                Me connecter à mon compte
              </Link>
              <Link
                href={signUpHref}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-blue-300 px-4 text-center text-sm font-bold text-blue-950"
              >
                Créer mon compte NAXA
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Compte connecté</p>
            <p className="mt-1 break-all font-bold">{email}</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Vous pouvez accepter directement si cette adresse est celle de l’invitation.
              Le compte doit être un compte Client NAXA confirmé, complet, actif et majeur.
              Si une autre adresse est connectée, changez de compte avant l’acceptation.
            </p>
            <button
              type="button"
              onClick={() => void acceptInvitation()}
              disabled={accepting || changingAccount}
              className="mt-4 min-h-11 w-full rounded-xl bg-blue-900 px-4 font-bold text-white disabled:opacity-50"
            >
              {accepting ? "Vérification et acceptation…" : "Accepter l’invitation"}
            </button>
            <button
              type="button"
              onClick={() => void changeAccount()}
              disabled={accepting || changingAccount}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              {changingAccount ? "Changement de compte…" : "Ce n’est pas le bon compte ? Changer de compte"}
            </button>
          </div>
        )}

        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-900">{error}</p>}
        <p className="mt-6 text-xs leading-5 text-slate-500">
          L’acceptation crée une affectation professionnelle distincte du rôle global du compte.
          Le jeton n’est consommé qu’après une acceptation réussie ; une invitation révoquée ou expirée ne peut plus être utilisée.
        </p>
      </section>
    </main>
  );
}
