import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { DailyMedImageReview } from "@/components/admin/DailyMedImageReview";

export default async function AdminMedicamentsImages() {
  await requireAdminActive("/admin/medicaments-images");
  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <header className="space-y-2">
        <p className="text-xs font-extrabold uppercase tracking-[.18em] text-emerald-800">Catalogue santé · Images</p>
        <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Recherche d’images DailyMed</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Recherche en direct avec rapprochement RxNorm. Les images SPLIMAGE proposées sont des vues de comprimés ou de gélules extraites des notices, pas des photos de boîtes.
        </p>
      </header>
      <DailyMedImageReview />
    </main>
  );
}
