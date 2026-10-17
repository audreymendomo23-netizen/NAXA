"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Method = "MTN MoMo" | "Orange Money" | "Cash";
type PhoneMap = { momo: string; orange: string };

function CheckIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>;
}
function MtnMomoLogo() {
  return <svg viewBox="0 0 100 100" role="img" aria-label="MTN MoMo" className="h-12 w-12">
    <rect width="100" height="100" rx="12" fill="#0B4F6C"/>
    <path d="M18 68C35 52 42 31 47 12c19 5 32 21 34 42-10-7-18-7-27-1-11 7-20 13-36 15Z" fill="#FFCB05"/>
    <path d="M59 21c14 7 22 21 22 35 0 9-4 16-10 22 4-18-1-37-12-57Z" fill="#FFCB05"/>
    <circle cx="48" cy="31" r="8" fill="#0B4F6C"/>
    <path d="M0 84h100v4a12 12 0 0 1-12 12H12A12 12 0 0 1 0 88Z" fill="#FFCB05"/>
  </svg>;
}
function OrangeMoneyLogo() {
  return <svg viewBox="0 0 100 100" role="img" aria-label="Orange Money" className="h-12 w-12">
    <rect width="100" height="100" rx="12" fill="#000"/>
    <path d="m18 43 25-25a5 5 0 0 1 7 0l12 12-8 8-7-7-21 21Z" fill="#fff"/>
    <path d="m82 57-25 25a5 5 0 0 1-7 0L38 70l8-8 7 7 21-21Z" fill="#FF7900"/>
    <path d="m31 52 22-22 8 8-22 22Z" fill="#fff"/>
    <path d="m69 48-22 22-8-8 22-22Z" fill="#FF7900"/>
  </svg>;
}
function CashIllustration() {
  return <svg viewBox="0 0 200 200" role="img" aria-label="Illustration du paiement en espèces" className="h-40 w-40 animate-[naxa-profile-enter_300ms_ease-out]">
    <circle cx="100" cy="100" r="96" fill="#FDE9E2"/>
    <path d="M22 83Q48 48 78 70T126 75T173 54M29 132Q63 105 83 126T139 123T174 145" fill="none" stroke="#8797A8" strokeWidth="1.6" strokeDasharray="3 5"/>
    <rect x="17" y="27" width="46" height="24" rx="7" fill="#C9A5E0" transform="rotate(-9 17 27)"/><text x="40" y="44" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800" fontStyle="italic" transform="rotate(-9 40 44)">PAY</text>
    <g transform="rotate(-12 101 111)"><rect x="53" y="95" width="92" height="45" rx="4" fill="#3E9B4F"/><circle cx="99" cy="117" r="14" fill="#7DBB6A"/><text x="99" y="123" textAnchor="middle" fontSize="19" fill="#fff" fontWeight="800">$</text></g>
    <g transform="rotate(8 102 108)"><rect x="57" y="87" width="91" height="45" rx="4" fill="#7DBB6A"/><path d="M65 95h75v29H65Z" fill="none" stroke="#3E9B4F" strokeWidth="2"/><circle cx="102" cy="110" r="12" fill="#3E9B4F"/><text x="102" y="116" textAnchor="middle" fontSize="17" fill="#fff" fontWeight="800">$</text></g>
    <path d="M137 8h24a7 7 0 0 1 7 7v24h-31Z" fill="#4C97F5"/><path d="M137 30h31v9h-31Z" fill="#2A7BD0"/><path d="M151 38c-2 13-12 25-19 35l-10 12c-5 7 2 13 8 8l16-13c8-7 16-18 18-30l2-12Z" fill="#F7A47A"/>
    <path d="M15 161h28v25H15Z" fill="#EF3F5B"/><path d="M15 161h28v7H15Z" fill="#D92548"/><path d="M38 163c13-9 23-13 34-12l14 5c8 3 12 8 9 13-2 4-7 4-12 2l-9-3 14 11c5 4 1 11-5 8l-23-10-16 3Z" fill="#F7A47A"/>
    <circle cx="163" cy="154" r="17" fill="#4CAF50"/><path d="m155 154 5 5 10-11" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^237/, "");
  return digits.length === 9 ? `${digits[0]}•• ••• •${digits.slice(-2)}` : "Numéro non renseigné";
}

