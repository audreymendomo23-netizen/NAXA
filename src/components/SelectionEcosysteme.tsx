"use client";

import { useEffect, useState } from "react";
import {
  ECOSYSTEMES,
  type EcosystemeId,
} from "@/lib/ecosystemes";

type Props = {
  onSelect: (id: EcosystemeId) => void;
};

type Availability = Partial<Record<EcosystemeId, boolean>>;

export function SelectionEcosysteme({ onSelect }: Props) {
  const [availability, setAvailability] = useState<Availability>({ pharmacie: true });
  const [loading, setLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [lockedNotice, setLockedNotice] = useState("");

  useEffect(() => {
    const lockedSlug = new URLSearchParams(window.location.search).get("universVerrouille");
    if (lockedSlug) {
      const ecosystemeId = lockedSlug === "suivi" ? "dispositifs" : lockedSlug;
      const lockedItem = ECOSYSTEMES.find((item) => item.id === ecosystemeId);
      if (lockedItem) setLockedNotice(`L’espace ${lockedItem.label} est actuellement verrouillé par l’administration NAXA.`);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/universes/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("status_unavailable");
        return response.json() as Promise<{ universes?: Availability }>;
      })
      .then((result) => {
        if (!active) return;
        setAvailability({ pharmacie: true, ...(result.universes ?? {}) });
        setAvailabilityError(false);
      })
      .catch(() => {
        if (!active) return;
        // En cas d'indisponibilité du contrôle central, ne pas ouvrir par défaut
        // les univers dont l'Admin peut avoir suspendu l'accès.
        setAvailability({ pharmacie: true });
        setAvailabilityError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-[100dvh] bg-[#F7FAF8] px-4 pb-10 pt-[max(24px,env(safe-area-inset-top,0px))] text-slate-900">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-7 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#0A6B3A]">NAXA · Un seul compte, plusieurs espaces</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#123D2C] sm:text-4xl">Choisissez votre écosystème</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
            Accédez directement au service qui vous intéresse. Votre compte NAXA vous permet ensuite de passer d’un écosystème à l’autre.
          </p>
        </div>

        {lockedNotice && (
          <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            {lockedNotice}
          </p>
        )}
        {availabilityError && (
          <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            La disponibilité des autres espaces ne peut pas être vérifiée pour le moment. Seul l’espace Pharmacie reste accessible jusqu’au rétablissement du contrôle.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ECOSYSTEMES.map((item) => {
            const enabled = availability?.[item.id] === true;
            const waiting = loading && item.id !== "pharmacie";
            const locked = !enabled && !waiting;
            return (
              <button
                key={item.id}
                type="button"
                disabled={waiting || locked}
                onClick={() => onSelect(item.id)}
                className="group relative isolate flex min-h-[158px] items-start gap-4 overflow-hidden rounded-2xl border p-4 text-left text-white shadow-md transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-75 disabled:hover:translate-y-0 disabled:hover:shadow-md"
                style={{
                  borderColor: locked ? "#CBD5E1" : item.softColor,
                  backgroundColor: item.color,
                  backgroundImage: `linear-gradient(100deg, ${locked ? "#334155E8" : item.color + "F0"} 0%, ${locked ? "#475569D9" : item.color + "D9"} 58%, ${locked ? "#64748BAA" : item.color + "B0"} 100%), url("${item.image}")`,
                  backgroundSize: "100% 100%, 300% 200%",
                  backgroundPosition: `center, ${item.imagePosition}`,
                  backgroundRepeat: "no-repeat",
                }}
              >
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/35 bg-white/90 text-2xl font-black shadow-sm"
                  style={{ color: item.color }}
                >
                  {item.symbol}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-extrabold text-white drop-shadow-sm">
                    {item.label}
                    {locked && <span className="rounded-full border border-white/30 bg-slate-950/35 px-2 py-1 text-[10px] font-bold text-white">Verrouillé</span>}
                    {waiting && <span className="text-[10px] font-semibold text-white/85">Vérification…</span>}
                  </span>
                  <span className="mt-1 block text-sm font-medium leading-5 text-white/95 drop-shadow-sm">{item.description}</span>
                  {locked && <span className="mt-2 block text-xs font-semibold text-white/90">Accès fermé par l’administration NAXA</span>}
                  {enabled && <span className="mt-2 block text-xs font-bold" style={{ color: item.color }}>Accéder à cet espace <span aria-hidden="true">→</span></span>}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-slate-500">
          NAXA est réservé aux personnes âgées de 18 ans ou plus. Les espaces professionnels disposent de leurs propres contrôles d’accès.
        </p>
      </div>
    </main>
  );
}
