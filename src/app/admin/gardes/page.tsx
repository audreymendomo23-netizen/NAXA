import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { GardesAdminClient } from "@/components/admin/GardesAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminGardesPage() {
  await requireAdminActive("/admin/gardes");
  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:px-6">
      <Link href="/admin" className="inline-flex min-h-11 items-center font-semibold text-emerald-800 underline underline-offset-4">
        ← Retour à l’administration
      </Link>
      <header className="rounded-3xl bg-emerald-900 p-5 text-white sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">Réseau national</p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Planning des pharmacies de garde</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
          Publiez les périodes confirmées pour les pharmacies partenaires de toutes les régions. Les pharmacies de démonstration,
          inactives ou archivées sont exclues. Chaque publication est horodatée et expire automatiquement de l’affichage public après 24 heures sans nouvelle vérification.
        </p>
      </header>
      <GardesAdminClient />
    </main>
  );
}
