"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { BulleErreur } from "@/components/BulleErreur";
import { BullesAuthentification } from "@/components/BullesAuthentification";
import { BoutonNAXA } from "@/components/BoutonNAXA";

const COUNTRIES = [
  ["CM", "🇨🇲", "+237", "Cameroun", 9], ["AO", "🇦🇴", "+244", "Angola", 9],
  ["BI", "🇧🇮", "+257", "Burundi", 8], ["CF", "🇨🇫", "+236", "Centrafrique", 8],
  ["TD", "🇹🇩", "+235", "Tchad", 8], ["CG", "🇨🇬", "+242", "Congo", 9],
  ["CD", "🇨🇩", "+243", "RDC", 9], ["GQ", "🇬🇶", "+240", "Guinée équatoriale", 9],
  ["GA", "🇬🇦", "+241", "Gabon", 8], ["RW", "🇷🇼", "+250", "Rwanda", 9],
  ["ST", "🇸🇹", "+239", "São Tomé-et-Príncipe", 7],
] as const;

function ageOf(value: string) {
  if (!value) return null;
  const birth = new Date(value + "T00:00:00");
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
}

function safeInternalPath(value: string | null) {
  if (!value || !value.startsWith("/")) return "/";
  try {
    const target = new URL(value, "https://naxa.invalid");
    return target.origin === "https://naxa.invalid" ? target.pathname + target.search + target.hash : "/";
  } catch {
    return "/";
  }
}

