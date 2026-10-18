import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { archiveHomeServiceOffer, createHomeServiceOffer, transitionHomeServiceRequest } from "./actions";
import { BoutonNotifications } from "@/components/BoutonNotifications";

const field = "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900";
const offerStatus: Record<string, string> = { draft: "Brouillon — en attente de validation", active: "Publié", archived: "Archivé" };
const requestStatus: Record<string, string> = { requested: "À confirmer", confirmed: "Confirmée", completed: "Terminée", cancelled: "Annulée", expired: "Expirée" };
const money = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value) + " FCFA";

export default async function PartnerHomeServices({ searchParams }: { searchParams: { ok?: string; erreur?: string; q?: string; statut_demande?: string; statut_offre?: string } }) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/partenaire/prestations");
  const { data: members, error: memberError } = await sb.from("partner_members")
    .select("partner_id,member_role,partners!inner(id,name,status,partner_type)")
    .eq("user_id", auth.user.id).in("member_role", ["owner", "manager", "operator"]);
  if (memberError || !members?.length) redirect("/");
  const active = (members as any[]).filter((m) =>
    m.partners?.status === "active" && m.partners?.partner_type === "professionnel_domicile"
  );
  const ids = active.map((m: any) => m.partner_id);
  if (!ids.length) redirect("/");

  const [offersResult, requestsResult] = await Promise.all([
    sb.from("home_service_offers").select("id,partner_id,name,category,description,service_area_label,price_fcfa,status,created_at")
      .in("partner_id", ids).order("created_at", { ascending: false }).limit(200),
    sb.from("home_service_requests").select("id,partner_id,offer_name,category,price_fcfa,service_area_label,preferred_at,client_note,status,created_at,confirmed_at")
      .in("partner_id", ids).order("created_at", { ascending: false }).limit(100),
  ]);
  const allOffers = offersResult.data ?? [];
  const allRequests = requestsResult.data ?? [];
  const query = (searchParams.q ?? "").trim().toLocaleLowerCase("fr");
  const offers = allOffers.filter((o: any) =>
    (!searchParams.statut_offre || o.status === searchParams.statut_offre) &&
    (!query || [o.name, o.category, o.description ?? "", o.service_area_label, active.find((m: any) => m.partner_id === o.partner_id)?.partners?.name ?? ""].join(" ").toLocaleLowerCase("fr").includes(query))
  );
  const requests = allRequests.filter((r: any) =>
    (!searchParams.statut_demande || r.status === searchParams.statut_demande) &&
    (!query || [r.offer_name, r.category, r.service_area_label, r.client_note ?? "", active.find((m: any) => m.partner_id === r.partner_id)?.partners?.name ?? ""].join(" ").toLocaleLowerCase("fr").includes(query))
  );
  const requestIds = requests.map((r: any) => r.id);
  const addressResult = requestIds.length
    ? await sb.from("home_service_request_addresses").select("request_id,exact_address,contact_phone").in("request_id", requestIds)
    : { data: [], error: null };
  const addresses = addressResult.data ?? [];
  const broken = !!(offersResult.error || requestsResult.error || addressResult.error);

  return <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-slate-900">
    <div className="mx-auto max-w-5xl space-y-5 pt-4">
      <header className="flex items-center justify-between gap-3 rounded-2xl bg-[#064B2A] px-4 py-3 text-white">
        <strong>NAXA · Espace partenaire</strong>
        <nav className="flex flex-wrap items-center gap-3 text-sm font-bold"><BoutonNotifications/><Link href="/partenaire/catalogue" className="underline">Catalogue</Link><Link href="/partenaire/reservations" className="underline">Réservations</Link><Link href="/" className="underline">Accueil</Link></nav>
      </header>
      <div><p className="text-xs font-extrabold uppercase tracking-widest text-[#B73623]">NAXA · Prestations à domicile</p><h1 className="mt-1 text-3xl font-black">Mes prestations et demandes</h1><p className="mt-2 text-sm leading-6 text-slate-600">Les nouvelles prestations restent en brouillon jusqu’à validation administrative. L’adresse exacte du client reste masquée tant que la demande n’est pas confirmée.</p></div>
      {searchParams.ok && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{searchParams.ok === "creation" ? "Prestation enregistrée en brouillon." : searchParams.ok === "archive" ? "Prestation archivée." : searchParams.ok === "confirmed" ? "Demande confirmée ; l’adresse et le téléphone sont maintenant accessibles." : "Demande marquée comme terminée."}</p>}
      {searchParams.erreur && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{searchParams.erreur === "univers" ? "L’univers Prestations doit être ouvert pour ce partenaire." : "Action impossible : vérifie les champs, les droits et le statut actuel."}</p>}
      {broken && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Une table de prestations n’est pas accessible. Vérifie la migration 112 dans l’environnement de test ; aucune écriture n’a été effectuée par cet affichage.</p>}

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-extrabold">Créer une prestation</h2>
        <p className="mt-1 text-sm text-slate-600">Indique la prestation et sa zone d’intervention. Laisse le tarif vide si le prix doit être confirmé avec le client.</p>
        <form action={createHomeServiceOffer} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Établissement partenaire<select name="partner_id" className={field} required>{active.map((m: any) => <option key={m.partner_id} value={m.partner_id}>{m.partners.name}</option>)}</select></label>
          <label className="text-sm font-semibold">Catégorie<input name="category" className={field} defaultValue="Autres" required minLength={2} maxLength={100}/></label>
          <label className="text-sm font-semibold sm:col-span-2">Nom de la prestation<input name="name" className={field} required minLength={2} maxLength={180}/></label>
          <label className="text-sm font-semibold">Zone d’intervention<input name="service_area_label" className={field} required minLength={2} maxLength={180} placeholder="Ex. Yaoundé et environs"/></label>
          <label className="text-sm font-semibold">Tarif fixe (FCFA, facultatif)<input name="price_fcfa" className={field} type="number" min="0" max="100000000" step="1" placeholder="Vide = à confirmer"/></label>
          <label className="text-sm font-semibold sm:col-span-2">Description<textarea name="description" className={field} maxLength={2000} rows={3}/></label>
          <button disabled={broken} className="min-h-11 rounded-xl bg-[#B73623] px-4 py-3 font-bold text-white disabled:opacity-40 sm:col-span-2">Enregistrer en brouillon</button>
        </form>
      </section>

      <form method="get" className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2" role="search" aria-label="Filtrer les prestations et demandes">
        <label className="text-sm font-semibold sm:col-span-2">Rechercher<input name="q" defaultValue={searchParams.q ?? ""} className={field} placeholder="Prestation, catégorie, zone ou précision…"/></label>
        <label className="text-sm font-semibold">Statut du catalogue<select name="statut_offre" defaultValue={searchParams.statut_offre ?? ""} className={field}><option value="">Tous les statuts</option><option value="draft">Brouillon</option><option value="active">Publié</option><option value="archived">Archivé</option></select></label>
        <label className="text-sm font-semibold">Statut des demandes<select name="statut_demande" defaultValue={searchParams.statut_demande ?? ""} className={field}><option value="">Tous les statuts</option><option value="requested">À confirmer</option><option value="confirmed">Confirmée</option><option value="completed">Terminée</option><option value="cancelled">Annulée</option><option value="expired">Expirée</option></select></label>
        <div className="flex gap-2 sm:col-span-2"><button className="min-h-11 rounded-xl bg-[#B73623] px-4 font-bold text-white">Filtrer</button><Link href="/partenaire/prestations" className="inline-flex min-h-11 items-center rounded-xl border px-4 font-bold">Réinitialiser</Link></div>
      </form>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold">Mon catalogue</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{offers.length} / {allOffers.length}</span></div>
        {!offers.length ? <p className="mt-3 text-sm text-slate-600">{allOffers.length ? "Aucune prestation ne correspond aux filtres." : "Aucune prestation enregistrée."}</p> : <div className="mt-4 space-y-3">{offers.map((o: any) => <article key={o.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{o.name}</h3><p className="mt-1 text-sm text-slate-600">{o.category} · {o.service_area_label}</p><p className="mt-1 text-sm font-semibold">{o.price_fcfa == null ? "Tarif à confirmer" : money(Number(o.price_fcfa))}</p><p className="mt-2 text-xs font-bold">{offerStatus[o.status] ?? o.status}</p></div>{o.status !== "archived" && <form action={archiveHomeServiceOffer}><input type="hidden" name="offer_id" value={o.id}/><button disabled={broken} className="min-h-10 rounded-lg border border-red-300 px-3 text-sm font-bold text-red-800 disabled:opacity-40">Archiver</button></form>}</div>{o.description && <p className="mt-3 text-sm leading-5 text-slate-600">{o.description}</p>}</article>)}</div>}
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold">Demandes reçues</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{requests.length} / {allRequests.length}</span></div>
        <p className="mt-1 text-sm text-slate-600">La zone approximative est visible dès la demande. L’adresse et le téléphone ne sont chargés que lorsque le statut est « Confirmée » ou « Terminée ».</p>
        {!requests.length ? <p className="mt-3 text-sm text-slate-600">{allRequests.length ? "Aucune demande ne correspond aux filtres." : "Aucune demande reçue."}</p> : <div className="mt-4 space-y-3">{requests.map((r: any) => {const address = addresses.find((a: any) => a.request_id === r.id);return <article key={r.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{r.offer_name}</h3><p className="mt-1 text-sm text-slate-600">{r.category} · {requestStatus[r.status] ?? r.status}</p><p className="mt-1 text-sm">Zone : <strong>{r.service_area_label}</strong></p><p className="mt-1 text-xs text-slate-500">Demande reçue le {new Date(r.created_at).toLocaleString("fr-FR")}</p>{r.preferred_at && <p className="mt-1 text-sm">Moment souhaité : {new Date(r.preferred_at).toLocaleString("fr-FR")}</p>}{r.price_fcfa == null ? <p className="mt-2 text-sm">Tarif à confirmer</p> : <p className="mt-2 text-sm font-bold">{money(Number(r.price_fcfa))}</p>}</div></div>
          {address ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-extrabold uppercase text-emerald-900">Coordonnées accessibles après confirmation</p><p className="mt-1 text-sm font-semibold">{address.exact_address}</p><p className="mt-1 text-sm">{address.contact_phone}</p></div> : <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Adresse exacte et téléphone masqués jusqu’à confirmation.</p>}
          {r.client_note && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-5">Précisions du client : {r.client_note}</p>}
          <div className="mt-3 flex flex-wrap gap-2">{r.status === "requested" && <form action={transitionHomeServiceRequest}><input type="hidden" name="request_id" value={r.id}/><input type="hidden" name="status" value="confirmed"/><button disabled={broken} className="min-h-10 rounded-lg bg-[#B73623] px-3 text-sm font-bold text-white disabled:opacity-40">Confirmer la demande</button></form>}{r.status === "confirmed" && <form action={transitionHomeServiceRequest}><input type="hidden" name="request_id" value={r.id}/><input type="hidden" name="status" value="completed"/><button disabled={broken} className="min-h-10 rounded-lg border px-3 text-sm font-bold disabled:opacity-40">Marquer terminée</button></form>}</div>
        </article>})}</div>}
      </section>
    </div>
  </main>;
}
