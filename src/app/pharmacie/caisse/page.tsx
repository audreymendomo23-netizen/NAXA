"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";
import { monnaieARendre, totalPanier } from "@/lib/caisse/calculs";
import { CaisseRetraitsMarketplace } from "@/components/pharmacie/CaisseRetraitsMarketplace";
import { CaisseDecaissements } from "@/components/pharmacie/CaisseDecaissements";
import { RappelsLotsBanner } from "@/components/pharmacie/RappelsLotsBanner";
import { CaisseWorkspaceShell } from "@/components/pharmacie/CaisseWorkspaceShell";

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
type Session = { id: string; caisse_id: string; fond_initial: number; ouvert_at: string; ouvert_par: string };
type VenteHistorique = { id: string; numero_vente: string; total_net: number; statut: string; mode_paiement: string | null; created_at: string; paid_at: string | null };
type PaiementTicket = { montant_percu: number | null; monnaie_rendue: number | null; montant: number; mode: string };
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
  const [sessionBloquee, setSessionBloquee] = useState(false);
  const [sessionCheckErreur, setSessionCheckErreur] = useState(false);
  const [draftCheckErreur, setDraftCheckErreur] = useState(false);
  const [fondInitial, setFondInitial] = useState("");
  const [totalCompte, setTotalCompte] = useState("");
  const [ecartJustification, setEcartJustification] = useState("");
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
  const scanBusyRef = useRef(false);
  const [ticket, setTicket] = useState<TicketLigne[] | null>(null);
  const [paiementTicket, setPaiementTicket] = useState<PaiementTicket | null>(null);
  const [historique, setHistorique] = useState<VenteHistorique[]>([]);
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);

  const chargerVenteBrouillon = useCallback(async (sessionId: string, userId: string): Promise<boolean> => {
    const { data: draft, error } = await sb.from("ventes")
      .select("id")
      .eq("caisse_session_id", sessionId)
      .eq("created_by", userId)
      .eq("statut", "brouillon")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      setDraftCheckErreur(true);
      setLignes([]);
      setMsg("Impossible de vérifier le panier existant. Nouvelle vente et clôture bloquées pour éviter un doublon ; rechargez la page.");
      return false;
    }
    if (!draft) {
      setDraftCheckErreur(false);
      setVente(null);
      setLignes([]);
      return true;
    }
    const { data: rows, error: linesError } = await sb.from("vente_lignes")
      .select("produit_id,quantite,prix_unitaire,total_ligne,produits(nom,dosage,code_barre)")
      .eq("vente_id", draft.id);
    if (linesError) {
      setDraftCheckErreur(true);
      setVente(draft.id);
      setLignes([]);
      setMsg("Le panier existe mais ses lignes n’ont pas pu être chargées. Nouvelle vente et clôture bloquées ; rechargez la page. Vous pouvez abandonner ce panier puis en créer un nouveau.");
      return false;
    }
    setDraftCheckErreur(false);
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
    setMsg("Panier en cours repris. Le stock physique sera débité uniquement à la validation de l’encaissement.");
    return true;
  }, [sb]);

  const chargerSession = useCallback(async (id: string, userId: string) => {
    setSession(null);
    setSessionBloquee(false);
    setSessionCheckErreur(false);
    setCloture(null);
    setTicket(null);
    setPaiementTicket(null);
    const { data, error } = await sb.from("caisses_sessions")
      .select("id,caisse_id,fond_initial,ouvert_at,ouvert_par")
      .eq("caisse_id", id)
      .eq("statut", "ouverte")
      .maybeSingle();
    if (error) {
      setSessionCheckErreur(true);
      setMsg("Impossible de vérifier la session de caisse. L’ouverture et les opérations restent bloquées jusqu’à une nouvelle vérification.");
      return false;
    }
    setSessionCheckErreur(false);
    if (!data) {
      setSession(null);
      setSessionBloquee(false);
      setVente(null);
      setLignes([]);
      setDraftCheckErreur(false);
      return false;
    }
    if (data.ouvert_par !== userId) {
      setSession(null);
      setSessionBloquee(true);
      setVente(null);
      setLignes([]);
      setDraftCheckErreur(false);
      setMsg("Une session est déjà ouverte par un autre compte Caisse. Demandez à son titulaire ou à l’administration de la clôturer avant d’utiliser ce poste.");
      return false;
    }
    setSessionBloquee(false);
    setSession(data as Session);
    const draftVerified = await chargerVenteBrouillon(data.id, userId);
    return draftVerified;
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

  const total = useMemo(() => totalPanier(lignes.map((line) => line.total)), [lignes]);
  const montantRecu = Number(percu);
  const rendu = monnaieARendre(Number.isSafeInteger(montantRecu) && montantRecu >= 0 ? montantRecu : 0, total);

  async function changerCaisse(id: string) {
    if (!uid || !id || busy) return;
    setBusy(true);
    setCaisseId(id);
    setMsg("");
    setSession(null);
    setSessionBloquee(false);
    setVente(null);
    setLignes([]);
    setDraftCheckErreur(false);
    try {
      await chargerSession(id, uid);
    } catch {
      setSessionCheckErreur(true);
      setMsg("La vérification du poste a échoué. Rechargez la page avant toute opération.");
    } finally {
      setBusy(false);
    }
  }

  async function chargerHistorique() {
    if (!pid || !uid || busy) return;
    setBusy(true);
    try {
      const { data, error } = await sb.from("ventes")
        .select("id,numero_vente,total_net,statut,mode_paiement,created_at,paid_at")
        .eq("pharmacie_id", pid)
        .eq("created_by", uid)
        .eq("statut", "payee")
        .order("paid_at", { ascending: false })
        .limit(20);
      if (error) return setMsg("L’historique des ventes n’est pas disponible.");
      setHistorique((data ?? []) as VenteHistorique[]);
      setHistoriqueOuvert(true);
      setMsg((data?.length ?? 0) + " vente(s) récente(s) chargée(s).");
    } catch {
      setMsg("L’historique des ventes n’est pas disponible pour le moment.");
    } finally {
      setBusy(false);
    }
  }

  async function reimprimerTicket(venteId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const { data, error } = await sb.rpc("vente_ticket", { p_vente: venteId });
      if (error || !data?.length) return setMsg("Ticket indisponible ou vente hors périmètre.");
      const { data: payments } = await sb.from("vente_paiements")
        .select("mode,montant,montant_percu,monnaie_rendue")
        .eq("vente_id", venteId)
        .order("created_at", { ascending: true });
      const cash = (payments ?? []).filter((row) => row.mode === "especes");
      const tendered = cash.reduce((sum, row) => sum + (Number(row.montant_percu) || Number(row.montant) || 0), 0);
      const change = cash.reduce((sum, row) => sum + (Number(row.monnaie_rendue) || 0), 0);
      setPaiementTicket(cash.length ? { mode: "especes", montant: cash.reduce((sum, row) => sum + Number(row.montant || 0), 0), montant_percu: tendered, monnaie_rendue: change } : null);
      setTicket((data ?? []) as TicketLigne[]);
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch {
      setMsg("La réimpression du ticket a échoué. Réessayez depuis l’historique.");
    } finally {
      setBusy(false);
    }
  }

  async function ouvrirSession() {
    if (!caisseId || !uid || sessionCheckErreur || sessionBloquee) return;
    if (fondInitial.trim() === "") return setMsg("Saisissez le fond initial, même s’il est égal à zéro.");
    const amount = Number(fondInitial);
    if (!Number.isSafeInteger(amount) || amount < 0) return setMsg("Le fond initial doit être un montant entier positif ou nul.");
    setBusy(true);
    try {
      const { data, error } = await sb.rpc("caisse_ouvrir", { p_caisse: caisseId, p_fond_initial: amount });
      if (error) throw error;
      const verified = await chargerSession(caisseId, uid);
      if (!verified || !data) {
        setMsg("La session ou le panier n’a pas pu être vérifié après l’ouverture. Rechargez la page avant toute opération.");
        return;
      }
      setMsg("Session ouverte et vérifiée. Le fond initial est enregistré ; créez une vente lorsque vous êtes prêt.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ouverture de session impossible. Une session peut déjà être ouverte.");
      await chargerSession(caisseId, uid);
    } finally {
      setBusy(false);
    }
  }

  async function nouvelleVente() {
    if (!session || !uid || busy || draftCheckErreur) return;
    if (vente) return setMsg("Un panier est déjà ouvert. Finalisez-le ou abandonnez-le avant d’en créer un autre.");
    setBusy(true);
    try {
      const { data, error } = await sb.rpc("vente_creer", { p_session: session.id });
      if (error || !data) return setMsg(error?.message ?? "Impossible de créer la vente.");
      setVente(data as string);
      setDraftCheckErreur(false);
      setLignes([]);
      setTicket(null);
      setPaiementTicket(null);
      setMsg("Nouvelle vente créée.");
    } catch {
      setMsg("Création de vente impossible. Vérifiez la session avant de réessayer.");
      await chargerSession(session.caisse_id, uid);
    } finally {
      setBusy(false);
    }
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
    const venteId = vente;
    setBusy(true);
    try {
      const { error } = await sb.rpc("vente_ajouter_produit", {
        p_vente: venteId, p_produit: produit.produit_id, p_quantite: 1,
      });
      if (session && uid) await chargerVenteBrouillon(session.id, uid);
      if (error) return setMsg(error.message);
      setResultats([]);
      setScan("");
      setMsg(produit.nom + " ajouté au panier.");
    } catch {
      if (session && uid) await chargerVenteBrouillon(session.id, uid);
      setMsg("Ajout non confirmé. Le panier a été relu depuis la base pour éviter un doublon.");
    } finally {
      setBusy(false);
    }
  }

  async function scanner(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (scanBusyRef.current || busy) return;
    const code = scan.trim();
    if (!code) return;
    if (!vente) return setMsg("Créez une vente avant de scanner un produit.");
    scanBusyRef.current = true;
    try {
      const { data, error } = await sb.rpc("caisse_rechercher_produit", {
        p_pharmacie: pid, p_code_barre: code, p_recherche: null,
      });
      if (error || !data?.length) {
        setMsg("Code-barres introuvable dans cette pharmacie ou produit indisponible.");
        return;
      }
      await ajouter(data[0] as Produit);
    } catch {
      setMsg("La lecture du code-barres a échoué. Vous pouvez réessayer.");
    } finally {
      scanBusyRef.current = false;
    }
  }

  async function retirerProduit(line: Ligne) {
    if (!vente || !session || !uid || busy) return;
    if (!window.confirm("Retirer les " + line.q + " unité(s) de « " + line.nom + " » du panier ? Le stock physique reste inchangé.")) return;
    const venteId = vente;
    setBusy(true);
    try {
      const { data, error } = await sb.rpc("vente_produit_retirer", {
        p_vente: venteId,
        p_produit: line.produit_id,
      });
      if (error) throw error;
      const verified = await chargerVenteBrouillon(session.id, uid);
      if (!verified) {
        setMsg("Le retrait a été demandé, mais le panier doit être revérifié avant toute autre opération.");
        return;
      }
      setPercu("");
      setMsg(Number(data) + " unité(s) retirée(s) du panier ; aucun débit physique n’est effectué avant l’encaissement.");
    } catch (error) {
      await chargerVenteBrouillon(session.id, uid);
      setMsg(error instanceof Error ? error.message : "Retrait non confirmé. Le panier a été relu depuis la base.");
    } finally {
      setBusy(false);
    }
  }

  async function abandonnerVente() {
    if (!vente || busy) return;
    if (!window.confirm("Abandonner ce panier ? Le stock physique reste inchangé pour les nouveaux paniers.")) return;
    const venteId = vente;
    setBusy(true);
    try {
      const { error } = await sb.rpc("vente_brouillon_abandonner", { p_vente: venteId });
      if (error) {
        if (session && uid) await chargerSession(session.id, uid);
        return setMsg(error.message);
      }
      setVente(null);
      setDraftCheckErreur(false);
      setLignes([]);
      setPercu("");
      setMsg("Panier abandonné ; aucun nouveau débit physique n’a été effectué.");
    } catch {
      if (session && uid) await chargerSession(session.id, uid);
      setMsg("Abandon non confirmé. Le panier et le stock ont été revérifiés depuis la base.");
    } finally {
      setBusy(false);
    }
  }

  async function payer() {
    if (!vente || total <= 0) return setMsg("Ajoutez au moins un produit à la vente.");
    const montant = Number(percu);
    if (!Number.isSafeInteger(montant) || montant <= 0) return setMsg("Indiquez le montant espèces reçu en FCFA.");
    if (montant < total) return setMsg("Montant reçu insuffisant.");
    if (busy) return;
    setBusy(true);
    try {
      const { data: payment, error: paymentError } = await sb.rpc("vente_encaisser_finaliser", {
        p_vente: vente, p_montant_percu: montant,
      });
      if (paymentError) throw paymentError;
      // L'encaissement et le passage à payée sont atomiques côté base.
      // Libérer le panier local même si la lecture du ticket échoue ensuite.
      setVente(null);
      setDraftCheckErreur(false);
      setLignes([]);
      setPercu("");
      setResultats([]);
      const { data: receipt, error: receiptError } = await sb.rpc("vente_ticket", { p_vente: vente });
      if (receiptError || !receipt?.length) {
        setMsg("Vente encaissée. Le ticket n’a pas pu être chargé ; retrouvez-la dans l’historique pour le réimprimer.");
        return;
      }
      setPaiementTicket({ mode: "especes", montant: Number(payment?.[0]?.montant_a_payer ?? total), montant_percu: montant, monnaie_rendue: Number(payment?.[0]?.monnaie_rendue ?? 0) });
      setTicket((receipt ?? []) as TicketLigne[]);
      setMsg("Vente encaissée en espèces. Vérifiez le ticket avant impression. Monnaie à rendre : " + fcfa(payment?.[0]?.monnaie_rendue ?? 0) + ".");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Résultat de paiement inconnu.";
      if (session && uid) await chargerSession(session.id, uid);
      setMsg("Encaissement non confirmé : " + reason + " Le panier a été relu depuis la base ; consultez l’historique avant toute nouvelle tentative.");
    } finally {
      setBusy(false);
    }
  }

  async function cloturerSession() {
    if (!session || busy || draftCheckErreur) return;
    if (vente) return setMsg("Finalisez ou abandonnez le panier avant la clôture de caisse.");
    if (totalCompte.trim() === "") return setMsg("Saisissez le montant réellement compté, même s’il est égal à zéro.");
    const amount = Number(totalCompte);
    if (!Number.isSafeInteger(amount) || amount < 0) return setMsg("Saisissez le montant espèces réellement compté, en FCFA.");
    if (!window.confirm("Clôturer définitivement cette session et enregistrer l’écart de caisse ?")) return;
    setBusy(true);
    try {
      const { data, error } = await sb.rpc("caisse_cloturer", { p_session: session.id, p_total_compte: amount, p_ecart_justification: ecartJustification.trim() || null });
      if (error) return setMsg(error.message);
      const result = Array.isArray(data) ? data[0] : data;
      if (!result) return setMsg("La clôture a été envoyée, mais le résultat de rapprochement n’a pas été renvoyé.");
      setCloture(result);
      setSession(null);
      setTotalCompte("");
      setFondInitial("");
      setMsg("Session clôturée. Le rapprochement de caisse est disponible ci-dessous.");
    } catch {
      setMsg("La clôture n’a pas pu être confirmée. Rechargez le poste et vérifiez le statut de la session avant de réessayer.");
      if (uid) await chargerSession(session.caisse_id, uid);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <CaisseWorkspaceShell sessionOpen={!!session} pharmacyName={pharmacie}>
      <div className="print:hidden">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-naxa-green-900 px-4 py-4 text-white shadow-sm">
          <a href="/pharmacie">← Pharmacie</a>
          <b>Caisse · {pharmacie || "Chargement…"}</b>
        </header>
        <RappelsLotsBanner pharmacieId={pid} />
        {loading && <section className="carte" role="status">Vérification de l’accès et de la session de caisse…</section>}
        {!loading && msg && !ready && <section className="carte" role="alert">{msg}<p className="mt-3"><a className="btn btn-clair" href="/connexion?retour=/pharmacie/caisse">Se reconnecter</a></p></section>}
        {ready && !loading && (
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
              ) : sessionCheckErreur ? (
                <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">Vérification de session impossible. Rechargez la page avant d’ouvrir ou d’utiliser ce poste.</p>
              ) : sessionBloquee ? (
                <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Une autre session est ouverte sur ce poste. La Caisse ne peut pas démarrer une session concurrente.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="text-sm font-semibold">Fond de caisse initial (FCFA)<input className="champ mt-1 w-full" type="number" min="0" step="1" inputMode="numeric" value={fondInitial} onChange={(e) => setFondInitial(e.target.value)} /></label>
                  <button className="btn btn-vert" disabled={busy || !caisseId} onClick={() => void ouvrirSession()}>{busy ? "Ouverture…" : "Ouvrir la session"}</button>
                </div>
              )}
            </section>
            <nav aria-label="Onglets du tableau de bord caisse" className="mb-4 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3">
              <button type="button" className={onglet === "caisse" ? "btn btn-vert shrink-0" : "btn btn-clair shrink-0"} onClick={() => { setOnglet("caisse"); document.getElementById("caisse-encaissement")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Encaissement</button>
              <button type="button" className={onglet === "recherche" ? "btn btn-vert shrink-0" : "btn btn-clair shrink-0"} onClick={() => { setOnglet("recherche"); document.getElementById("caisse-encaissement")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Recherche prix</button>
              <a className="btn btn-clair shrink-0" href="#caisse-retraits">Retraits Marketplace</a>
              <a className="btn btn-clair shrink-0" href="#caisse-decaissements">Décaissements</a>
              <a className="btn btn-clair shrink-0" href="#caisse-historique">Historique tickets</a>
              <a className="btn btn-clair shrink-0" href="#caisse-cloture">Clôture</a>
            </nav>
            <div id="caisse-retraits"><CaisseRetraitsMarketplace pharmacieId={pid} sessionId={session?.id ?? null} /></div>
            <div id="caisse-decaissements"><CaisseDecaissements sessionId={session?.id ?? null} /></div>
            <section id="caisse-historique" className="carte mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="font-extrabold">Historique des ventes</h2><p className="text-sm text-slate-600">Consultez ou réimprimez vos 20 dernières ventes payées.</p></div>
                <button className="btn btn-clair" disabled={busy} onClick={() => historiqueOuvert ? setHistoriqueOuvert(false) : void chargerHistorique()}>{historiqueOuvert ? "Masquer l’historique" : "Afficher l’historique"}</button>
              </div>
              {historiqueOuvert && <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Ticket</th><th className="p-2 text-left">Date</th><th className="p-2 text-right">Total</th><th className="p-2">Action</th></tr></thead><tbody>{historique.map((sale) => <tr key={sale.id} className="border-t"><td className="p-2">{sale.numero_vente}</td><td className="p-2">{new Date(sale.paid_at ?? sale.created_at).toLocaleString("fr-FR")}</td><td className="p-2 text-right">{fcfa(sale.total_net)}</td><td className="p-2 text-center"><button className="btn btn-clair" disabled={busy} onClick={() => void reimprimerTicket(sale.id)}>Réimprimer</button></td></tr>)}</tbody></table>{historique.length === 0 && <p className="p-3 text-sm text-slate-600">Aucune vente payée récente.</p>}</div>}
            </section>
            {session && draftCheckErreur && <p role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">Vérification du panier incomplète : aucune nouvelle vente ne peut être créée et la session ne peut pas être clôturée tant que le contrôle n’a pas réussi.</p>}
            {session && (
              <>
                <div id="caisse-encaissement" className="mb-4 flex flex-wrap gap-2">
                  <button className={onglet === "caisse" ? "btn btn-vert" : "btn btn-clair"} onClick={() => setOnglet("caisse")}>Encaissement</button>
                  <button className={onglet === "recherche" ? "btn btn-vert" : "btn btn-clair"} onClick={() => setOnglet("recherche")}>Recherche prix</button>
                  {!vente && <button className="btn btn-canari" disabled={busy || draftCheckErreur} onClick={() => void nouvelleVente()}>Nouvelle vente</button>}
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  <section className="carte lg:col-span-2">
                    <h2 className="text-xl font-extrabold">{onglet === "caisse" ? "Panier de vente" : "Recherche de prix"}</h2>
                    <p className="mb-3 text-sm text-slate-600">{onglet === "caisse" ? "Créez une vente, puis scannez les codes-barres. Le stock est contrôlé par la base à chaque ajout." : "La recherche de prix ne crée aucune vente et ne modifie pas le stock."}</p>
                    {onglet === "caisse" && <input autoFocus className="champ w-full" placeholder="Scanner le code-barres puis Entrée" value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => void scanner(e)} disabled={!vente || busy} />}
                    <div className="mt-3 flex gap-2"><input className="champ min-w-0 flex-1" placeholder="Nom, référence ou code-barres" value={recherche} onChange={(e) => setRecherche(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void lookup()} /><button className="btn btn-clair" onClick={() => void lookup()} disabled={busy}>Rechercher</button></div>
                    {onglet === "recherche" && <div className="mt-3"><textarea className="champ min-h-24 w-full" placeholder="Jusqu’à 100 codes-barres, séparés par espaces, virgules ou retours à la ligne" value={bulk} onChange={(e) => setBulk(e.target.value)} /><button className="btn btn-clair mt-2" onClick={() => void lookupBulk()} disabled={busy}>Rechercher les codes</button></div>}
                    {resultats.length > 0 && <div className="mt-3 rounded-xl border">{resultats.map((p) => onglet === "caisse" ? <button key={p.produit_id} className="block w-full border-b p-3 text-left last:border-b-0 hover:bg-gray-50" onClick={() => void ajouter(p)} disabled={!vente || busy}><b>{p.nom}</b> {p.dosage && <span>{p.dosage}</span>} · {fcfa(p.prix)} · Stock disponible {p.quantite} · {p.emplacement || "Emplacement non renseigné"}</button> : <div key={p.produit_id} className="border-b p-3 last:border-b-0"><b>{p.nom}</b> {p.dosage && <span>{p.dosage}</span>} · <strong>{fcfa(p.prix)}</strong> · Stock {p.quantite}</div>)}</div>}
                    <div className="mt-5 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Produit</th><th className="p-2 text-center">Qté</th><th className="p-2 text-right">Prix moyen</th><th className="p-2 text-right">Total</th><th className="p-2 text-center">Action</th></tr></thead><tbody>{lignes.map((line) => <tr key={line.produit_id} className="border-t"><td className="p-2">{line.nom}{line.dosage ? " · " + line.dosage : ""}</td><td className="p-2 text-center">{line.q}</td><td className="p-2 text-right">{fcfa(line.prix)}</td><td className="p-2 text-right">{fcfa(line.total)}</td><td className="p-2 text-center"><button className="btn btn-clair" disabled={busy || !vente} onClick={() => void retirerProduit(line)}>Retirer</button></td></tr>)}</tbody><tfoot><tr className="border-t-2 font-extrabold"><td className="p-2" colSpan={4}>Total à payer</td><td className="p-2 text-right">{fcfa(total)}</td></tr></tfoot></table></div>
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
                <section id="caisse-cloture" className="carte mt-4 space-y-3">
                  <h2 className="text-lg font-extrabold">Clôture de session</h2>
                  <p className="text-sm text-slate-600">Comptez les espèces réellement présentes dans le tiroir, fond initial compris. Une vente brouillon doit être finalisée ou abandonnée avant la clôture.</p>
                  <div className="flex flex-col gap-2 sm:flex-row"><label className="flex-1 text-sm font-semibold">Total espèces compté (FCFA)<input className="champ mt-1 w-full" type="number" min="0" step="1" inputMode="numeric" value={totalCompte} onChange={(e) => setTotalCompte(e.target.value)} disabled={!!vente || busy} /></label><button className="btn btn-clair self-end" onClick={() => void cloturerSession()} disabled={!!vente || busy || draftCheckErreur}>Clôturer et rapprocher</button></div>
                </section>
              </>
            )}
            {cloture && <section className="carte mt-4" role="status"><h2 className="text-lg font-extrabold">Rapprochement de caisse</h2><dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3"><div><dt className="text-sm text-slate-600">Théorique</dt><dd className="font-bold">{fcfa(cloture.total_theorique)}</dd></div><div><dt className="text-sm text-slate-600">Compté</dt><dd className="font-bold">{fcfa(cloture.total_compte)}</dd></div><div><dt className="text-sm text-slate-600">Écart</dt><dd className={cloture.ecart === 0 ? "font-bold text-emerald-700" : "font-bold text-red-700"}>{fcfa(cloture.ecart)}</dd></div></dl>{cloture.ecart !== 0 && <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Écart à vérifier : la clôture doit conserver une justification et ne pas effacer la différence constatée.</p>}</section>}
            {msg && <p role="status" aria-live="polite" className="mt-4 rounded-xl border p-3 text-sm">{msg}</p>}
          </>
        )}
      </CaisseWorkspaceShell>
      {ticket && ticket.length > 0 && (
        <section className="ticket-print mx-auto mt-6 w-full max-w-md rounded-xl border bg-white p-5 text-slate-950">
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
          <div className="mt-3 space-y-1 text-sm"><div className="flex justify-between"><span>Mode de paiement</span><span>{paiementTicket?.mode === "especes" ? "Espèces" : ticket[0].mode_paiement ?? "—"}</span></div>{paiementTicket?.montant_percu != null && <div className="flex justify-between"><span>Montant reçu</span><span>{fcfa(paiementTicket.montant_percu)}</span></div>}{paiementTicket?.monnaie_rendue != null && <div className="flex justify-between font-bold"><span>Monnaie rendue</span><span>{fcfa(paiementTicket.monnaie_rendue)}</span></div>}</div><p className="mt-3 text-center text-xs">Merci de votre confiance.</p>
          <div className="mt-4 flex justify-center gap-2 print:hidden"><button className="btn btn-vert" onClick={() => window.print()}>Imprimer le ticket</button><button className="btn btn-clair" onClick={() => { setTicket(null); setPaiementTicket(null); }}>Fermer</button></div>
        </section>
      )}
      <style jsx global>{`@media print { body * { visibility: hidden !important; } .ticket-print, .ticket-print * { visibility: visible !important; } }`}</style>
    </>
  );
}
