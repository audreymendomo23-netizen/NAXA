"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SupportAgentPasswordRotation() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/support-agent/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Le remplacement a échoué.");
      router.replace("/equipe-support");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le remplacement a échoué.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">Sécurité du compte Agent</p>
        <h1 className="text-2xl font-black">Remplacer le mot de passe provisoire</h1>
        <p className="text-sm text-slate-600">Avant d’accéder aux dossiers NAXA, choisissez un mot de passe personnel que vous seul connaissez.</p>
        <label className="block space-y-1 text-sm font-semibold">
          Nouveau mot de passe
          <input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 p-3" required />
        </label>
        <label className="block space-y-1 text-sm font-semibold">
          Confirmer le mot de passe
          <input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-xl border border-slate-300 p-3" required />
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button type="submit" disabled={saving || !password || !confirmation} className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white disabled:opacity-40">{saving ? "Enregistrement…" : "Sécuriser mon compte"}</button>
      </form>
    </main>
  );
}
