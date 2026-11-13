import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { archiveHomeServiceOffer, createHomeServiceOffer, transitionHomeServiceRequest, updateHomeServicePartnerLocation, resetHomeServicePartnerLocation } from "./actions";
import { BoutonNotifications } from "@/components/BoutonNotifications";
import { GeolocalisationChamps } from "@/components/admin/GeolocalisationChamps";
import { SuiviProfessionalAvailabilityEditor } from "@/components/suivi/SuiviProfessionalAvailabilityEditor";

const field = "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900";
const offerStatus: Record<string, string> = { draft: "Brouillon — en attente de validation", active: "Publié", archived: "Archivé" };
const requestStatus: Record<string, string> = { requested: "À confirmer", confirmed: "Rendez-vous confirmé", completed: "Terminée", cancelled: "Annulée", expired: "Expirée" };
const money = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value) + " FCFA";

function localDateTimeValue(value: string | null | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Douala", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year && values.month && values.day && values.hour && values.minute
    ? `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
    : "";
}

export default async function PartnerHomeServices({ searchParams }: { searchParams: { ok?: string; erreur?: string; q?: string; statut_demande?: string; statut_offre?: string } }) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/partenaire/prestations");
  const { data: members, error: memberError } = await sb.from("partner_members")
    .select("partner_id,member_role,partners!inner(id,name,status,partner_type,city,neighborhood,latitude,longitude,provider_latitude,provider_longitude,provider_location_updated_at)")
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
    sb.from("home_service_requests").select("id,partner_id,offer_name,category,price_fcfa,service_area_label,preferred_at,scheduled_at,client_note,status,created_at,confirmed_at")
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
  // Minimiser les coordonnées chargées : ne demander les données privées
  // que pour les demandes déjà confirmées ou terminées. La RLS reste la
  // frontière de sécurité ; ce filtre évite aussi les lectures inutiles.
  const addressEligibleIds = requests
    .filter((r: any) => r.status === "confirmed" || r.status === "completed")
    .map((r: any) => r.id);
  const addressResult = addressEligibleIds.length
    ? await (sb as any).from("home_service_request_addresses")
        .select("request_id,exact_address,contact_phone,latitude,longitude,accuracy_m,location_shared_at")
        .in("request_id", addressEligibleIds)
    : { data: [], error: null };
  const addresses = addressResult.data ?? [];
  const broken = !!(offersResult.error || requestsResult.error || addressResult.error);

  return <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-slate-900">
    <div className="mx-auto max-w-5xl space-y-5 pt-4">
      <header className="flex items-center justify-between gap-3 rounded-2xl bg-[#064B2A] px-4 py-3 text-white">
        <strong>NAXA · Espace partenaire</strong>
        <nav className="flex flex-wrap items-center gap-3 text-sm font-bold"><BoutonNotifications/><Link href="/promoteur/paiements" className="underline">Abonnement</Link><Link href="/partenaire/prestations/parametres" className="underline">Rappels</Link><Link href="/partenaire/catalogue" className="underline">Catalogue</Link><Link href="/partenaire/reservations" className="underline">Réservations</Link><Link href="/" className="underline">Accueil</Link></nav>
      </header>
      <div><p className="text-xs font-extrabold uppercase tracking-widest text-[#B73623]">NAXA · Prestations à domicile</p><h1 className="mt-1 text-3xl font-black">Mes prestations et demandes</h1><p className="mt-2 text-sm leading-6 text-slate-600">Les nouvelles prestations restent en brouillon jusqu’à validation administrative. Confirmer une demande signifie désormais retenir un créneau précis. L’adresse exacte du client reste masquée tant que la demande n’est pas confirmée.</p></div>
      {searchParams.ok && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{searchParams.ok === "position" ? "Votre position GPS prioritaire est enregistrée." : searchParams.ok === "position_reinitialisee" ? "La position administrative est de nouveau utilisée." : searchParams.ok === "creation" ? "Prestation enregistrée en brouillon." : searchParams.ok === "archive" ? "Prestation archivée." : searchParams.ok === "confirmed" ? "Rendez-vous confirmé et rappels programmables." : "Prestation marquée comme terminée."}</p>}
      {searchParams.erreur && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{searchParams.erreur === "univers" ? "L’univers Prestations doit être ouvert pour ce partenaire." : "Action impossible : vérifie les champs, les droits et le statut actuel."}</p>}
      {broken && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Le suivi des prestations est temporairement indisponible. Les actions sont désactivées jusqu’au retour des données.</p>}

      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-extrabold">Mon planning de disponibilité</h2>
        <p className="mt-1 text-sm text-slate-600">Ce planning alimente directement les filtres de disponibilité dans les recherches des clients et de l’assistance connectée.</p>
        <div className="mt-4"><SuiviProfessionalAvailabilityEditor userId={auth.user.id}/></div>
      </section>

      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-extrabold">Ma position de service</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Votre position déclarée ici est prioritaire sur la position de référence renseignée par l’administration. Vous pouvez la modifier à tout moment ou revenir à la position administrative.</p>
        <div className="mt-4 space-y-4">
          {active.map((membership:any)=>{
            const partner=membership.partners;
            const hasOwn=partner.provider_latitude!=null&&partner.provider_longitude!=null;
            const effectiveLat=hasOwn?partner.provider_latitude:partner.latitude;
            const effectiveLng=hasOwn?partner.provider_longitude:partner.longitude;
            return <article key={partner.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-extrabold">{partner.name}</h3><p className="mt-1 text-xs text-slate-500">{hasOwn?"Position professionnelle prioritaire":"Position administrative de référence"} · {[partner.neighborhood,partner.city].filter(Boolean).join(" · ")}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{effectiveLat!=null&&effectiveLng!=null?"Position renseignée":"Position à définir"}</span></div>
              {effectiveLat!=null&&effectiveLng!=null&&<p className="mt-2 text-sm text-slate-700">Coordonnées utilisées : {Number(effectiveLat).toFixed(6)} · {Number(effectiveLng).toFixed(6)}</p>}
              <form action={updateHomeServicePartnerLocation} className="mt-3 space-y-3">
                <input type="hidden" name="partner_id" value={partner.id}/>
                <p className="text-sm font-semibold">Définir ou mettre à jour ma position GPS</p>
                <GeolocalisationChamps className={field} initialLatitude={hasOwn?Number(partner.provider_latitude):null} initialLongitude={hasOwn?Number(partner.provider_longitude):null}/>
                <button disabled={broken} className="min-h-11 rounded-xl bg-[#064B2A] px-4 font-bold text-white disabled:opacity-40">Enregistrer ma position prioritaire</button>
              </form>
              {hasOwn&&<form action={resetHomeServicePartnerLocation} className="mt-2"><input type="hidden" name="partner_id" value={partner.id}/><button disabled={broken} className="min-h-10 rounded-lg border px-3 text-sm font-bold disabled:opacity-40">Revenir à la position administrateur</button></form>}
            </article>;
          })}
        </div>
      </section>


      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-extrabold">Mon planning de disponibilité</h2>
        <p className="mt-1 text-sm text-slate-600">Ce planning alimente directement les filtres de disponibilité dans les recherches des clients et de l’assistance connectée.</p>
        <div className="mt-4"><SuiviProfessionalAvailabilityEditor userId={auth.user.id}/></div>
      </section>

      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-extrabold">Ma position de service</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Votre position déclarée ici est prioritaire sur la position de référence renseignée par l’administration. Vous pouvez la modifier à tout moment ou revenir à la position administrative.</p>
        <div className="mt-4 space-y-4">
          {active.map((membership:any)=>{
            const partner=membership.partners;
            const hasOwn=partner.provider_latitude!=null&&partner.provider_longitude!=null;
            const effectiveLat=hasOwn?partner.provider_latitude:partner.latitude;
            const effectiveLng=hasOwn?partner.provider_longitude:partner.longitude;
            return <article key={partner.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-extrabold">{partner.name}</h3><p className="mt-1 text-xs text-slate-500">{hasOwn?"Position professionnelle prioritaire":"Position administrative de référence"} · {[partner.neighborhood,partner.city].filter(Boolean).join(" · ")}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{effectiveLat!=null&&effectiveLng!=null?"Position renseignée":"Position à définir"}</span></div>
              {effectiveLat!=null&&effectiveLng!=null&&<p className="mt-2 text-sm text-slate-700">Coordonnées utilisées : {Number(effectiveLat).toFixed(6)} · {Number(effectiveLng).toFixed(6)}</p>}
              <form action={updateHomeServicePartnerLocation} className="mt-3 space-y-3">
                <input type="hidden" name="partner_id" value={partner.id}/>
                <p className="text-sm font-semibold">Définir ou mettre à jour ma position GPS</p>
                <GeolocalisationChamps className={field} initialLatitude={hasOwn?Number(partner.provider_latitude):null} initialLongitude={hasOwn?Number(partner.provider_longitude):null}/>
                <button disabled={broken} className="min-h-11 rounded-xl bg-[#064B2A] px-4 font-bold text-white disabled:opacity-40">Enregistrer ma position prioritaire</button>
              </form>
              {hasOwn&&<form action={resetHomeServicePartnerLocation} className="mt-2"><input type="hidden" name="partner_id" value={partner.id}/><button disabled={broken} className="min-h-10 rounded-lg border px-3 text-sm font-bold disabled:opacity-40">Revenir à la position administrateur</button></form>}
            </article>;
          })}
        </div>
      </section>

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
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold">Mon catalogue</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{broken ? "Lecture partielle" : `${offers.length} / ${allOffers.length}`}</span></div>
        {!broken && !offers.length ? <p className="mt-3 text-sm text-slate-600">{allOffers.length ? "Aucune prestation ne correspond aux filtres." : "Aucune prestation enregistrée."}</p> : offers.length ? <div className="mt-4 space-y-3">{offers.map((o: any) => <article key={o.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{o.name}</h3><p className="mt-1 text-sm text-slate-600">{o.category} · {o.service_area_label}</p><p className="mt-1 text-sm font-semibold">{o.price_fcfa == null ? "Tarif à confirmer" : money(Number(o.price_fcfa))}</p><p className="mt-2 text-xs font-bold">{offerStatus[o.status] ?? o.status}</p></div>{o.status !== "archived" && <form action={archiveHomeServiceOffer}><input type="hidden" name="offer_id" value={o.id}/><button disabled={broken} className="min-h-10 rounded-lg border border-red-300 px-3 text-sm font-bold text-red-800 disabled:opacity-40">Archiver</button></form>}</div>{o.description && <p className="mt-3 text-sm leading-5 text-slate-600">{o.description}</p>}</article>)}</div> : null}
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold">Demandes et rendez-vous</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{broken ? "Lecture partielle" : `${requests.length} / ${allRequests.length}`}</span></div>
        <p className="mt-1 text-sm text-slate-600">La date souhaitée par le client n’est qu’une proposition. Le rendez-vous n’est confirmé qu’après sélection du créneau réel par le professionnel. L’adresse et le téléphone restent protégés jusqu’à confirmation.</p>
        {!broken && !requests.length ? <p className="mt-3 text-sm text-slate-600">{allRequests.length ? "Aucune demande ne correspond aux filtres." : "Aucune demande reçue."}</p> : requests.length ? <div className="mt-4 space-y-3">{requests.map((r: any) => {const address = addresses.find((a: any) => a.request_id === r.id);return <article key={r.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{r.offer_name}</h3><p className="mt-1 text-sm text-slate-600">{r.category} · {requestStatus[r.status] ?? r.status}</p><p className="mt-1 text-sm">Zone : <strong>{r.service_area_label}</strong></p><p className="mt-1 text-xs text-slate-500">Demande reçue le {new Date(r.created_at).toLocaleString("fr-FR")}</p>{r.preferred_at && <p className="mt-1 text-sm">Préférence client : {new Date(r.preferred_at).toLocaleString("fr-FR", {timeZone:"Africa/Douala"})}</p>}{r.scheduled_at && <p className="mt-1 text-sm font-bold text-emerald-800">Rendez-vous retenu : {new Date(r.scheduled_at).toLocaleString("fr-FR", {timeZone:"Africa/Douala"})}</p>}{r.price_fcfa == null ? <p className="mt-2 text-sm">Tarif à confirmer</p> : <p className="mt-2 text-sm font-bold">{money(Number(r.price_fcfa))}</p>}</div></div>
          {address ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-extrabold uppercase text-emerald-900">Coordonnées accessibles après confirmation</p><p className="mt-1 text-sm font-semibold">{address.exact_address}</p><p className="mt-1 text-sm">{address.contact_phone}</p>
            {address.location_shared_at && address.latitude != null && address.longitude != null && <div className="mt-2 border-t border-emerald-200 pt-2"><p className="text-xs font-bold text-emerald-900">Position GPS partagée volontairement par le client</p><p className="mt-1 text-xs text-emerald-800">Précision déclarée : {Math.round(Number(address.accuracy_m ?? 0))} m</p><a className="mt-2 inline-flex min-h-10 items-center rounded-lg bg-emerald-800 px-3 text-sm font-bold text-white underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(address.latitude)+","+String(address.longitude))}`} target="_blank" rel="noreferrer">Ouvrir la position sur la carte</a></div>}
          </div> : <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Adresse exacte et téléphone masqués jusqu’à confirmation.</p>}
          {r.client_note && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-5">Précisions du client : {r.client_note}</p>}
          <div className="mt-3 flex flex-wrap gap-2">{r.status === "requested" && <form action={transitionHomeServiceRequest} className="w-full space-y-2"><input type="hidden" name="request_id" value={r.id}/><input type="hidden" name="status" value="confirmed"/><label className="block text-sm font-semibold">Choisir le rendez-vous confirmé (heure de Yaoundé)<input name="scheduled_at" className={field} type="datetime-local" required min={localDateTimeValue(new Date(Date.now()+5*60_000).toISOString())} defaultValue={localDateTimeValue(r.preferred_at)}/></label><button disabled={broken} className="min-h-10 rounded-lg bg-[#B73623] px-3 text-sm font-bold text-white disabled:opacity-40">Confirmer le rendez-vous</button></form>}{r.status === "confirmed" && <form action={transitionHomeServiceRequest}><input type="hidden" name="request_id" value={r.id}/><input type="hidden" name="status" value="completed"/><button disabled={broken} className="min-h-10 rounded-lg border px-3 text-sm font-bold disabled:opacity-40">Marquer terminée</button></form>}</div>
        </article>})}</div> : null}
      </section>
    </div>
  </main>;
}
