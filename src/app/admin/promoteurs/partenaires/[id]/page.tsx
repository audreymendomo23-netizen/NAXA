import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { validerDossierPartenaire } from "../actions";

type Props = { params: { id: string }; searchParams?: { ok?: string; erreur?: string } };
const universes: Record<string, string> = {
  parapharmacie: "Parapharmacie", examens: "Examens médicaux",
  prestations: "Prestations à domicile", aide: "Aide NAXA",
};
const statuses: Record<string, string> = { pending: "À vérifier", validated: "Validé", rejected: "Rejeté" };
const docs: [string, string][] = [
  ["kyc", "Know Your Customer (KYC)"],
  ["piece_existence_legale", "Pièce d’existence légale"], ["registre_commerce", "Registre de commerce"],
  ["niu", "Numéro d’identifiant unique (NIU)"], ["attestation_non_redevance", "Attestation de non-redevance"],
  ["plan_localisation", "Plan de localisation"], ["cni_promoteur", "CNI du Promoteur"],
];

export default async function DossierPartenaire({ params, searchParams }: Props) {
  await requireAdminActive("/admin/promoteurs");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.id)) notFound();

  const db = supabaseAdmin();
  const { data: dossier, error } = await db.from("admin_partner_dossiers")
    .select("partner_id,promoteur_id,universe_slug,monthly_fee_fcfa,architecture_code,documents_received,dossier_status,created_at,partners!inner(id,name,partner_type,city,neighborhood,address_private,phone_private,whatsapp,latitude,longitude,status),profiles!inner(username,first_name,last_name,phone,phone_country,date_of_birth)")
    .eq("partner_id", params.id).maybeSingle();
  if (error) {
    console.error("[admin.promoteurs.dossier] lecture impossible", {
      code: error.code,
      message: error.message,
    });
    throw new Error("Impossible de charger le dossier Promoteur. Réessayez plus tard ou consultez les journaux techniques.");
  }
  if (!dossier) notFound();
  const partner = (dossier as any).partners;
  const owner = (dossier as any).profiles;
  const authOwner = await db.auth.admin.getUserById(dossier.promoteur_id);
  const email = authOwner.data.user?.email ?? "Non renseigné";
  const money = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(dossier.monthly_fee_fcfa) + " FCFA";
  return <main className="mx-auto max-w-5xl space-y-5 px-3 py-5 sm:px-6">
    <Link href="/admin/promoteurs" className="inline-flex min-h-10 items-center font-semibold text-naxa-green-900 underline">← Retour au Dossier Promoteur</Link>
    <header className="rounded-3xl bg-naxa-green-900 p-5 text-white sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-white/70">Dossier Promoteur · {universes[dossier.universe_slug] ?? dossier.universe_slug}</p>
      <h1 className="mt-2 text-2xl font-black sm:text-3xl">{partner.name}</h1>
      <p className="mt-2 text-sm text-white/80">{[partner.neighborhood, partner.city].filter(Boolean).join(" · ")}</p>
      <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-[#FFE23D] px-3 py-1 text-xs font-extrabold text-[#0B3D26]">{statuses[dossier.dossier_status] ?? dossier.dossier_status}</span><span className="rounded-full bg-white/15 px-3 py-1 text-xs">Partenaire : {partner.status}</span></div>
    </header>
    {searchParams?.ok === "validation" && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900">Dossier validé. Le partenaire et son association à l’univers sont activés.</p>}
    {searchParams?.erreur && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-900">{searchParams.erreur === "univers-inactif" ? "L’univers doit être activé dans le Catalogue NAXA avant de valider ce dossier." : searchParams.erreur === "validation-requise" ? "Ce dossier doit être validé depuis cette fiche, afin d’activer ensemble le partenaire et son association à l’univers." : "La validation n’a pas abouti. Le dossier reste en attente."}</p>}
    <section className="grid gap-3 md:grid-cols-2">
      <article className="rounded-2xl border bg-white p-4"><h2 className="text-lg font-extrabold">Établissement / partenaire</h2><p className="mt-2 text-sm">Univers : {universes[dossier.universe_slug] ?? dossier.universe_slug}</p><p className="text-sm">Type : {partner.partner_type}</p><p className="text-sm">Adresse : {partner.address_private || "Non renseignée"}</p><p className="text-sm">WhatsApp : {partner.whatsapp || "Non renseigné"}</p><p className="text-sm">Coordonnées : {partner.latitude ?? "—"} · {partner.longitude ?? "—"}</p><p className="mt-3 text-sm font-bold">Tarif mensuel convenu : {money}</p>{dossier.architecture_code && <p className="mt-1 text-sm">Architecture : {dossier.architecture_code}</p>}</article>
      <article className="rounded-2xl border bg-white p-4"><h2 className="text-lg font-extrabold">Identification du Promoteur</h2><p className="mt-2 text-sm">Nom : {[owner.first_name, owner.last_name].filter(Boolean).join(" ") || "Non renseigné"}</p><p className="text-sm">Nom d’utilisateur : {owner.username || "Non renseigné"}</p><p className="text-sm">Téléphone : {owner.phone || "Non renseigné"}</p><p className="text-sm">E-mail : {email}</p><p className="text-sm">Date de naissance : {owner.date_of_birth ? new Date(owner.date_of_birth).toLocaleDateString("fr-FR") : "Non renseignée"}</p><p className="mt-3 text-xs text-slate-500">Dossier créé le {new Date(dossier.created_at).toLocaleString("fr-FR")}</p></article>
    </section>
    <section className="rounded-2xl border bg-white p-4"><h2 className="text-lg font-extrabold">Documentation déclarée reçue</h2><ul className="mt-3 grid gap-2 sm:grid-cols-2">{docs.map(([key, label]) => <li key={key} className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm"><span aria-hidden="true">{(dossier.documents_received as Record<string, unknown>)?.[key] === true ? "✓" : "—"}</span><span>{label}</span><strong className="ml-auto">{(dossier.documents_received as Record<string, unknown>)?.[key] === true ? "Reçue" : "Non déclarée"}</strong></li>)}</ul><p className="mt-3 text-xs text-slate-500">Ces cases déclarent les pièces reçues ; elles ne remplacent pas les fichiers justificatifs authentifiés.</p></section>
    {dossier.dossier_status === "pending" && <form action={validerDossierPartenaire} className="rounded-2xl border-2 border-[#FFE23D] bg-white p-4"><input type="hidden" name="partner_id" value={dossier.partner_id}/><p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">Étape 2 · Décision administrative</p><h2 className="mt-1 text-xl font-extrabold">Valider le dossier Promoteur</h2><p className="mt-2 text-sm text-slate-600">Après contrôle des informations et des pièces, cette action active le compte Promoteur, le partenaire et son association à l’univers en une transaction. La publication des produits, offres ou services reste une étape distincte dans Univers &amp; catalogue.</p><button className="mt-4 min-h-12 w-full rounded-xl border-2 border-[#FFE23D] bg-[#FFE23D] px-5 py-3 font-extrabold text-[#0B3D26] sm:w-auto">VALIDER LE DOSSIER ET ACTIVER LE PARTENAIRE</button></form>}
  </main>;
}
