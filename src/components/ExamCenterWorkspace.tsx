"use client";

import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

type WorkspaceAssignment = {
  id: string;
  center_id: string;
  role_key: string;
  role_label: string;
  active_role: boolean;
  links: Array<{ href: string; label: string }>;
};

type WorkspaceCenter = {
  id: string;
  display_name: string;
  address_label: string | null;
  city: string | null;
};

type SetActiveRoleAction = (formData: FormData) => void | Promise<void>;

function WorkspaceContent({
  assignments,
  centers,
  children,
  setActiveRoleAction,
}: {
  assignments: WorkspaceAssignment[];
  centers: WorkspaceCenter[];
  children: ReactNode;
  setActiveRoleAction: SetActiveRoleAction;
}) {
  const searchParams = useSearchParams();
  const requestedCenter = searchParams.get("centre") ?? "";
  const availableCenterIds = new Set(assignments.map((assignment) => assignment.center_id));
  const selectedCenterId = availableCenterIds.has(requestedCenter)
    ? requestedCenter
    : assignments[0]?.center_id ?? "";
  const center = centers.find((item) => item.id === selectedCenterId);
  const centerAssignments = assignments.filter((item) => item.center_id === selectedCenterId);
  const selectedAssignment = centerAssignments.find((item) => item.active_role) ?? null;

  if (!center) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-5 text-sm text-slate-700">
        Aucun centre actif n’est disponible pour ce compte.
      </div>
    );
  }

  const withCenter = (href: string) => href + "?centre=" + encodeURIComponent(selectedCenterId);

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-900">
      <header className="bg-[#172554] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-200">NAXA · ERP Examens</p>
            <h1 className="mt-1 text-lg font-black">{center.display_name}</h1>
            <p className="text-xs text-blue-100">
              {center.address_label}
              {center.city ? " · " + center.city : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-100">Poste actif dans ce centre</p>
            <p className="font-bold">
              {selectedAssignment?.role_label ?? "Aucun poste actif"}
            </p>
          </div>
        </div>
      </header>

      {centers.length > 1 && (
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2">
            <span className="mr-1 text-xs font-bold text-slate-500">Mes centres</span>
            {centers.map((item) => (
              <Link
                key={item.id}
                href={"/centre-examens?centre=" + encodeURIComponent(item.id)}
                aria-current={item.id === selectedCenterId ? "page" : undefined}
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-semibold " +
                  (item.id === selectedCenterId
                    ? "border-blue-900 bg-blue-50 text-blue-900"
                    : "border-slate-200 text-slate-600")
                }
              >
                {item.display_name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {centerAssignments.length > 1 && (
        <section className="border-b border-slate-200 bg-blue-50">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3">
            <span className="mr-1 text-xs font-bold text-blue-950">Mes postes</span>
            {centerAssignments.map((assignment) =>
              assignment.active_role ? (
                <span
                  key={assignment.id}
                  className="rounded-full border border-blue-900 bg-blue-900 px-3 py-1.5 text-xs font-bold text-white"
                  aria-current="true"
                >
                  {assignment.role_label} · actif
                </span>
              ) : (
                <form key={assignment.id} action={setActiveRoleAction}>
                  <input type="hidden" name="center_id" value={selectedCenterId} />
                  <input type="hidden" name="assignment_id" value={assignment.id} />
                  <button
                    type="submit"
                    className="min-h-8 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-100"
                  >
                    Activer {assignment.role_label}
                  </button>
                </form>
              ),
            )}
          </div>
        </section>
      )}

      <nav
        aria-label="Navigation ERP centre d’examens"
        className="border-b border-slate-200 bg-white"
      >
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2">
          <Link
            href={withCenter("/centre-examens")}
            className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-2 text-sm font-bold"
          >
            Vue générale
          </Link>
          {selectedAssignment?.links.map((item) => (
            <Link
              key={item.href}
              href={withCenter(item.href)}
              className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-900"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-5">{children}</main>
    </div>
  );
}

export default function ExamCenterWorkspace(props: {
  assignments: WorkspaceAssignment[];
  centers: WorkspaceCenter[];
  children: ReactNode;
  setActiveRoleAction: SetActiveRoleAction;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F7FB] p-6 text-sm text-slate-600">
          Chargement de votre espace Examens…
        </div>
      }
    >
      <WorkspaceContent {...props} />
    </Suspense>
  );
}
