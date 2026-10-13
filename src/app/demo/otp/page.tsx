"use client";

import { useState } from "react";
import { CodeOtp } from "@/components/CodeOtp";

type Scenario = "succes" | "echec" | "lent";
export default function DemoOtpPage() {
  const [scenario, setScenario] = useState<Scenario>("succes");
  const [key, setKey] = useState(0);
  const [result, setResult] = useState("");
  const [longueur, setLongueur] = useState<4 | 6>(4);

  const verifier = async (code: string) => {
    setResult("Vérification en cours…");
    if (scenario === "lent") await new Promise(resolve => window.setTimeout(resolve, 2800));
    return scenario !== "echec" && code.length === longueur;
  };

  return (
    <main className="min-h-screen bg-[#F2FAF5] px-4 py-12 text-[#064B2A]">
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-[#CDE5D5] bg-white/90 p-5 shadow-sm sm:p-9">
        <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#59836A]">NAXA · démonstration locale</p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Animation du code OTP</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Cette page simule la vérification dans le navigateur. Aucun code n’est envoyé au serveur et aucune donnée n’est enregistrée.</p>
        <div className="mt-6 flex flex-wrap gap-2" aria-label="Scénario de vérification">
          <button type="button" onClick={() => { setScenario("succes"); setResult(""); setKey(v => v + 1); }} className={`rounded-full border px-4 py-2 text-sm font-bold ${scenario === "succes" ? "border-[#064B2A] bg-[#064B2A] text-white" : "border-[#CDE5D5] bg-white"}`}>Simuler succès</button>
          <button type="button" onClick={() => { setScenario("echec"); setResult(""); setKey(v => v + 1); }} className={`rounded-full border px-4 py-2 text-sm font-bold ${scenario === "echec" ? "border-[#064B2A] bg-[#064B2A] text-white" : "border-[#CDE5D5] bg-white"}`}>Simuler échec</button>
          <button type="button" onClick={() => { setScenario("lent"); setResult(""); setKey(v => v + 1); }} className={`rounded-full border px-4 py-2 text-sm font-bold ${scenario === "lent" ? "border-[#064B2A] bg-[#064B2A] text-white" : "border-[#CDE5D5] bg-white"}`}>Réponse lente</button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold">Longueur :</span>
          <button type="button" onClick={() => { setLongueur(4); setResult(""); setKey(v => v + 1); }} aria-pressed={longueur === 4} className={`rounded-lg px-3 py-1.5 font-bold ${longueur === 4 ? "bg-[#FFE33D]" : "bg-slate-100"}`}>4 chiffres</button>
          <button type="button" onClick={() => { setLongueur(6); setResult(""); setKey(v => v + 1); }} aria-pressed={longueur === 6} className={`rounded-lg px-3 py-1.5 font-bold ${longueur === 6 ? "bg-[#FFE33D]" : "bg-slate-100"}`}>6 chiffres</button>
        </div>
        <div className="mt-10">
          <CodeOtp key={key} longueur={longueur} verifier={verifier} onSucces={() => setResult("Rappel onSucces exécuté.")} onEchec={() => setResult("Rappel onEchec exécuté.")} />
        </div>
        <p className="mt-5 min-h-6 text-center text-sm font-semibold" aria-live="polite">{result}</p>
        <p className="mt-6 border-t border-[#E0EEE5] pt-4 text-xs leading-5 text-slate-500">Astuce : tapez un code ou collez-le. Le scénario « réponse lente » attend réellement 2,8 secondes avant de répondre.</p>
      </div>
    </main>
  );
}
