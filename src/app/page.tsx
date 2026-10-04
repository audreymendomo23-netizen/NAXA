import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Recherche } from "@/components/Recherche";

const ETAPES = ["Je cherche", "Je trouve", "Je compare", "Je réserve"];

export default function Accueil() {
  return (
    <main className="home-ecran flex flex-col bg-naxa-green-50">
      <section className="shrink-0 bg-naxa-green-900 px-5 pt-4 text-white">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Logo />
          <Link href="/connexion" className="text-sm font-semibold underline underline-offset-4">Se connecter</Link>
        </div>
        <h1 className="mx-auto mt-4 max-w-xl text-[clamp(1.7rem,5.5dvh,2.5rem)] font-extrabold leading-[1.1]">
          Votre médicament,<br />
          <span className="text-naxa-canari">à 2 minutes.</span>
        </h1>
        <svg viewBox="0 0 340 40" preserveAspectRatio="none" className="mt-3 block h-8 w-full" aria-hidden="true">
          <path d="M0 40 L0 22 Q85 0 170 18 T340 10 L340 40 Z" className="fill-naxa-green-50" />
        </svg>
      </section>

      <div className="relative z-10 mx-auto -mt-5 w-full max-w-xl shrink-0 px-4">
        <div className="carte"><Recherche /></div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col justify-center gap-3 px-4 py-2">
        <ol className="grid grid-cols-4 gap-2 [@media(max-height:600px)]:hidden">
          {ETAPES.map((t, i) => (
            <li key={t} className="flex flex-col items-center gap-1 text-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-naxa-canari text-sm font-extrabold text-naxa-green-900">{i + 1}</span>
              <span className="text-xs font-semibold">{t}</span>
            </li>
          ))}
        </ol>
        <p className="text-[11px] leading-snug text-slate-600">
          NAXA donne une information de disponibilité, pas un avis médical. En cas d'urgence, appelez les secours ou allez à la pharmacie de garde la plus proche.
        </p>
      </div>

      <footer className="shrink-0 bg-naxa-green-900 px-5 py-3 text-xs text-naxa-green-100">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <span>NAXA, partout au Cameroun</span>
          <Link href="/connexion" className="font-semibold underline underline-offset-4">Vous êtes pharmacien ?</Link>
        </div>
      </footer>
    </main>
  );
}
