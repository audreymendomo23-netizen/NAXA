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
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState(false);

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
                className="group flex min-h-[128px] items-start gap-4 rounded-2xl border bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
                style={{ borderColor: locked ? "#E2E8F0" : item.softColor }}
              >
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl font-black"
                  style={{ backgroundColor: item.softColor, color: item.color }}
                >
                  {item.symbol}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-extrabold text-slate-900">
                    {item.label}
                    {locked && <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">Verrouillé</span>}
                    {waiting && <span className="text-[10px] font-semibold text-slate-400">Vérification…</span>}
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-slate-600">{item.description}</span>
                  {locked && <span className="mt-2 block text-xs font-semibold text-slate-500">Accès fermé par l’administration NAXA</span>}
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
