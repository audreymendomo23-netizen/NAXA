"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Profile = { username: string | null; first_name: string | null; last_name: string | null; phone: string | null };

export default function ProfilAdmin() {
  const [profile, setProfile] = useState<Profile>({ username: "", first_name: "", last_name: "", phone: "" });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const sb = supabaseBrowser();
        const { data: auth, error: authError } = await sb.auth.getUser();
        if (authError || !auth.user) { if (active) setError("Connexion requise pour afficher le profil."); return; }
        const { data, error: profileError } = await sb.from("profiles").select("username,first_name,last_name,phone").eq("id", auth.user.id).maybeSingle();
        if (profileError || !data) { if (active) setError("Les données du profil ne sont pas accessibles."); return; }
        if (active) { setProfile(data); setEmail(auth.user.email ?? ""); }
      } catch { if (active) setError("Impossible de charger le profil. Vérifiez la connexion puis réessayez."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage(""); setError("");
    try {
      const sb = supabaseBrowser();
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) { setError("Connexion requise."); return; }
      const { data: updated, error: updateError } = await sb.from("profiles").update({
        username: profile.username?.trim() || null,
        first_name: profile.first_name?.trim() || null,
        last_name: profile.last_name?.trim() || null,
        phone: profile.phone?.trim() || null,
      }).eq("id", auth.user.id).select("id").maybeSingle();
      if (updateError || updated?.id !== auth.user.id) {
        setError("Le profil n’a pas été modifié. Vérifiez la session, les champs et les autorisations.");
        return;
      }
      setMessage("Profil mis à jour.");
    } catch { setError("La mise à jour a échoué. Réessayez."); }
    finally { setSaving(false); }
  }

  return <main className="space-y-5">
    <header><div><p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">Compte administrateur</p><h1>Profil</h1><p className="mt-2 text-sm text-slate-600">Consultez et mettez à jour les informations de votre profil.</p></div><Link href="/admin" className="rounded-full border px-4 py-2 text-sm font-bold">Retour au tableau de bord</Link></header>
    {loading ? <section className="carte">Chargement du profil…</section> : <form onSubmit={save} className="carte max-w-3xl space-y-4">
      <label className="block text-sm font-semibold">Adresse e-mail (lecture seule)<input value={email} readOnly className="champ mt-1 opacity-70"/></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Prénom<input value={profile.first_name ?? ""} onChange={(event) => setProfile({...profile,first_name:event.target.value})} maxLength={100} className="champ mt-1"/></label>
        <label className="block text-sm font-semibold">Nom<input value={profile.last_name ?? ""} onChange={(event) => setProfile({...profile,last_name:event.target.value})} maxLength={100} className="champ mt-1"/></label>
        <label className="block text-sm font-semibold">Nom d’utilisateur<input value={profile.username ?? ""} onChange={(event) => setProfile({...profile,username:event.target.value})} maxLength={40} className="champ mt-1"/></label>
        <label className="block text-sm font-semibold">Téléphone<input value={profile.phone ?? ""} onChange={(event) => setProfile({...profile,phone:event.target.value})} maxLength={30} className="champ mt-1"/></label>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
      <button disabled={saving || loading} className="min-h-11 rounded-xl bg-[#0B3D26] px-5 py-3 font-bold text-white disabled:opacity-60">{saving ? "Enregistrement…" : "Enregistrer le profil"}</button>
    </form>}
  </main>;
}
