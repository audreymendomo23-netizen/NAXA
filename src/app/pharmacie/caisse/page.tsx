"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";

type Produit = {
  produit_id: string;
  nom: string;
  dosage: string | null;
  prix: number;
  quantite: number;
  emplacement: string | null;
  code_barre: string | null;
};
type Ligne = Produit & { q: number; total: number };
type Caisse = { id: string; nom: string };
type Session = { id: string; caisse_id: string; fond_initial: number; ouvert_at: string };
type TicketLigne = {
  vente_id: string;
  numero_vente: string;
  pharmacie_id: string;
  statut: string;
  created_at: string;
  paid_at: string | null;
  total_brut: number;
  remise: number;
  total_net: number;
  mode_paiement: string | null;
  paiement_ref: string | null;
  produit_id: string | null;
  produit_nom: string | null;
  produit_dosage: string | null;
  quantite: number | null;
  prix_unitaire: number | null;
  total_ligne: number | null;
};

export default function CaissePage() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [pid, setPid] = useState<string | null>(null);
  const [pharmacie, setPharmacie] = useState("");
  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [caisseId, setCaisseId] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [fondInitial, setFondInitial] = useState("0");
  const [totalCompte, setTotalCompte] = useState("");
  const [cloture, setCloture] = useState<{ total_theorique: number; total_compte: number; ecart: number } | null>(null);
  const [vente, setVente] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<"caisse" | "recherche">("caisse");
  const [scan, setScan] = useState("");
  const [recherche, setRecherche] = useState("");
  const [bulk, setBulk] = useState("");
  const [resultats, setResultats] = useState<Produit[]>([]);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [percu, setPercu] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState<TicketLigne[] | null>(null);

  const chargerVenteBrouillon = useCallback(async (sessionId: string, userId: string) => {
    const { data: draft, error } = await sb.from("ventes")
      .select("id")
      .eq("caisse_session_id", sessionId)
      .eq("created_by", userId)
      .eq("statut", "brouillon")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      setMsg("Impossible de reprendre le panier en cours. Aucune nouvelle vente n’a été créée.");
      return;
    }
    if (!draft) {
      setVente(null);
      setLignes([]);
      return;
    }
    const { data: rows, error: linesError } = await sb.from("vente_lignes")
      .select("produit_id,quantite,prix_unitaire,total_ligne,produits(nom,dosage,code_barre)")
      .eq("vente_id", draft.id);
    if (linesError) {
      setMsg("Le panier existe mais ses lignes n’ont pas pu être chargées. Ne créez pas un second panier.");
      return;
    }
    const groups = new Map<string, Ligne>();
    for (const raw of rows ?? []) {
      const row = raw as unknown as {
        produit_id: string; quantite: number; prix_unitaire: number; total_ligne: number;
        produits: { nom: string; dosage: string | null; code_barre: string | null } | null;
      };
      const existing = groups.get(row.produit_id);
      if (existing) {
        existing.q += row.quantite;
        existing.total += row.total_ligne;
        existing.prix = existing.q > 0 ? Math.round(existing.total / existing.q) : row.prix_unitaire;
      } else {
        groups.set(row.produit_id, {
          produit_id: row.produit_id,
          nom: row.produits?.nom ?? "Produit",
          dosage: row.produits?.dosage ?? null,
          prix: row.prix_unitaire,
          quantite: 0,
          emplacement: null,
          code_barre: row.produits?.code_barre ?? null,
          q: row.quantite,
          total: row.total_ligne,
        });
      }
    }
    setVente(draft.id);
    setLignes([...groups.values()]);
    setMsg("Panier en cours repris. Le stock avait déjà été réservé par la base de données.");
  }, [sb]);

  const chargerSession = useCallback(async (id: string, userId: string) => {
    setCloture(null);
    setTicket(null);
    const { data, error } = await sb.from("caisses_sessions")
      .select("id,caisse_id,fond_initial,ouvert_at")
      .eq("caisse_id", id)
      .eq("statut", "ouverte")
      .maybeSingle();
    if (error) {
      setMsg("Impossible de vérifier la session de caisse.");
      return;
    }
    if (!data) {
      setSession(null);
      setVente(null);
      setLignes([]);
      return;
    }
    setSession(data as Session);
    await chargerVenteBrouillon(data.id, userId);
  }, [chargerVenteBrouillon, sb]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) {
        if (!cancelled) {
          setMsg("Connexion requise pour accéder à la Caisse.");
          setLoading(false);
        }
        return;
      }
      const { data: profile, error: profileError } = await sb.from("profiles")
        .select("role,fonction_interne,pharmacie_id,actif")
        .eq("id", auth.user.id)
        .maybeSingle();
      const isCashier = profile?.role === "caisse" || profile?.fonction_interne === "caisse";
      if (profileError || !profile || profile.actif !== true || !isCashier || !profile.pharmacie_id) {
        if (!cancelled) {
          setMsg("Accès refusé : cette page est réservée à un compte Caisse actif, rattaché à une pharmacie.");
          setLoading(false);
        }
        return;
      }
      const { data: pharmacy, error: pharmacyError } = await sb.from("pharmacies")
        .select("id,nom,actif,visible_recherche")
        .eq("id", profile.pharmacie_id)
        .maybeSingle();
      if (pharmacyError || !pharmacy || pharmacy.actif !== true || pharmacy.visible_recherche !== true) {
        if (!cancelled) {
          setMsg("La pharmacie est inactive ou non publiée. L’encaissement reste fermé.");
          setLoading(false);
        }
        return;
      }
      const { data: registerRows, error: registersError } = await sb.from("caisses")
        .select("id,nom")
        .eq("pharmacie_id", pharmacy.id)
        .eq("actif", true)
        .order("created_at", { ascending: true });
      if (registersError || !registerRows?.length) {
        if (!cancelled) {
          setMsg("Aucune caisse active n’est configurée pour cette pharmacie.");
          setLoading(false);
        }
        return;
      }
      if (cancelled) return;
      setUid(auth.user.id);
      setPid(pharmacy.id);
      setPharmacie(pharmacy.nom ?? "Pharmacie");
      setCaisses(registerRows as Caisse[]);
      setCaisseId(registerRows[0].id);
      setReady(true);
      await chargerSession(registerRows[0].id, auth.user.id);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [chargerSession, sb]);

  const total = useMemo(() => lignes.reduce((sum, line) => sum + line.total, 0), [lignes]);
  const rendu = Math.max((Number(percu) || 0) - total, 0);

  async function changerCaisse(id: string) {
    if (!uid || !id || busy) return;
    setCaisseId(id);
    setMsg("");
    setVente(null);
    setLignes([]);
    await chargerSession(id, uid);
  }

  async function ouvrirSession() {
    if (!caisseId || !uid) return;
    const amount = Number(fondInitial);
    if (!Number.isSafeInteger(amount) || amount < 0) return setMsg("Le fond initial doit être un montant entier positif ou nul.");
    setBusy(true);
    try {
      const { data, error } = await sb.rpc("caisse_ouvrir", { p_caisse: caisseId, p_fond_initial: amount });
      if (error) throw error;
      await chargerSession(caisseId, uid);
      setMsg("Session ouverte. Le fond initial est enregistré ; créez une vente lorsque vous êtes prêt.");
      if (!data) setMsg("La session a été ouverte, mais son identifiant n’a pas été renvoyé. Rechargez la page avant toute opération.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ouverture de session impossible. Une session peut déjà être ouverte.");
      await chargerSession(caisseId, uid);
    } finally {
      setBusy(false);
    }
  }

  async function nouvelleVente() {
    if (!session || !uid || busy) return;
    if (vente) return setMsg("Un panier est déjà ouvert. Finalisez-le ou abandonnez-le avant d’en créer un autre.");
    setBusy(true);
    const { data, error } = await sb.rpc("vente_creer", { p_session: session.id });
    setBusy(false);
    if (error || !data) return setMsg(error?.message ?? "Impossible de créer la vente.");
    setVente(data as string);
    setLignes([]);
    setTicket(null);
    setMsg("Nouvelle vente créée.");
  }

  async function lookup(code?: string) {
    if (!pid) return;
    const q = code?.trim() || recherche.trim();
    if (!q) return setMsg("Saisissez un nom, une référence ou un code-barres.");
    const { data, error } = await sb.rpc("caisse_rechercher_produit", {
      p_pharmacie: pid, p_code_barre: code?.trim() || null, p_recherche: code ? null : q,
    });
    if (error) return setMsg("Recherche impossible dans cette pharmacie.");
    setResultats((data ?? []) as Produit[]);
    if (!data?.length) setMsg("Aucun produit trouvé dans le stock de cette pharmacie.");
  }

  async function lookupBulk() {
    if (!pid) return;
    const codes = bulk.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean).slice(0, 100);
    if (!codes.length) return setMsg("Saisissez au moins un code-barres.");
    if (codes.length === 100) setMsg("Recherche limitée à 100 codes-barres par lot.");
    const { data, error } = await sb.rpc("caisse_rechercher_codes", { p_pharmacie: pid, p_codes: codes });
    if (error) return setMsg("La recherche de codes-barres a échoué.");
    setResultats((data ?? []) as Produit[]);
    setMsg((data?.length ?? 0) + " produit(s) trouvé(s).");
  }

  async function ajouter(produit: Produit) {
    if (!vente || busy) return setMsg("Ouvrez une session puis créez une vente avant d’ajouter un produit.");
    setBusy(true);
    const { error } = await sb.rpc("vente_ajouter_produit", {
      p_vente: vente, p_produit: produit.produit_id, p_quantite: 1,
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setLignes((current) => {
      const old = current.find((line) => line.produit_id === produit.produit_id);
      if (old) return current.map((line) => line.produit_id === produit.produit_id
        ? { ...line, q: line.q + 1, total: line.total + produit.prix, prix: Math.round((line.total + produit.prix) / (line.q + 1)) }
        : line);
      return [...current, { ...produit, q: 1, total: produit.prix }];
    });
    setResultats([]);
    setScan("");
    setMsg(produit.nom + " ajouté au panier.");
  }

  async function scanner(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const code = scan.trim();
    if (!code) return;
    if (!vente) return setMsg("Créez une vente avant de scanner un produit.");
    const { data, error } = await sb.rpc("caisse_rechercher_produit", {
      p_pharmacie: pid, p_code_barre: code, p_recherche: null,
    });
    if (error || !data?.length) {
      setMsg("Code-barres introuvable dans cette pharmacie ou produit indisponible.");
      return;
    }
    await ajouter(data[0] as Produit);
  }

  async function abandonnerVente() {
    if (!vente || busy) return;
    if (!window.confirm("Abandonner ce panier ? Les quantités réservées seront restituées au stock.")) return;
    setBusy(true);
    const { error } = await sb.rpc("vente_brouillon_abandonner", { p_vente: vente });
    setBusy(false);
    if (error) return setMsg(error.message);
    setVente(null);
    setLignes([]);
    setPercu("");
    setMsg("Panier abandonné ; le stock a été restitué.");
  }

  async function payer() {
    if (!vente || total <= 0) return setMsg("Ajoutez au moins un produit à la vente.");
    const montant = Number(percu);
    if (!Number.isSafeInteger(montant) || montant <= 0) return setMsg("Indiquez le montant espèces reçu en FCFA.");
    if (montant < total) return setMsg("Montant reçu insuffisant.");
    if (busy) return;
    setBusy(true);
    try {
      const { data: payment, error: paymentError } = await sb.rpc("vente_encaisser", {
        p_vente: vente, p_mode: "especes", p_montant_percu: montant, p_reference: null,
      });
      if (paymentError) throw paymentError;
      const { error: finalizeError } = await sb.rpc("vente_finaliser", { p_vente: vente });
      if (finalizeError) throw finalizeError;
      const { data: receipt, error: receiptError } = await sb.rpc("vente_ticket", { p_vente: vente });
      if (receiptError) throw receiptError;
      setTicket((receipt ?? []) as TicketLigne[]);
      setMsg("Vente encaissée en espèces. Vérifiez le ticket avant impression. Monnaie à rendre : " + fcfa(payment?.[0]?.monnaie_rendue ?? 0) + ".");
      setVente(null);
      setLignes([]);
      setPercu("");
      setReference("");
      setResultats([]);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Encaissement impossible. Vérifiez le statut de la vente avant de réessayer.");
    } finally {
      setBusy(false);
    }
  }

  async function cloturerSession() {
    if (!session || busy) return;
    if (vente) return setMsg("Finalisez ou abandonnez le panier avant la clôture de caisse.");
    const amount = Number(totalCompte);
    if (!Number.isSafeInteger(amount) || amount < 0) return setMsg("Saisissez le montant espèces réellement compté, en FCFA.");
    if (!window.confirm("Clôturer définitivement cette session et enregistrer l’écart de caisse ?")) return;
    setBusy(true);
    const { data, error } = await sb.rpc("caisse_cloturer", { p_session: session.id, p_total_compte: amount });
    setBusy(false);
    if (error) return setMsg(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) return setMsg("La clôture a été envoyée, mais le résultat de rapprochement n’a pas été renvoyé.");
    setCloture(result);
    setSession(null);
    setTotalCompte("");
    setMsg("Session clôturée. Le rapprochement de caisse est disponible ci-dessous.");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16">
      <div className="print:hidden">
        <header className="-mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 bg-naxa-green-900 px-4 py-3 text-white">
          <a href="/pharmacie">← Pharmacie</a>
          <b>Caisse · {pharmacie || "Chargement…"}</b>
        </header>
        {loading && <section className="carte" role="status">Vérification de l’accès et de la session de caisse…</section>}
        {!loading && msg && !ready && <section className="carte" role="alert">{msg}<p className="mt-3"><a className="btn btn-clair" href="/connexion?retour=/pharmacie/caisse">Se reconnecter</a></p></section>}
        {ready && (
          <>
            <section className="carte mb-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h1 className="text-xl font-extrabold">Poste de caisse</h1><p className="text-sm text-slate-600">Les ventes sont enregistrées dans la pharmacie et la session sélectionnées.</p></div>
                {caisses.length > 1 && <label className="text-sm font-semibold">Caisse active<select className="champ mt-1" value={caisseId} onChange={(e) => void changerCaisse(e.target.value)} disabled={busy}><option value="">Choisir…</option>{caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></label>}
              </div>
              {session ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 font-bold text-emerald-800">Session ouverte</span>
                  <span>Fond initial : {fcfa(session.fond_initial)}</span>
                  <span>Ouverte le {new Date(session.ouvert_at).toLocaleString("fr-FR")}</span>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="text-sm font-semibold">Fond de caisse initial (FCFA)<input className="champ mt-1 w-full" type="number" min="0" step="1" inputMode="numeric" value={fondInitial} onChange={(e) => setFondInitial(e.target.value)} /></label>
                  <button className="btn btn-vert" disabled={busy || !caisseId} onClick={() => void ouvrirSession()}>{busy ? "Ouverture…" : "Ouvrir la session"}</button>
                </div>
              )}
            </section>
            {session && (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  <button className={onglet === "caisse" ? "btn btn-vert" : "btn btn-clair"} onClick={() => setOnglet("caisse")}>Encaissement</button>
                  <button className={onglet === "recherche" ? "btn btn-vert" : "btn btn-clair"} onClick={() => setOnglet("recherche")}>Recherche prix</button>
                  {!vente && <button className="btn btn-canari" disabled={busy} onClick={() => void nouvelleVente()}>Nouvelle vente</button>}
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  <section className="carte lg:col-span-2">
                    <h2 className="text-xl font-extrabold">{onglet === "caisse" ? "Panier de vente" : "Recherche de prix"}</h2>
                    <p className="mb-3 text-sm text-slate-600">{onglet === "caisse" ? "Créez une vente, puis scannez les codes-barres. Le stock est contrôlé par la base à chaque ajout." : "La recherche de prix ne crée aucune vente et ne modifie pas le stock."}</p>
                    {onglet === "caisse" && <input autoFocus className="champ w-full" placeholder="Scanner le code-barres puis Entrée" value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => void scanner(e)} disabled={!vente || busy} />}
                    <div className="mt-3 flex gap-2"><input className="champ min-w-0 flex-1" placeholder="Nom, référence ou code-barres" value={recherche} onChange={(e) => setRecherche(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void lookup()} /><button className="btn btn-clair" onClick={() => void lookup()} disabled={busy}>Rechercher</button></div>
                    {onglet === "recherche" && <div className="mt-3"><textarea className="champ min-h-24 w-full" placeholder="Jusqu’à 100 codes-barres, séparés par espaces, virgules ou retours à la ligne" value={bulk} onChange={(e) => setBulk(e.target.value)} /><button className="btn btn-clair mt-2" onClick={() => void lookupBulk()} disabled={busy}>Rechercher les codes</button></div>}
                    {resultats.length > 0 && <div className="mt-3 rounded-xl border">{resultats.map((p) => onglet === "caisse" ? <button key={p.produit_id} className="block w-full border-b p-3 text-left last:border-b-0 hover:bg-gray-50" onClick={() => void ajouter(p)} disabled={!vente || busy}><b>{p.nom}</b> {p.dosage && <span>{p.dosage}</span>} · {fcfa(p.prix)} · Stock disponible {p.quantite} · {p.emplacement || "Emplacement non renseigné"}</button> : <div key={p.produit_id} className="border-b p-3 last:border-b-0"><b>{p.nom}</b> {p.dosage && <span>{p.dosage}</span>} · <strong>{fcfa(p.prix)}</strong> · Stock {p.quantite}</div>)}</div>}
                    <div className="mt-5 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Produit</th><th className="p-2 text-center">Qté</th><th className="p-2 text-right">Prix moyen</th><th className="p-2 text-right">Total</th></tr></thead><tbody>{lignes.map((line) => <tr key={line.produit_id} className="border-t"><td className="p-2">{line.nom}{line.dosage ? " · " + line.dosage : ""}</td><td className="p-2 text-center">{line.q}</td><td className="p-2 text-right">{fcfa(line.prix)}</td><td className="p-2 text-right">{fcfa(line.total)}</td></tr>)}</tbody><tfoot><tr className="border-t-2 font-extrabold"><td className="p-2" colSpan={3}>Total à payer</td><td className="p-2 text-right">{fcfa(total)}</td></tr></tfoot></table></div>
                    {vente && <button className="btn btn-clair mt-4" disabled={busy} onClick={() => void abandonnerVente()}>Abandonner le panier et restituer le stock</button>}
                  </section>
                  <aside className="carte space-y-3">
                    <h2 className="text-lg font-bold">Encaissement</h2><p className="text-3xl font-extrabold">{fcfa(total)}</p>
                    <label className="block text-sm font-semibold">Montant espèces reçu (FCFA)<input className="champ mt-1 w-full" inputMode="numeric" type="number" min="0" step="1" value={percu} onChange={(e) => setPercu(e.target.value)} disabled={!vente || busy} /></label>
                    <p className="rounded-xl bg-gray-50 p-3 font-bold">Monnaie à rendre : {fcfa(rendu)}</p>
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><b>Paiements électroniques indisponibles</b><p className="mt-1">Orange Money et MTN MoMo ne peuvent pas être déclarés payés sur la seule base d’une référence saisie. Le canal marchand officiel doit être intégré et confirmer la transaction avant l’activation.</p></div>
                    <button disabled={busy || !vente || total <= 0} className="btn btn-vert w-full" onClick={() => void payer()}>{busy ? "Traitement…" : "Encaisser en espèces et préparer le ticket"}</button>
                  </aside>
                </div>
                <section className="carte mt-4 space-y-3">
                  <h2 className="text-lg font-extrabold">Clôture de session</h2>
                  <p className="text-sm text-slate-600">Comptez les espèces réellement présentes dans le tiroir, fond initial compris. Une vente brouillon doit être finalisée ou abandonnée avant la clôture.</p>
                  <div className="flex flex-col gap-2 sm:flex-row"><label className="flex-1 text-sm font-semibold">Total espèces compté (FCFA)<input className="champ mt-1 w-full" type="number" min="0" step="1" inputMode="numeric" value={totalCompte} onChange={(e) => setTotalCompte(e.target.value)} disabled={!!vente || busy} /></label><button className="btn btn-clair self-end" onClick={() => void cloturerSession()} disabled={!!vente || busy}>Clôturer et rapprocher</button></div>
                </section>
              </>
            )}
            {cloture && <section className="carte mt-4" role="status"><h2 className="text-lg font-extrabold">Rapprochement de caisse</h2><dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3"><div><dt className="text-sm text-slate-600">Théorique</dt><dd className="font-bold">{fcfa(cloture.total_theorique)}</dd></div><div><dt className="text-sm text-slate-600">Compté</dt><dd className="font-bold">{fcfa(cloture.total_compte)}</dd></div><div><dt className="text-sm text-slate-600">Écart</dt><dd className={cloture.ecart === 0 ? "font-bold text-emerald-700" : "font-bold text-red-700"}>{fcfa(cloture.ecart)}</dd></div></dl></section>}
            {msg && <p role="status" aria-live="polite" className="mt-4 rounded-xl border p-3 text-sm">{msg}</p>}
          </>
        )}
      </div>
      {ticket && ticket.length > 0 && (
        <section className="mx-auto mt-6 w-full max-w-md rounded-xl border bg-white p-5 text-slate-950">
          <h2 className="text-center text-xl font-extrabold">NAXA · Ticket de caisse</h2>
          <p className="mt-1 text-center text-sm">{pharmacie}</p>
          <p className="mt-3 text-xs">N° {ticket[0].numero_vente}</p>
          <p className="text-xs">Date : {new Date(ticket[0].paid_at ?? ticket[0].created_at).toLocaleString("fr-FR")}</p>
          <div className="my-3 border-t border-dashed" />
          {ticket.filter((row) => row.produit_id).map((row, index) => <div key={row.produit_id + "-" + index} className="flex justify-between gap-3 py-1 text-sm"><span>{row.produit_nom}{row.produit_dosage ? " · " + row.produit_dosage : ""} × {row.quantite}</span><span className="whitespace-nowrap">{fcfa(row.total_ligne ?? 0)}</span></div>)}
          <div className="my-3 border-t border-dashed" />
          <div className="flex justify-between text-sm"><span>Sous-total</span><span>{fcfa(ticket[0].total_brut)}</span></div>
          {ticket[0].remise > 0 && <div className="flex justify-between text-sm"><span>Remise</span><span>-{fcfa(ticket[0].remise)}</span></div>}
          <div className="mt-2 flex justify-between text-lg font-extrabold"><span>Total payé</span><span>{fcfa(ticket[0].total_net)}</span></div>
          <p className="mt-3 text-center text-xs">Paiement en espèces · Merci de votre confiance.</p>
          <div className="mt-4 flex justify-center gap-2 print:hidden"><button className="btn btn-vert" onClick={() => window.print()}>Imprimer le ticket</button><button className="btn btn-clair" onClick={() => setTicket(null)}>Fermer</button></div>
        </section>
      )}
      <style jsx global>{`@media print { body * { visibility: hidden !important; } .ticket-print, .ticket-print * { visibility: visible !important; } }`}</style>
    </main>
  );
}