function Formulaire() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeInternalPath(search.get("next"));
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("CM");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = COUNTRIES.find((item) => item[0] === country) ?? COUNTRIES[0];
  const age = useMemo(() => ageOf(dob), [dob]);

  useEffect(() => {
    void (async () => {
      const sb = supabaseBrowser();
      const { data, error: authError } = await sb.auth.getUser();
      if (authError || !data.user) {
        router.replace("/connexion");
        return;
      }
      const metadata = data.user.user_metadata || {};
      const fullName = String(metadata.full_name || metadata.name || "");
      const names = fullName.trim().split(/\s+/);
      setFirstName(String(metadata.given_name || metadata.first_name || names.slice(0, -1).join(" ") || ""));
      setLastName(String(metadata.family_name || metadata.last_name || names.slice(-1).join(" ") || ""));
      const { data: profile } = await sb.from("profiles")
        .select("username,first_name,last_name,phone,date_of_birth,consent_accepted_at")
        .eq("id", data.user.id).maybeSingle();
      if (profile) {
        setUsername(String(profile.username || ""));
        setFirstName(String(profile.first_name || metadata.given_name || metadata.first_name || names.slice(0, -1).join(" ") || ""));
        setLastName(String(profile.last_name || metadata.family_name || metadata.last_name || names.slice(-1).join(" ") || ""));
        const phoneValue = String(profile.phone || "");
        const matchedCountry = COUNTRIES.find((item) => phoneValue.startsWith(item[2]));
        if (matchedCountry) {
          setCountry(matchedCountry[0]);
          setPhone(phoneValue.slice(matchedCountry[2].length).replace(/\D/g, ""));
        } else if (phoneValue) {
          setPhone(phoneValue.replace(/\D/g, "").slice(-selected[4]));
        }
        setDob(String(profile.date_of_birth || ""));
      }
    })();
  }, [router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username.trim().toLowerCase())) {
      setError("Identifiant invalide : 3 à 30 caractères.");
      return;
    }
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setError("Renseignez votre prénom et votre nom.");
      return;
    }
    if (phone.replace(/\D/g, "").length !== selected[4]) {
      setError("Le numéro ne correspond pas au pays choisi.");
      return;
    }
    if (age === null || age < 18) {
      setError("NAXA est réservé aux personnes âgées de 18 ans ou plus.");
      return;
    }
    if (!consent) {
      setError("Vous devez accepter explicitement les conditions.");
      return;
    }

    setBusy(true);
    const { error: rpcError } = await supabaseBrowser().rpc("naxa_complete_google_profile", {
      p_username: username.trim().toLowerCase(),
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_phone: selected[2] + phone.replace(/\D/g, ""),
      p_phone_country: selected[0],
      p_date_of_birth: dob,
      p_consent_accepted: consent,
    });
    setBusy(false);
    if (rpcError) {
      const message = rpcError.message || "";
      setError(
        message.includes("déjà pris") || message.includes("already exists")
          ? "Cet identifiant est déjà utilisé."
          : message.includes("18 ans")
            ? "NAXA est réservé aux personnes âgées de 18 ans ou plus."
            : "Profil non enregistré. Vérifiez les informations et réessayez."
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="carte w-full max-w-lg space-y-2 p-4 sm:space-y-3 sm:p-5">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">NAXA · Sécurisation du compte</p>
        <h1 className="mt-1 text-xl font-extrabold sm:text-2xl">Compléter mon profil</h1>
        <p className="mt-1 text-xs leading-snug text-slate-600 sm:mt-2 sm:text-sm">
          Quelques informations sont nécessaires pour sécuriser votre compte et confirmer votre majorité.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-semibold sm:text-sm">Prénom
          <input className="champ mt-1" required minLength={2} maxLength={80} autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        </label>
        <label className="block text-xs font-semibold sm:text-sm">Nom
          <input className="champ mt-1" required minLength={2} maxLength={80} autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
        </label>
      </div>

      <label className="block text-sm font-semibold">Nom d'utilisateur
        <input className="champ mt-1" required minLength={3} maxLength={30} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value.replace(/\s/g, "").toLowerCase())} />
        <span className="mt-1 block text-xs text-slate-500">3 à 30 caractères : lettres, chiffres, point, tiret ou underscore.</span>
      </label>

      <label className="block text-sm font-semibold">Téléphone
        <span className="mt-1 flex min-w-0 gap-2">
          <select aria-label="Pays et indicatif téléphonique" className="champ w-[46%] shrink-0 px-2 text-xs sm:text-sm" value={country} onChange={(event) => { setCountry(event.target.value); setPhone(""); }}>
            {COUNTRIES.map((item) => <option key={item[0]} value={item[0]}>{item[1]} {item[3]} ({item[2]})</option>)}
          </select>
          <input className="champ min-w-0 flex-1" required inputMode="numeric" autoComplete="tel-national" maxLength={selected[4]} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, selected[4]))} placeholder={selected[2] + " …"} />
        </span>
        <span className="mt-1 block text-xs text-slate-500">{selected[4]} chiffres attendus pour {selected[3]}.</span>
      </label>

      <label className="block text-sm font-semibold">Date de naissance
        <input className="champ mt-1" required type="date" max={new Date().toISOString().slice(0, 10)} value={dob} onChange={(event) => setDob(event.target.value)} />
      </label>
      {age !== null && age < 18 && <p role="alert" className="rounded-xl2 bg-red-50 p-3 text-sm font-semibold text-red-700">NAXA est réservé aux personnes âgées de 18 ans ou plus.</p>}

      <label className="flex items-start gap-2 text-xs leading-snug">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#FFE33D]" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
        <span className="flex-1">J'accepte les <Link href="/conditions-utilisation" target="_blank" rel="noreferrer" className="font-bold underline">Conditions d'utilisation</Link>, la <Link href="/politique-confidentialite" target="_blank" rel="noreferrer" className="font-bold underline">Politique de confidentialité</Link> et la <Link href="/politique-securite" target="_blank" rel="noreferrer" className="font-bold underline">Politique de sécurité et de protection des données</Link> de <strong className="naxa-text">NAXA</strong>.</span>
      </label>

      <BoutonNAXA type="submit" importance="importante" className="btn-canari w-full" loading={busy} disabled={busy || age === null || age < 18 || !consent}>
        {busy ? "Vérification et enregistrement…" : "Valider et continuer"}
      </BoutonNAXA>
      {error && <BulleErreur key={error} message={error} />}
      <p className="text-center text-xs text-slate-600">Vous souhaitez revenir à l'accueil ? <Link href="/" className="font-bold underline">Continuer sans autre action</Link></p>
    </form>
  );
}

export default function CompleterProfilPage() {
  return (
    <main className="auth-ecran relative isolate flex min-h-screen flex-col items-center justify-center gap-2 overflow-hidden bg-naxa-green-900 px-3 py-3 sm:px-5">
      <BullesAuthentification />
      <div className="relative z-10 flex w-full flex-col items-center justify-center gap-2">
        <Logo />
        <Suspense fallback={<p className="text-sm text-white">Chargement…</p>}>
          <Formulaire />
        </Suspense>
      </div>
    </main>
  );
}
