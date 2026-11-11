"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type InviteRow = {
  invite_id: string;
  email: string;
  role_key: string;
  created_at: string;
  expires_at: string;
};

const ROLE_OPTIONS = [
  ["accueil", "Accueil"],
  ["caissier", "Caissier"],
  ["comptable", "Comptable"],
  ["technicien_laboratoire", "Technicien de laboratoire"],
  ["biologiste", "Biologiste"],
  ["manipulateur_imagerie", "Manipulateur d’imagerie"],
  ["radiologue", "Radiologue"],
  ["responsable_qualite", "Responsable qualité"],
  ["responsable_securite", "Responsable sécurité"],
] as const;

const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS) as Record<string, string>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date inconnue"
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function ExamStaffInvitePanel({ centerId }: { centerId: string }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState<string>("accueil");
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdLink, setCreatedLink] = useState("");

  const loadInvites = useCallback(async () => {
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("exam_list_staff_invites", {
      p_center_id: centerId,
    });
    if (rpcError) {
      setError("Impossible de charger les invitations en attente.");
      setInvites([]);
    } else {
      setInvites(Array.isArray(data) ? (data as InviteRow[]) : []);
    }
    setLoading(false);
  }, [centerId, supabase]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCreatedLink("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Saisissez une adresse e-mail valide.");
      return;
    }

    setCreating(true);
    const { data, error: rpcError } = await supabase.rpc("exam_create_staff_invite", {
      p_center_id: centerId,
      p_email: normalizedEmail,
      p_role_key: roleKey,
    });

    if (rpcError || typeof data !== "string" || !UUID.test(data)) {
      setError("L’invitation n’a pas pu être créée. Vérifiez vos droits, l’adresse et le poste.");
      setCreating(false);
      return;
    }

    const link = `${window.location.origin}/invitation/personnel-examen?token=${encodeURIComponent(data)}`;
    setCreatedLink(link);
    setEmail("");
    setSuccess("Invitation créée. Copiez le lien et transmettez-le au destinataire.");
    await loadInvites();
    setCreating(false);
  }

  async function copyInviteLink(inviteId: string) {
    setError("");
    setSuccess("");
    setBusyInviteId(inviteId);

    const { data: token, error: rpcError } = await supabase.rpc("exam_get_staff_invite_token", {
      p_center_id: centerId,
      p_invite_id: inviteId,
    });

    if (rpcError || typeof token !== "string" || !UUID.test(token)) {
      setError("Le lien n’est plus disponible. Cette invitation a peut-être expiré ou été utilisée.");
      setBusyInviteId(null);
      return;
    }

    const link = `${window.location.origin}/invitation/personnel-examen?token=${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(link);
      setSuccess("Lien copié. Transmettez-le au destinataire.");
    } catch {
      setCreatedLink(link);
      setError("La copie automatique est indisponible. Sélectionnez et copiez le lien affiché.");
    }
    setBusyInviteId(null);
  }

  async function revokeInvite(inviteId: string) {
    setError("");
    setSuccess("");
    setBusyInviteId(inviteId);

    const { error: rpcError } = await supabase.rpc("exam_revoke_staff_invite", {
      p_center_id: centerId,
      p_invite_id: inviteId,
    });

    if (rpcError) {
      setError("La révocation a échoué. Actualisez la liste puis réessayez.");
      setBusyInviteId(null);
      return;
    }

    setSuccess("Invitation révoquée. Son lien ne peut plus être utilisé.");
    await loadInvites();
    setBusyInviteId(null);
  }

  return (
    <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Accès nominatif</p>
        <h3 className="mt-1 text-lg font-extrabold">Inviter un nouveau membre</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          L’invitation est personnelle, valable 7 jours et liée à l’adresse e-mail indiquée.
          NAXA n’envoie pas automatiquement de message : copiez le lien et transmettez-le au destinataire.
        </p>
      </div>

      <form onSubmit={createInvite} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Adresse e-mail du compte
          <input
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="membre@exemple.com"
            className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          Poste à attribuer
          <select
            value={roleKey}
            onChange={(event) => setRoleKey(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border px-3"
          >
            {ROLE_OPTIONS.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={creating}
            className="min-h-11 rounded-xl bg-blue-900 px-4 font-bold text-white disabled:opacity-50"
          >
            {creating ? "Création…" : "Créer l’invitation"}
          </button>
        </div>
      </form>

      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {success && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{success}</p>}
      {createdLink && (
        <label className="mt-3 block text-sm font-semibold">
          Lien d’invitation
          <input
            readOnly
            value={createdLink}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1 min-h-11 w-full rounded-lg border bg-slate-50 px-3 text-xs font-normal"
          />
        </label>
      )}

      <div className="mt-5 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-extrabold">Invitations en attente</h4>
          <button
            type="button"
            onClick={() => void loadInvites()}
            disabled={loading}
            className="min-h-9 rounded-lg border px-3 text-xs font-bold disabled:opacity-50"
          >
            Actualiser
          </button>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Chargement des invitations…</p>
        ) : invites.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Aucune invitation active.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {invites.map((invite) => (
              <li key={invite.invite_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="break-all font-semibold">{invite.email}</p>
                  <p className="text-sm text-slate-600">{ROLE_LABELS[invite.role_key] ?? invite.role_key}</p>
                  <p className="text-xs text-slate-500">Expire le {formatDate(invite.expires_at)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyInviteLink(invite.invite_id)}
                    disabled={busyInviteId !== null}
                    className="min-h-9 rounded-lg border border-blue-200 px-3 text-xs font-bold text-blue-900 disabled:opacity-50"
                  >
                    {busyInviteId === invite.invite_id ? "…" : "Copier le lien"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void revokeInvite(invite.invite_id)}
                    disabled={busyInviteId !== null}
                    className="min-h-9 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 disabled:opacity-50"
                  >
                    Révoquer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