export default function PaiementClientPage() {
  const [method, setMethod] = useState<Method>("MTN MoMo");
  const [phones, setPhones] = useState<PhoneMap>({ momo: "", orange: "" });
  const [editing, setEditing] = useState<"momo" | "orange" | null>(null);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const savedMethod = window.localStorage.getItem("naxa-client-payment-method-v1");
      if (savedMethod === "MTN MoMo" || savedMethod === "Orange Money" || savedMethod === "Cash") setMethod(savedMethod);
      const savedPhones = JSON.parse(window.localStorage.getItem("naxa-client-payment-phones-v1") || "{}");
      if (savedPhones && typeof savedPhones === "object") setPhones({ momo: typeof savedPhones.momo === "string" ? savedPhones.momo : "", orange: typeof savedPhones.orange === "string" ? savedPhones.orange : "" });
    } catch { /* Le choix reste disponible même sans stockage local. */ }
  }, []);

  const phoneKey = method === "Orange Money" ? "orange" : "momo";
  const activePhone = phones[phoneKey];
  function flash(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2500); }
  function confirm() {
    const digits = phoneDraft.replace(/\D/g, "").replace(/^237/, "");
    if (editing && digits && !/^6\d{8}$/.test(digits)) { flash("Saisissez un numéro camerounais valide : 6XX XX XX XX."); return; }
    const nextPhones = editing && digits ? { ...phones, [editing]: digits } : phones;
    try {
      window.localStorage.setItem("naxa-client-payment-method-v1", method);
      window.localStorage.setItem("naxa-client-payment-phones-v1", JSON.stringify(nextPhones));
      window.dispatchEvent(new CustomEvent("naxa-payment-updated", { detail: { method } }));
    } catch { flash("Impossible d’enregistrer ce choix sur cet appareil."); return; }
    setPhones(nextPhones);
    setEditing(null);
    flash("Moyen de paiement enregistré.");
    window.setTimeout(() => { window.location.href = "/client/profil"; }, 450);
  }
  function startEdit() {
    setEditing(phoneKey);
    setPhoneDraft(activePhone ? activePhone.replace(/^(6)(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4 $5") : "");
  }

  return <main className="min-h-dvh bg-black/35 px-0 text-[#111111]">
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-end">
      <section role="dialog" aria-modal="true" aria-labelledby="payment-title" className="naxa-profile-sheet w-full rounded-t-[24px] bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl">
        <Link href="/client/profil" aria-label="Retour au profil" className="mb-2 flex h-8 w-full items-center justify-center"><span className="h-1.5 w-10 rounded-full bg-[#D1D5DB]"/></Link>
        <h1 id="payment-title" className="mb-4 text-xl font-extrabold text-[#0F4D26]">Moyen de paiement</h1>
        <div className="space-y-2">
          {([
            { value: "MTN MoMo" as const, label: "MTN MoMo" },
            { value: "Orange Money" as const, label: "Orange Money" },
            { value: "Cash" as const, label: "Cash", subtitle: "Payer à la livraison" },
          ]).map(option => <button key={option.value} type="button" onClick={() => setMethod(option.value)} aria-pressed={method === option.value} className={`flex min-h-[72px] w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all active:scale-[.99] ${method === option.value ? "border-[#1E7B3A] bg-[#E9F5EC]/60" : "border-[#E5E7EB] bg-white"}`}>
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl ${option.value === "Orange Money" ? "bg-black" : "bg-white"}`}>{option.value === "MTN MoMo" ? <MtnMomoLogo/> : option.value === "Orange Money" ? <OrangeMoneyLogo/> : <span className="text-2xl" aria-hidden="true">💵</span>}</span>
            <span className="min-w-0 flex-1"><span className="block font-bold text-[#111111]">{option.label}</span>{"subtitle" in option && <span className="mt-0.5 block text-sm text-[#6B7280]">{option.subtitle}</span>}</span>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all ${method === option.value ? "scale-100 border-[#1E7B3A] bg-[#1E7B3A] text-white" : "scale-90 border-[#D1D5DB] text-transparent"}`}><CheckIcon/></span>
          </button>)}
        </div>
        {method === "Cash" ? <div className="flex flex-col items-center pt-3 text-center"><CashIllustration/><p className="mt-1 text-sm font-semibold text-[#374151]">Vous payez en espèces à la livraison</p></div> : <div className="mt-4 rounded-2xl bg-[#F8FAF8] p-4">
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-[#111111]">Numéro enregistré</p><p className="mt-1 text-sm text-[#6B7280]">{maskPhone(activePhone)}</p></div><button type="button" onClick={startEdit} className="min-h-10 rounded-lg px-3 text-sm font-bold text-[#1E7B3A]">Modifier</button></div>
          {editing && <div className="mt-3"><label htmlFor="payment-phone" className="text-sm font-semibold text-[#374151]">Numéro camerounais</label><input id="payment-phone" autoComplete="tel-national" inputMode="tel" value={phoneDraft} onChange={e => setPhoneDraft(e.target.value.replace(/[^0-9 +]/g, "").slice(0, 16))} placeholder="6XX XX XX XX" className="naxa-profile-input mt-1"/><p className="mt-1 text-xs text-[#6B7280]">Format : 6XX XX XX XX</p></div>}
        </div>}
        <button type="button" onClick={confirm} className="mt-5 min-h-12 w-full rounded-xl bg-[#1E7B3A] font-extrabold text-white transition-transform active:scale-[.99]">Confirmer</button>
        <Link href="/client/profil" className="mt-1 flex min-h-11 items-center justify-center font-semibold text-[#6B7280]">Annuler</Link>
      </section>
    </div>
    {toast && <div role="status" aria-live="polite" className="naxa-profile-toast fixed left-1/2 top-4 z-[150] -translate-x-1/2 rounded-full bg-[#0F4D26] px-4 py-3 text-sm font-semibold text-white shadow-lg">{toast}</div>}
  </main>;
}
