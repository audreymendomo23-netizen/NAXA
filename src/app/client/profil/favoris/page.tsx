"use client";

import Image from "next/image";
import { IllustrationPageClient } from "@/components/IllustrationPageClient";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconeNAXA } from "@/components/IconeNAXA";
import { notifierNAXA } from "@/components/NotificationGlobale";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ecouterFavoris, ecrireFavoris, lireFavoris, synchroniserFavorisCompte, type FavoriNAXA } from "@/lib/favoris-client";

type Proposition = { id: string; reservation_id: string; produit_id: string; produit_nom: string; dosage: string | null; prix: number; created_at: string };
type Rappel = { id: string; produit_ref: string; produit_nom: string; reminder_date: string; source: string; notified_at: string | null };

function dateLocaleISO() {
  const now = new Date();
  const annee = now.getFullYear();
  const mois = String(now.getMonth() + 1).padStart(2, "0");
  const jour = String(now.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

function messageErreurSupabase(message: string, code?: string) {
  if (code === "42P01" || code === "PGRST205" || /naxa_favoris_rappels|schema cache|does not exist/i.test(message)) {
    return "Le module de rappels n’est pas encore activé dans Supabase : la migration de favoris et rappels doit être appliquée.";
  }
  if (code === "42501" || /row-level security|permission denied/i.test(message)) {
    return "Supabase a refusé l’enregistrement. Vérifiez la session du compte et les autorisations RLS.";
  }
  if (code === "23514" || /check constraint/i.test(message)) {
    return "Les données du rappel ne respectent pas les règles de validation. Vérifiez la date choisie.";
  }
  return `Enregistrement impossible : ${message || "erreur Supabase non détaillée"}`;
}

function Visuel({ item }: { item: FavoriNAXA }) {
  if (item.photo_url) return <Image src={item.photo_url} alt={item.nom} width={100} height={100} unoptimized className="h-24 w-full object-contain" />;
  return <div className="flex h-24 items-center justify-center rounded-2xl bg-[#E6F2EB]" aria-hidden="true"><IconeNAXA name="pill" size={36} /></div>;
}

const dateAffichee = (v: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(v + "T12:00:00"));

export default function FavorisClientPage() {
  const [favoris, setFavoris] = useState<FavoriNAXA[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [propositions, setPropositions] = useState<Proposition[]>([]);
  const [rappels, setRappels] = useState<Rappel[]>([]);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<"tous" | "medicaments">("tous");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState<string | null>(null);

  const allerA = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const charger = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError) setErreur("Impossible de vérifier la session. Reconnectez-vous puis réessayez.");
    setUserId(user?.id ?? null);
    if (!user) {
      setPropositions([]);
      setRappels([]);
      return;
    }

    const [p, r] = await Promise.all([
      sb.from("naxa_achat_suivi_propositions").select("id,reservation_id,produit_id,produit_nom,dosage,prix,created_at").eq("user_id", user.id).eq("statut", "en_attente").order("created_at", { ascending: false }).limit(20),
      sb.from("naxa_favoris_rappels").select("id,produit_ref,produit_nom,reminder_date,source,notified_at").eq("user_id", user.id).eq("actif", true).order("reminder_date", { ascending: true }).limit(50)
    ]);
    if (p.error) {
      setErreur(messageErreurSupabase(p.error.message, p.error.code));
      setPropositions([]);
    } else setPropositions((p.data ?? []) as Proposition[]);
    if (r.error) {
      setErreur(messageErreurSupabase(r.error.message, r.error.code));
      setRappels([]);
    } else setRappels((r.data ?? []) as Rappel[]);
  }, []);

  useEffect(() => {
    let actif = true;
    setFavoris(lireFavoris());
    void (async () => {
      try {
        const result = await synchroniserFavorisCompte();
        if (actif) setFavoris(result);
        await charger();
      } catch {
        if (actif) setErreur("Synchronisation temporairement indisponible. Réessayez dans un instant.");
      } finally {
        if (actif) setChargement(false);
      }
    })();
    const stop = ecouterFavoris(() => setFavoris(lireFavoris()));
    return () => { actif = false; stop(); };
  }, [charger]);

  const visibles = useMemo(() => favoris.filter(f =>
    (f.nom + " " + f.dosage + " " + f.pharmacie).toLocaleLowerCase("fr").includes(recherche.trim().toLocaleLowerCase("fr")) &&
    (filtre === "tous" || !f.demo)
  ), [favoris, recherche, filtre]);

  const retirer = (id: string, nom: string) => {
    ecrireFavoris(favoris.filter(f => f.id !== id));
    setFavoris(lireFavoris());
    notifierNAXA(nom + " a été retiré de vos favoris.");
  };

  const accepter = async (p: Proposition) => {
    if (!userId) { setErreur("Connectez-vous pour enregistrer ce favori."); return; }
    setEnCours(p.id);
    setErreur("");
    try {
      const { error } = await supabaseBrowser().rpc("accepter_proposition_favori", { p_proposition: p.id, p_date_rappel: dates[p.id] || null });
      if (error) { setErreur(messageErreurSupabase(error.message, error.code)); return; }
      setFavoris(await synchroniserFavorisCompte());
      await charger();
      notifierNAXA(dates[p.id] ? "Favori enregistré et rappel programmé." : "Médicament ajouté aux favoris.");
    } catch {
      setErreur("La connexion a été interrompue. Le résultat n’a pas pu être confirmé.");
    } finally {
      setEnCours(null);
    }
  };

  const ignorer = async (id: string) => {
    setErreur("");
    const { error } = await supabaseBrowser().from("naxa_achat_suivi_propositions").update({ statut: "ignoree", resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) setErreur(messageErreurSupabase(error.message, error.code));
    else await charger();
  };

  const programmer = async (item: FavoriNAXA) => {
    setErreur("");
    if (!userId) { setErreur("Connectez-vous pour enregistrer un rappel et le retrouver sur vos appareils."); return; }
    const date = dates[item.id];
    if (!date) { setErreur("Choisissez d’abord la date à laquelle vous souhaitez être rappelé."); return; }
    if (date < dateLocaleISO()) { setErreur("La date du rappel doit être aujourd’hui ou une date future."); return; }

    setEnCours(item.id);
    try {
      const { error } = await supabaseBrowser().from("naxa_favoris_rappels").insert({
        user_id: userId,
        produit_ref: item.id,
        produit_nom: item.nom,
        reminder_date: date,
        mode: "renouvellement",
        source: "manuel",
        actif: true,
        consent_at: new Date().toISOString()
      });
      if (error) { setErreur(messageErreurSupabase(error.message, error.code)); return; }
      setDates(s => ({ ...s, [item.id]: "" }));
      await charger();
      notifierNAXA("Rappel programmé.");
    } catch {
      setErreur("La connexion a été interrompue. Vérifiez vos rappels avant de réessayer.");
    } finally {
      setEnCours(null);
    }
  };

  const desactiver = async (id: string) => {
    setErreur("");
    const { error } = await supabaseBrowser().from("naxa_favoris_rappels").update({ actif: false, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) setErreur(messageErreurSupabase(error.message, error.code));
    else await charger();
  };

  return (
    <main className="min-h-dvh bg-[#F4F8F5] px-4 pt-3 pb-[calc(112px+env(safe-area-inset-bottom,0px))] text-[#0B3D26]">
      <IllustrationPageClient src="/couvertures/favoris.webp" alt="Illustration des favoris" titre="Mes favoris" />
      <section className="mx-auto max-w-[480px] space-y-4">
        <header className="flex items-center justify-between rounded-2xl border border-[#D6A928] bg-[#F4C542] px-4 py-3 shadow-sm">
          <div>
            <h1 className="text-lg font-extrabold">Mes favoris <span className="text-[#DC2626]" aria-hidden="true">♥</span></h1>
            <p className="text-xs font-medium text-[#503B00]">Retrouve tes produits et programme tes rappels.</p>
          </div>
          <span className="rounded-full bg-white/70 px-3 py-1 text-sm font-extrabold">{favoris.length}</span>
        </header>

        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => allerA("liste-favoris")} aria-label="Afficher mes favoris" className="min-w-0 rounded-xl border border-[#E58A18] bg-[#FFB347] p-3 text-left shadow-sm transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3D26]">
            <IconeNAXA name="heart" size={20} filled />
            <p className="mt-1 text-xl font-extrabold">{favoris.length}</p>
            <p className="text-[11px] font-bold leading-tight">Favoris</p>
            <p className="mt-1 text-[10px]">Voir la liste</p>
          </button>
          <button type="button" onClick={() => allerA("liste-rappels")} aria-label="Afficher mes rappels actifs" className="min-w-0 rounded-xl border border-[#3985C8] bg-[#8CCBFF] p-3 text-left shadow-sm transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3D26]">
            <IconeNAXA name="clock" size={20} />
            <p className="mt-1 text-xl font-extrabold">{rappels.length}</p>
            <p className="text-[11px] font-bold leading-tight">Rappels actifs</p>
            <p className="mt-1 text-[10px]">Voir les dates</p>
          </button>
          <button type="button" onClick={() => allerA("liste-achats")} aria-label="Afficher mes achats à suivre" className="min-w-0 rounded-xl border border-[#D8B900] bg-[#FFE23D] p-3 text-left shadow-sm transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3D26]">
            <IconeNAXA name="shopping-cart" size={20} />
            <p className="mt-1 text-xl font-extrabold">{propositions.length}</p>
            <p className="text-[11px] font-bold leading-tight">Achats à suivre</p>
            <p className="mt-1 text-[10px]">Voir les achats</p>
          </button>
        </div>

        {erreur && <p role="alert" className="whitespace-pre-line rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erreur}</p>}

        <section id="liste-achats" className="scroll-mt-4 rounded-2xl bg-[#0B3D26] p-4 text-white shadow-sm">
          <h2 className="flex items-center gap-2 font-extrabold"><IconeNAXA name="bell" size={21} /> Achats à suivre</h2>
          <p className="mt-2 text-sm text-[#DCE9DF]">Après un achat confirmé, choisissez si vous souhaitez ajouter le produit aux favoris et programmer un rappel. Aucun rappel sans votre accord.</p>
          {propositions.length ? <div className="mt-3 space-y-3">{propositions.map(p => (
            <article key={p.id} className="rounded-xl bg-white p-3 text-[#0B3D26]">
              <p className="font-bold">{p.produit_nom}</p>
              {p.dosage && <p className="text-xs text-[#64776B]">{p.dosage}</p>}
              <label className="mt-3 block text-xs font-semibold">Date facultative du rappel de réachat
                <input type="date" min={dateLocaleISO()} value={dates[p.id] ?? ""} onChange={e => setDates(s => ({ ...s, [p.id]: e.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-[#D8E5DC] px-3 text-sm" />
              </label>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={enCours === p.id} onClick={() => void accepter(p)} className="min-h-10 flex-1 rounded-xl bg-[#FFE23D] px-3 text-xs font-extrabold disabled:opacity-50">{enCours === p.id ? "Enregistrement…" : "Ajouter aux favoris"}</button>
                <button type="button" onClick={() => void ignorer(p.id)} className="min-h-10 rounded-xl border border-[#D8E5DC] px-3 text-xs font-bold">Pas maintenant</button>
              </div>
            </article>
          ))}</div> : <p className="mt-3 rounded-xl bg-white/10 p-3 text-sm text-[#DCE9DF]">Aucun achat en attente de suivi.</p>}
        </section>

        <section id="liste-rappels" className="scroll-mt-4 rounded-2xl border border-[#D8E5DC] bg-white p-4">
          <h2 className="flex items-center gap-2 font-extrabold"><IconeNAXA name="clock" size={20} /> Vos rappels actifs</h2>
          <p className="mt-1 text-xs text-[#64776B]">Un rappel aide à retrouver le produit; il ne recommande pas de prolonger un traitement.</p>
          {rappels.length ? <ul className="mt-3 space-y-2">{rappels.map(r => (
            <li key={r.id} className="flex items-center gap-2 rounded-xl bg-[#F4F8F5] p-3">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{r.produit_nom}</p><p className="text-xs text-[#64776B]">{dateAffichee(r.reminder_date)} · {r.source === "achat_caisse" ? "Achat confirmé en caisse" : "Programmé manuellement"}</p></div>
              <button type="button" onClick={() => void desactiver(r.id)} className="px-2 py-2 text-xs font-bold text-[#B91C1C]">Désactiver</button>
            </li>
          ))}</ul> : <p className="mt-3 rounded-xl bg-[#F4F8F5] p-3 text-sm text-[#64776B]">Aucun rappel actif pour le moment.</p>}
        </section>

        <section id="liste-favoris" className="scroll-mt-4 space-y-3">
          <div className="rounded-2xl border border-[#D8E5DC] bg-white p-3 shadow-sm">
            <label className="flex items-center gap-2 rounded-xl border border-[#D8E5DC] px-3"><IconeNAXA name="search" size={19} /><input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher dans mes favoris…" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setFiltre("tous")} className={`rounded-full px-4 py-2 text-xs font-extrabold ${filtre === "tous" ? "bg-[#0F6B3F] text-white" : "bg-[#F4F8F5]"}`}>Tous</button>
              <button type="button" onClick={() => setFiltre("medicaments")} className={`rounded-full px-4 py-2 text-xs font-extrabold ${filtre === "medicaments" ? "bg-[#0F6B3F] text-white" : "bg-[#F4F8F5]"}`}>Médicaments</button>
            </div>
          </div>

          {chargement ? <div className="rounded-2xl bg-white p-6 text-center text-sm text-[#64776B]">Synchronisation de vos favoris…</div> : visibles.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#B9D2C2] bg-white px-6 py-10 text-center shadow-sm">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FCE7F3] text-[#DC2626]"><IconeNAXA name="heart" size={28} /></span>
              <h2 className="mt-4 text-lg font-extrabold">{favoris.length ? "Aucun résultat" : "Votre liste est encore vide"}</h2>
              <p className="mx-auto mt-2 max-w-xs text-sm text-[#64776B]">{favoris.length ? "Essayez un autre terme." : "Touchez le cœur rouge d’un médicament pour le retrouver ici."}</p>
              <Link href="/" className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#FFE23D] px-5 text-sm font-extrabold"><IconeNAXA name="search" size={17} /> Découvrir les médicaments</Link>
            </div>
          ) : <div className="grid grid-cols-2 gap-3">{visibles.map((item, i) => (
            <article key={item.id} style={{ animationDelay: `${Math.min(i * 50, 250)}ms` }} className="relative flex min-w-0 flex-col rounded-[20px] bg-white p-3 shadow-sm">
              <Link href={item.demo ? "/resultats?q=" + encodeURIComponent(item.nom) : "/produit/" + encodeURIComponent(item.id)} className="flex min-h-24 items-center justify-center rounded-2xl"><Visuel item={item} /></Link>
              <button type="button" onClick={() => retirer(item.id, item.nom)} aria-label={`Retirer ${item.nom} des favoris`} className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full border border-[#F3C2C8] bg-white text-[#DC2626]"><IconeNAXA name="heart" size={19} filled /></button>
              {item.demo && <span className="mt-2 text-[11px] font-extrabold text-[#8A6D00]">Exemple local</span>}
              <h2 className="mt-2 line-clamp-2 min-h-10 text-sm font-extrabold">{item.nom}</h2>
              <p className="mt-1 text-xs text-[#64776B]">{item.dosage || "Dosage non précisé"}</p>
              <p className="mt-2 text-base font-extrabold">{item.prix > 0 ? new Intl.NumberFormat("fr-FR").format(item.prix) + " FCFA" : "Prix à confirmer"}</p>
              <p className="mt-1 min-h-8 text-[11px] text-[#64776B]">{item.pharmacie || "Disponibilité à confirmer"}</p>
              <label className="mt-3 block text-[11px] font-bold">Programmer un rappel de réachat
                <input type="date" min={dateLocaleISO()} value={dates[item.id] ?? ""} onChange={e => setDates(s => ({ ...s, [item.id]: e.target.value }))} className="mt-1 min-h-10 w-full rounded-xl border border-[#D8E5DC] px-2 text-xs" />
              </label>
              <button type="button" disabled={enCours === item.id || item.demo} onClick={() => void programmer(item)} className="mt-2 flex min-h-10 items-center justify-center gap-1 rounded-xl bg-[#FFF3B0] px-2 text-xs font-extrabold disabled:opacity-50"><IconeNAXA name="clock" size={15} />{enCours === item.id ? "Enregistrement…" : "Programmer le rappel"}</button>
              <div className="mt-auto flex gap-2 pt-3">
                <Link href={item.demo ? "/resultats?q=" + encodeURIComponent(item.nom) : "/produit/" + encodeURIComponent(item.id)} className="flex min-h-10 flex-1 items-center justify-center rounded-xl bg-[#FFE23D] px-2 text-xs font-extrabold">Voir le produit</Link>
                <button type="button" onClick={() => retirer(item.id, item.nom)} aria-label={`Supprimer ${item.nom}`} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F4F8F5] text-[#B91C1C]"><IconeNAXA name="trash" size={17} /></button>
              </div>
            </article>
          ))}</div>}
        </section>

        {!userId ? <p className="rounded-xl border border-[#D8E5DC] bg-white p-3 text-xs text-[#64776B]">Vos favoris restent sur cet appareil. Connectez-vous pour synchroniser les favoris et programmer des rappels entre appareils.</p> : <p className="text-center text-[11px] text-[#64776B]">Les prix et stocks sont à confirmer au moment de la réservation.</p>}
      </section>
    </main>
  );
}
