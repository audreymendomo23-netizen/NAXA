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
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!mounted) return;
      setEmail(data.user?.email ?? null);
      if (authError) setError("La session NAXA n’a pas pu être vérifiée. Reconnectez-vous puis rouvrez le lien.");
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
    if (!UUID.test(token) || !email || accepting) return;
    setError("");
    setAccepting(true);

    const { data, error: rpcError } = await supabase.rpc("exam_accept_staff_invite", {
      p_token: token,
    });

    if (rpcError) {
      setError(rpcError.message || "L’invitation n’a pas pu être acceptée.");
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

  const tokenValid = UUID.test(token);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <section className="mx-auto max-w-xl rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-widest text-blue-700">NAXA · Centres d’examens</p>
        <h1 className="mt-2 text-2xl font-black">Invitation au personnel</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Cette invitation attribue un poste dans un centre d’examens. Elle est nominative,
          utilisable une seule fois et expire après 7 jours.
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
            <h2 className="font-bold text-blue-950">Connectez-vous au compte destinataire</h2>
            <p className="mt-2 text-sm leading-6 text-blue-900">
              Ouvrez NAXA dans un autre onglet, connectez-vous ou créez un compte Client avec
              l’adresse e-mail invitée, confirmez cette adresse, puis revenez sur cette page.
              Le profil doit être actif et la majorité vérifiée.
            </p>
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-blue-900 px-4 text-sm font-bold text-white"
            >
              Ouvrir NAXA dans un autre onglet
            </Link>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Compte connecté</p>
            <p className="mt-1 break-all font-bold">{email}</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Pour accepter, utilisez le compte Client dont l’adresse correspond exactement
              à celle choisie par le responsable du centre. L’adresse doit être confirmée et
              le profil complet, actif et majeur.
            </p>
            <button
              type="button"
              onClick={() => void acceptInvitation()}
              disabled={accepting}
              className="mt-4 min-h-11 w-full rounded-xl bg-blue-900 px-4 font-bold text-white disabled:opacity-50"
            >
              {accepting ? "Vérification et acceptation…" : "Accepter l’invitation"}
            </button>
          </div>
        )}

        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-900">{error}</p>}
        <p className="mt-6 text-xs leading-5 text-slate-500">
          L’acceptation crée une affectation professionnelle distincte du rôle global du compte.
          Vous pourrez ensuite sélectionner votre poste actif dans l’espace Examens.
        </p>
      </section>
    </main>
  );
}
