"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { TicketPharmacyLogo } from "@/components/pharmacie/TicketPharmacyLogo";
import { printAfterImagesLoaded } from "@/lib/print-after-images";
import { fcfa } from "@/lib/ranking";
import { CaisseWorkspaceShell } from "@/components/pharmacie/CaisseWorkspaceShell";
import { CaisseSectionTabs } from "@/components/pharmacie/CaisseSectionTabs";

type Section = "clients" | "assurances" | "historique" | "annulations" | "rapports" | "profil" | "notifications" | "service";
type Sale = { id: string; numero_vente: string | null; total_net: number; statut: string; mode_paiement: string | null; created_at: string; paid_at: string | null; client_id: string | null; caisse_session_id: string; remise: number };
type ClientRow = { id: string; client_id: string; reference_client: string | null; actif: boolean; created_at: string };
type CreditRow = { id: string; client_id: string; plafond: number; solde: number; actif: boolean; updated_at: string };
type CoverageRow = { id: string; client_id: string; assureur_id: string; numero_adherent: string; date_fin: string | null; plafond: number | null; taux_prise_en_charge: number | null; actif: boolean };
type InsuranceCase = { id: string; client_id: string; couverture_id: string; statut: string; montant_total: number | null; montant_prise_en_charge: number | null; montant_client: number | null; created_at: string; motif_refus: string | null };
type Cancellation = { id: string; vente_id: string; motif: string; statut: string; created_at: string; demandee_par: string; decidee_at: string | null };
type Notice = { id: string; user_id: string | null; pharmacie_id: string | null; type: string; titre: string; corps: string; lu_le: string | null; created_at: string };
type SessionRow = { id: string; caisse_id: string; ouvert_at: string; cloture_at: string | null; statut: string; fond_initial: number; total_theorique: number; total_compte: number | null; ecart: number | null };
type TicketRow = { vente_id: string; numero_vente: string; statut: string; created_at: string; paid_at: string | null; total_brut: number; remise: number; total_net: number; mode_paiement: string | null; produit_id: string | null; produit_nom: string | null; produit_dosage: string | null; quantite: number | null; total_ligne: number | null };
type Account = { id: string; role: string | null; fonction_interne: string | null; active_role?: string | null; pharmacie_id: string | null; actif: boolean | null; first_name: string | null; last_name: string | null; phone: string | null; username: string | null };
type ClientIdentity = { id: string; first_name: string | null; last_name: string | null; phone: string | null; username: string | null };
type CreditRepaymentReceipt = { operationId: string; creditId: string; clientId: string; amount: number; reference: string | null; method: string; remainingBalance: number | null; issuedAt: string; cashierName: string; pharmacyName: string };

const menu: { id: Section; label: string; description: string }[] = [
  { id: "clients", label: "Clients & crédits", description: "Références clients et encours commerciaux enregistrés pour la pharmacie." },
  { id: "assurances", label: "Assurances", description: "Couvertures visibles et dossiers de tiers payant accessibles à ce compte." },
  { id: "historique", label: "Historique des ventes", description: "Recherche dans les ventes de cette caissière et demande d’annulation contrôlée." },
  { id: "annulations", label: "Annulations", description: "Suivi des demandes transmises au rôle habilité ; la caisse ne décide pas sa propre demande." },
  { id: "rapports", label: "Rapports", description: "Indicateurs calculés exclusivement à partir des ventes et sessions réelles accessibles." },
  { id: "profil", label: "Profil & sécurité", description: "Informations du compte et vérification du PIN de reprise." },
  { id: "notifications", label: "Notifications", description: "Alertes de la pharmacie et notifications personnelles." },
  { id: "service", label: "Prise / fin de service", description: "Historique des sessions de caisse du compte connecté." },
];
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "—";
const displayName = (p: Account | null) => [p?.first_name, p?.last_name].filter(Boolean).join(" ") || p?.username || "Compte caisse";
const clientName = (id: string, identities: Record<string, ClientIdentity>) => {
  const p = identities[id];
  return p ? ([p.first_name, p.last_name].filter(Boolean).join(" ") || p.username || p.phone || id.slice(0, 8)) : id.slice(0, 8) + "…";
};
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="carte space-y-3"><h2 className="text-lg font-extrabold">{title}</h2>{children}</section>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">{children}</p>;
}

export default function CaisseParcoursPage() {
  const params = useParams<{ section: string }>();
  if (!menu.some((item) => item.id === params.section)) notFound();
  const section = params.section as Section;
  const sb = useMemo(() => supabaseBrowser(), []);
  const [account, setAccount] = useState<Account | null>(null);
  const [uid, setUid] = useState("");
  const [pharmacyId, setPharmacyId] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("toutes");
  const [salesFrom, setSalesFrom] = useState("");
  const [salesTo, setSalesTo] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [creditSearch, setCreditSearch] = useState("");
  const [reportPeriod, setReportPeriod] = useState<"jour" | "semaine" | "mois" | "tout">("mois");
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [credits, setCredits] = useState<CreditRow[]>([]);
  const [clientIdentities, setClientIdentities] = useState<Record<string, ClientIdentity>>({});
  const [coverages, setCoverages] = useState<CoverageRow[]>([]);
  const [insuranceCases, setInsuranceCases] = useState<InsuranceCase[]>([]);
  const [insurerNames, setInsurerNames] = useState<Record<string, string>>({});
  const [cancellations, setCancellations] = useState<Cancellation[]>([]);
  const [notifications, setNotifications] = useState<Notice[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [locked, setLocked] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [pin, setPin] = useState("");
  const [ticketRows, setTicketRows] = useState<TicketRow[]>([]);
  const [creditReceipt, setCreditReceipt] = useState<CreditRepaymentReceipt | null>(null);
  const [profileTab, setProfileTab] = useState<"compte" | "securite" | "preferences" | "activite">("compte");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [textSize, setTextSize] = useState<"normal" | "grand">("normal");
  const [compactDisplay, setCompactDisplay] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);

  useEffect(() => {
    try {
      const savedSize = window.localStorage.getItem("naxa-caisse-text-size");
      const savedCompact = window.localStorage.getItem("naxa-caisse-compact");
      if (savedSize === "grand") setTextSize("grand");
      setCompactDisplay(savedCompact === "true");
    } catch {
      // Les préférences restent utilisables en mémoire si le stockage local est indisponible.
    } finally {
      setPreferencesReady(true);
    }
  }, []);

  async function saveProfilePreferences() {
    try {
      window.localStorage.setItem("naxa-caisse-text-size", textSize);
      window.localStorage.setItem("naxa-caisse-compact", String(compactDisplay));
      setNotice("Préférences d’affichage enregistrées sur cet appareil.");
      setError("");
    } catch {
      setError("Le navigateur ne permet pas d’enregistrer les préférences sur cet appareil.");
    }
  }

  async function changePassword() {
    if (newPassword.length < 10 || newPassword !== confirmPassword) {
      setError("Le nouveau mot de passe doit contenir au moins 10 caractères et les deux saisies doivent être identiques.");
      return;
    }
    setPasswordBusy(true);
    setError("");
    setNotice("");
    const { error: updateError } = await sb.auth.updateUser({ password: newPassword });
    setPasswordBusy(false);
    if (updateError) {
      setError(updateError.message || "Le changement de mot de passe a échoué.");
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setNotice("Mot de passe mis à jour par le service d’authentification.");
  }

  const loadSection = useCallback(async (pid: string, userId: string) => {
    setError("");
    if (section === "clients") {
      const [c, cr] = await Promise.all([
        sb.from("client_fiches").select("id,client_id,reference_client,actif,created_at").eq("pharmacie_id", pid).order("created_at", { ascending: false }).limit(200),
        sb.from("client_credits").select("id,client_id,plafond,solde,actif,updated_at").eq("pharmacie_id", pid).order("updated_at", { ascending: false }).limit(200),
      ]);
      const clientRows = (c.data ?? []) as ClientRow[];
      const creditRows = (cr.data ?? []) as CreditRow[];
      setClients(clientRows); setCredits(creditRows);
      const ids = [...new Set([...clientRows.map((x) => x.client_id), ...creditRows.map((x) => x.client_id)])];
      if (ids.length) {
        const { data: identities } = await sb.from("profiles").select("id,first_name,last_name,phone,username").in("id", ids);
        setClientIdentities(Object.fromEntries(((identities ?? []) as ClientIdentity[]).map((x) => [x.id, x])));
      } else setClientIdentities({});
      if (c.error && cr.error) setError("Le répertoire client et les crédits ne sont pas accessibles à ce compte.");
    } else if (section === "assurances") {
      const [cv, cs, ins] = await Promise.all([
        sb.from("couvertures_assurance").select("id,client_id,assureur_id,numero_adherent,date_fin,plafond,taux_prise_en_charge,actif").order("created_at", { ascending: false }).limit(200),
        sb.from("dossiers_assurance").select("id,client_id,couverture_id,statut,montant_total,montant_prise_en_charge,montant_client,created_at,motif_refus").eq("pharmacie_id", pid).eq("created_by", userId).order("created_at", { ascending: false }).limit(200),
        sb.from("assureurs").select("id,nom").eq("actif", true).order("nom"),
      ]);
      setCoverages((cv.data ?? []) as CoverageRow[]);
      setInsuranceCases((cs.data ?? []) as InsuranceCase[]);
      setInsurerNames(Object.fromEntries((ins.data ?? []).map((row: { id: string; nom: string }) => [row.id, row.nom])));
      if (cv.error && cs.error) setError("Les données d’assurance ne sont pas accessibles à ce compte. Les droits RLS restent prioritaires.");
    } else if (section === "historique" || section === "annulations" || section === "rapports") {
      const [v, a, s] = await Promise.all([
        sb.from("ventes").select("id,numero_vente,total_net,statut,mode_paiement,created_at,paid_at,client_id,caisse_session_id,remise").eq("pharmacie_id", pid).eq("created_by", userId).order("created_at", { ascending: false }).limit(500),
        sb.from("vente_annulation_demandes").select("id,vente_id,motif,statut,created_at,demandee_par,decidee_at").eq("pharmacie_id", pid).eq("demandee_par", userId).order("created_at", { ascending: false }).limit(200),
        sb.from("caisses_sessions").select("id,caisse_id,ouvert_at,cloture_at,statut,fond_initial,total_theorique,total_compte,ecart").eq("ouvert_par", userId).order("ouvert_at", { ascending: false }).limit(100),
      ]);
      setSales((v.data ?? []) as Sale[]); setCancellations((a.data ?? []) as Cancellation[]); setSessions((s.data ?? []) as SessionRow[]);
      if (v.error) setError("L’historique des ventes n’est pas accessible à ce compte.");
    } else if (section === "notifications") {
      const [mine, pharmacy] = await Promise.all([
        sb.from("notifications").select("id,user_id,pharmacie_id,type,titre,corps,lu_le,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
        sb.from("notifications").select("id,user_id,pharmacie_id,type,titre,corps,lu_le,created_at").eq("pharmacie_id", pid).order("created_at", { ascending: false }).limit(100),
      ]);
      const rows = [...(mine.data ?? []), ...(pharmacy.data ?? [])] as Notice[];
      setNotifications(rows.filter((row, i) => rows.findIndex((item) => item.id === row.id) === i).sort((a, b) => b.created_at.localeCompare(a.created_at)));
      if (mine.error && pharmacy.error) setError("Les notifications ne sont pas accessibles à ce compte.");
    } else if (section === "profil" || section === "service") {
      const { data, error: sessionError } = await sb.from("caisses_sessions").select("id,caisse_id,ouvert_at,cloture_at,statut,fond_initial,total_theorique,total_compte,ecart").eq("ouvert_par", userId).order("ouvert_at", { ascending: false }).limit(30);
      const rows = (data ?? []) as SessionRow[];
      setSessions(rows);
      setSessionId(rows.find((row) => row.statut === "ouverte")?.id ?? "");
      if (sessionError) setError("Les sessions de caisse ne sont pas accessibles.");
    }
  }, [sb, section]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: auth, error: authError } = await sb.auth.getUser();
      if (authError || !auth.user) { if (alive) { setError("Connexion requise pour accéder au parcours caisse."); setLoading(false); } return; }
      const [{ data: p, error: profileError }, { data: activeRole, error: activeRoleError }, { data: activePharmacyId, error: activePharmacyError }] = await Promise.all([
        sb.from("profiles").select("id,role,fonction_interne,actif,first_name,last_name,phone,username").eq("id", auth.user.id).maybeSingle(),
        sb.rpc("naxa_business_function"),
        sb.rpc("naxa_active_role_pharmacy"),
      ]);
      if (profileError || activeRoleError || activePharmacyError || !p || p.actif !== true
        || activeRole !== "caisse" || typeof activePharmacyId !== "string") {
        if (alive) { setError("Accès réservé à une personne ayant le poste Caisse actif dans une pharmacie."); setLoading(false); } return;
      }
      const { data: pharmacy, error: pharmacyError } = await sb.from("pharmacies").select("id,nom,actif,visible_recherche").eq("id", activePharmacyId).maybeSingle();
      if (pharmacyError || !pharmacy || pharmacy.actif !== true || pharmacy.visible_recherche !== true) {
        if (alive) { setError("La pharmacie est inactive ou non publiée ; accès aux opérations refusé."); setLoading(false); } return;
      }
      if (!alive) return;
      setUid(auth.user.id); setAccount({ ...p, active_role: activeRole, pharmacie_id: activePharmacyId } as Account); setPharmacyId(pharmacy.id); setPharmacyName(pharmacy.nom ?? "Pharmacie");
      await loadSection(pharmacy.id, auth.user.id);
      if (alive) setLoading(false);
    })().catch(() => { if (alive) { setError("Erreur inattendue lors du chargement. Réessayez."); setLoading(false); } });
    return () => { alive = false; };
  }, [sb, loadSection]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLocaleLowerCase("fr");
    return clients.filter((client) => !q || [
      client.reference_client,
      clientName(client.client_id, clientIdentities),
      clientIdentities[client.client_id]?.phone,
      client.client_id,
    ].some((value) => String(value ?? "").toLocaleLowerCase("fr").includes(q)));
  }, [clients, clientIdentities, clientSearch]);

  const openCredits = useMemo(() => credits.filter((credit) => credit.actif && credit.solde > 0), [credits]);
  const filteredCredits = useMemo(() => {
    const q = creditSearch.trim().toLocaleLowerCase("fr");
    return openCredits.filter((credit) => !q || [
      clientName(credit.client_id, clientIdentities),
      clientIdentities[credit.client_id]?.phone,
      credit.client_id,
    ].some((value) => String(value ?? "").toLocaleLowerCase("fr").includes(q)));
  }, [openCredits, clientIdentities, creditSearch]);

  const reportSales = useMemo(() => {
    if (reportPeriod === "tout") return sales;
    const now = new Date();
    const start = new Date(now);
    if (reportPeriod === "jour") start.setHours(0, 0, 0, 0);
    else if (reportPeriod === "semaine") start.setDate(start.getDate() - 6);
    else start.setDate(start.getDate() - 29);
    return sales.filter((sale) => new Date(sale.paid_at || sale.created_at) >= start);
  }, [sales, reportPeriod]);

  const filteredSales = useMemo(() => sales.filter((sale) => {
    const q = search.trim().toLocaleLowerCase("fr");
    const matchesText = !q || [sale.numero_vente, sale.id, sale.mode_paiement, sale.statut].some((value) => String(value ?? "").toLocaleLowerCase("fr").includes(q));
    const saleDate = new Date(sale.paid_at || sale.created_at);
    const afterStart = !salesFrom || saleDate >= new Date(`${salesFrom}T00:00:00`);
    const beforeEnd = !salesTo || saleDate < new Date(`${salesTo}T23:59:59.999`);
    return matchesText && afterStart && beforeEnd && (statusFilter === "toutes" || sale.statut === statusFilter);
  }), [sales, search, statusFilter, salesFrom, salesTo]);

  async function openTicket(saleId: string) {
    setBusy(true); setError(""); setNotice(""); setTicketRows([]);
    const { data, error: ticketError } = await sb.rpc("vente_ticket", { p_vente: saleId });
    if (ticketError || !data?.length) setError("Ticket indisponible ou vente hors périmètre.");
    else setTicketRows(data as TicketRow[]);
    setBusy(false);
  }

  async function requestCancellation(saleId: string) {
    const reason = window.prompt("Motif de la demande d’annulation (3 caractères minimum) :");
    if (!reason || reason.trim().length < 3) { setNotice("Demande non envoyée : un motif de 3 caractères minimum est obligatoire."); return; }
    setBusy(true); setError(""); setNotice("");
    const { error: rpcError } = await sb.rpc("vente_annulation_demander", { p_vente: saleId, p_motif: reason.trim() });
    if (rpcError) setError(rpcError.message || "La demande d’annulation n’a pas pu être créée.");
    else { setNotice("Demande transmise. La vente reste inchangée jusqu’à la décision du rôle habilité."); await loadSection(pharmacyId, uid); }
    setBusy(false);
  }

  async function collectCredit(credit: CreditRow) {
    setCreditReceipt(null);
    const raw = window.prompt("Montant encaissé pour cette créance, en FCFA (entier) :", "");
    if (raw === null) return;
    const amount = Number(raw);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > credit.solde) { setError("Montant invalide : saisissez un entier positif inférieur ou égal au solde dû."); return; }
    const reference = window.prompt("Référence de paiement (facultative) :", "") ?? "";
    const motif = window.prompt("Motif du remboursement (facultatif ; encaissement en espèces uniquement) :", "") ?? "";
    setBusy(true); setError(""); setNotice("");
    const { data: operationId, error: rpcError } = await sb.rpc("client_credit_rembourser", { p_credit: credit.id, p_montant: amount, p_mode: "especes", p_reference: reference.trim() || null, p_motif: motif.trim() || null });
    if (rpcError || !operationId) setError(rpcError?.message || "Le remboursement n’a pas retourné de référence fiable.");
    else {
      const { data: refreshedCredit, error: balanceError } = await sb.from("client_credits").select("solde").eq("id", credit.id).maybeSingle();
      setCreditReceipt({ operationId: String(operationId), creditId: credit.id, clientId: credit.client_id, amount, reference: reference.trim() || null, method: motif.trim() || "Remboursement en espèces", remainingBalance: balanceError || refreshedCredit?.solde == null ? null : Number(refreshedCredit.solde), issuedAt: new Date().toISOString(), cashierName: displayName(account), pharmacyName });
      setNotice("Remboursement enregistré. Le reçu est disponible ci-dessous ; le solde affiché est recalculé après rechargement.");
      await loadSection(pharmacyId, uid);
    }
    setBusy(false);
  }

  async function markRead(row: Notice) {
    if (!row.user_id || row.user_id !== uid || row.lu_le) return;
    setBusy(true);
    const { error: rpcError } = await sb.rpc("mark_user_notification_read", { p_notification_id: row.id });
    if (rpcError) setError("Impossible de marquer cette notification personnelle comme lue.");
    else setNotifications((current) => current.map((item) => item.id === row.id ? { ...item, lu_le: new Date().toISOString() } : item));
    setBusy(false);
  }

  async function unlock() {
    if (!sessionId || !/^\d{6,8}$/.test(pin)) { setError("Aucune session ouverte détectée ou PIN invalide (6 à 8 chiffres)."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/caisse/security", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "authorize-pin", sessionId, pin }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Vérification du PIN refusée.");
      setLocked(false); setPin(""); setNotice("PIN validé côté serveur.");
    } catch (e) { setError(e instanceof Error ? e.message : "PIN invalide."); }
    finally { setBusy(false); }
  }

  const title = menu.find((item) => item.id === section)?.label ?? "Parcours caisse";
  return <><CaisseWorkspaceShell sessionOpen={sessions.some((item) => !item.cloture_at)} creditsDue={credits.filter((item) => item.actif && item.solde > 0).length} pharmacyName={pharmacyName}>
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-naxa-green-900 px-4 py-4 text-white shadow-sm">
      <div><a href="/pharmacie/caisse" className="text-sm underline underline-offset-4">← Retour à l’encaissement</a><h1 className="mt-1 text-xl font-extrabold">Caisse · {title}</h1><p className="text-sm text-white/80">{pharmacyName}</p></div>
      <span className="rounded-full bg-white/15 px-3 py-2 text-sm">{displayName(account)}</span>
    </header>
    <CaisseSectionTabs section={section} />
    {loading && <section className="carte" role="status">Chargement des données réelles et vérification des autorisations…</section>}
    {!loading && error && <p role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    {!loading && notice && <p role="status" aria-live="polite" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {!loading && !error && <>
      <p className="mb-4 text-sm text-slate-600">{menu.find((item) => item.id === section)?.description}</p>
      {section === "clients" && creditReceipt && <section className="carte credit-repayment-receipt mb-4 space-y-3 border-2 border-dashed border-[#0B3D26] bg-white text-[#0B3D26]">
        <TicketPharmacyLogo pharmacieId={pharmacyId} />
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-widest">Reçu de remboursement de crédit</p><h2 className="text-xl font-black">Remboursement confirmé</h2><p className="text-sm">{creditReceipt.pharmacyName}</p></div><button type="button" className="btn btn-vert print:hidden" onClick={() => void printAfterImagesLoaded(document.querySelector(".credit-repayment-receipt") ?? document)}>Imprimer le reçu</button></div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Référence du reçu</dt><dd className="break-all font-mono font-bold">{creditReceipt.operationId}</dd></div>
          <div><dt className="text-slate-500">Date et heure</dt><dd className="font-semibold">{dateLabel(creditReceipt.issuedAt)}</dd></div>
          <div><dt className="text-slate-500">Client</dt><dd className="font-semibold">{clientName(creditReceipt.clientId, clientIdentities)}</dd></div>
          <div><dt className="text-slate-500">Crédit concerné</dt><dd className="break-all font-mono">{creditReceipt.creditId}</dd></div>
          <div><dt className="text-slate-500">Caissier / caissière</dt><dd className="font-semibold">{creditReceipt.cashierName}</dd></div>
          <div><dt className="text-slate-500">Motif enregistré</dt><dd className="font-semibold">{creditReceipt.method}</dd></div>
          <div><dt className="text-slate-500">Référence de paiement</dt><dd className="break-all font-semibold">{creditReceipt.reference || "Non fournie"}</dd></div>
        </dl>
        <div className="border-t border-dashed border-slate-300 pt-3"><div className="flex justify-between gap-3"><span>Montant reçu</span><strong>{fcfa(creditReceipt.amount)}</strong></div><div className="mt-1 flex justify-between gap-3"><span>Solde après opération</span><strong>{creditReceipt.remainingBalance == null ? "À actualiser depuis le journal de crédit" : fcfa(creditReceipt.remainingBalance)}</strong></div></div>
        <p className="text-xs text-slate-500">Reçu interne lié à l’opération de crédit enregistrée. Il ne remplace pas un ticket de vente POS. La date et la référence de l’opération font foi dans le journal de crédit.</p>
      </section>}
      {section === "clients" && <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={"Clients connus · " + filteredClients.length}><p className="text-sm text-slate-600">Références déjà enregistrées. La caisse ne crée pas de compte d’authentification à la place du client.</p><input className="champ w-full" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Rechercher par nom, téléphone, identifiant ou référence" aria-label="Rechercher un client" />{filteredClients.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Référence</th><th className="p-2 text-left">Client</th><th className="p-2">État</th></tr></thead><tbody>{filteredClients.map((c) => <tr key={c.id} className="border-t"><td className="p-2">{c.reference_client || "—"}</td><td className="p-2">{clientName(c.client_id, clientIdentities)}</td><td className="p-2">{c.actif ? "Actif" : "Inactif"}</td></tr>)}</tbody></table></div> : <Empty>Aucune fiche client ne correspond à la recherche. Aucune donnée fictive n’est affichée.</Empty>}</Panel>
        <Panel title={"Crédits à recouvrer · " + openCredits.length}><input className="champ w-full" value={creditSearch} onChange={(e) => setCreditSearch(e.target.value)} placeholder="Rechercher un débiteur" aria-label="Rechercher un crédit client" />{filteredCredits.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Client</th><th className="p-2 text-right">Solde</th><th className="p-2 text-right">Plafond</th><th className="p-2">Action</th></tr></thead><tbody>{filteredCredits.map((c) => <tr key={c.id} className="border-t"><td className="p-2">{clientName(c.client_id, clientIdentities)}</td><td className="p-2 text-right font-semibold">{fcfa(c.solde)}</td><td className="p-2 text-right">{fcfa(c.plafond)}</td><td className="p-2 text-center"><button className="btn btn-clair" disabled={busy} onClick={() => void collectCredit(c)}>Encaisser</button></td></tr>)}</tbody></table></div> : <Empty>{openCredits.length ? "Aucun crédit ne correspond à la recherche." : "Aucune créance ouverte accessible. Aucun montant fictif n’est affiché."}</Empty>}</Panel>
      </div>}
      {section === "assurances" && <div className="space-y-4">
        <Panel title={"Couvertures accessibles · " + coverages.length}>{coverages.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Assureur</th><th className="p-2 text-left">Adhérent</th><th className="p-2">Fin</th><th className="p-2 text-right">Taux</th><th className="p-2">État</th></tr></thead><tbody>{coverages.map((c) => <tr key={c.id} className="border-t"><td className="p-2">{insurerNames[c.assureur_id] || "Assureur non chargé"}</td><td className="p-2">{c.numero_adherent}</td><td className="p-2">{c.date_fin || "Non renseignée"}</td><td className="p-2 text-right">{c.taux_prise_en_charge == null ? "Non renseigné" : c.taux_prise_en_charge + " %"}</td><td className="p-2">{c.actif ? "Active" : "Inactive"}</td></tr>)}</tbody></table></div> : <Empty>Aucune couverture visible pour ce compte ; la consultation est limitée par les règles RLS.</Empty>}</Panel>
        <Panel title={"Dossiers de tiers payant · " + insuranceCases.length}>{insuranceCases.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Statut</th><th className="p-2">Client</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Part assureur</th><th className="p-2">Date</th></tr></thead><tbody>{insuranceCases.map((c) => <tr key={c.id} className="border-t"><td className="p-2">{c.statut}</td><td className="p-2">{clientName(c.client_id, clientIdentities)}</td><td className="p-2 text-right">{c.montant_total == null ? "—" : fcfa(Number(c.montant_total))}</td><td className="p-2 text-right">{c.montant_prise_en_charge == null ? "—" : fcfa(Number(c.montant_prise_en_charge))}</td><td className="p-2">{dateLabel(c.created_at)}</td></tr>)}</tbody></table></div> : <Empty>Aucun dossier de tiers payant créé par ce compte.</Empty>}</Panel>
        <p className="text-xs text-slate-500">La caisse consulte les dossiers ; elle ne modifie ni plafonds ni décisions de remboursement. Les assureurs ne sont pas vérifiés en ligne.</p>
      </div>}
      {section === "historique" && <Panel title={"Historique · " + filteredSales.length + " résultat(s)"}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><input className="champ" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ticket, identifiant, statut ou mode" aria-label="Rechercher une vente" /><select className="champ" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrer par statut"><option value="toutes">Tous les statuts</option><option value="payee">Payées</option><option value="brouillon">Brouillons</option><option value="annulee">Annulées</option></select><label className="text-xs font-semibold text-slate-600">Du<input className="champ mt-1 w-full" type="date" value={salesFrom} max={salesTo || undefined} onChange={(e) => setSalesFrom(e.target.value)} aria-label="Date de début" /></label><label className="text-xs font-semibold text-slate-600">Au<input className="champ mt-1 w-full" type="date" value={salesTo} min={salesFrom || undefined} onChange={(e) => setSalesTo(e.target.value)} aria-label="Date de fin" /></label></div>
        {filteredSales.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Ticket</th><th className="p-2 text-left">Date</th><th className="p-2 text-right">Total</th><th className="p-2">Statut</th><th className="p-2">Action</th></tr></thead><tbody>{filteredSales.map((sale) => <tr key={sale.id} className="border-t"><td className="p-2">{sale.numero_vente || sale.id.slice(0, 8)}</td><td className="p-2">{dateLabel(sale.paid_at || sale.created_at)}</td><td className="p-2 text-right">{fcfa(sale.total_net)}</td><td className="p-2">{sale.statut}</td><td className="p-2 text-center"><div className="flex flex-wrap justify-center gap-1"><button className="btn btn-clair" disabled={busy || sale.statut !== "payee"} onClick={() => void openTicket(sale.id)}>Détail / duplicata</button>{sale.statut === "payee" && <button className="btn btn-clair" disabled={busy} onClick={() => void requestCancellation(sale.id)}>Demander annulation</button>}</div></td></tr>)}</tbody></table></div> : <Empty>Aucune vente ne correspond aux filtres. Les données affichées proviennent uniquement de la base.</Empty>}
      </Panel>}
      {ticketRows.length > 0 && section === "historique" && <section className="carte ticket-detail-print mt-4 space-y-3"><TicketPharmacyLogo pharmacieId={pharmacyId} /><div className="flex items-center justify-between gap-2"><div><p className="text-xs font-bold tracking-widest">DUPLICATA</p><h2 className="text-lg font-extrabold">Ticket {ticketRows[0].numero_vente}</h2><p className="text-xs text-slate-500">{dateLabel(ticketRows[0].paid_at || ticketRows[0].created_at)}</p></div><button className="btn btn-vert print:hidden" onClick={() => void printAfterImagesLoaded(document.querySelector(".ticket-detail-print") ?? document)}>Imprimer le duplicata</button></div><div className="border-t border-dashed pt-3">{ticketRows.filter((row) => row.produit_id).map((row, index) => <div key={row.produit_id + "-" + index} className="flex justify-between gap-3 py-1 text-sm"><span>{row.produit_nom}{row.produit_dosage ? " · " + row.produit_dosage : ""} × {row.quantite}</span><span>{fcfa(row.total_ligne ?? 0)}</span></div>)}</div><div className="border-t border-dashed pt-3 text-sm"><div className="flex justify-between"><span>Sous-total</span><span>{fcfa(ticketRows[0].total_brut)}</span></div>{ticketRows[0].remise > 0 && <div className="flex justify-between"><span>Remise</span><span>-{fcfa(ticketRows[0].remise)}</span></div>}<div className="mt-2 flex justify-between text-lg font-extrabold"><span>Total</span><span>{fcfa(ticketRows[0].total_net)}</span></div><p className="mt-2">Paiement : {ticketRows[0].mode_paiement || "—"}</p></div></section>}
      {section === "annulations" && <Panel title={"Mes demandes d’annulation · " + cancellations.length}>{cancellations.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Vente</th><th className="p-2 text-left">Motif</th><th className="p-2">Statut</th><th className="p-2">Demandée</th><th className="p-2">Décision</th></tr></thead><tbody>{cancellations.map((c) => <tr key={c.id} className="border-t"><td className="p-2 font-mono text-xs">{c.vente_id.slice(0, 8)}</td><td className="p-2">{c.motif}</td><td className="p-2">{c.statut}</td><td className="p-2">{dateLabel(c.created_at)}</td><td className="p-2">{dateLabel(c.decidee_at)}</td></tr>)}</tbody></table></div> : <Empty>Aucune demande d’annulation créée par ce compte.</Empty>}<p className="text-sm text-slate-600">Une demande ne modifie pas directement la vente. La décision est réservée à un rôle habilité et distinct du demandeur.</p></Panel>}
      {section === "rapports" && <div className="space-y-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><label className="text-sm font-semibold">Période des indicateurs<select className="champ mt-1 block w-full sm:w-56" value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value as "jour" | "semaine" | "mois" | "tout")}><option value="jour">Aujourd’hui</option><option value="semaine">7 derniers jours</option><option value="mois">30 derniers jours</option><option value="tout">Toutes les ventes chargées</option></select></label><p className="text-xs text-slate-500">Périmètre : ventes personnelles parmi les 500 plus récentes chargées. Les indicateurs ne représentent pas l’ensemble de la pharmacie.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        ["Ventes dans la période", String(reportSales.length)], ["Ventes payées", String(reportSales.filter((v) => v.statut === "payee").length)],
        ["Montant des ventes payées", fcfa(reportSales.filter((v) => v.statut === "payee").reduce((sum, v) => sum + Number(v.total_net || 0), 0))], ["Sessions consultables", String(sessions.length)],
      ].map(([label, value]) => <article key={label} className="carte"><p className="text-sm text-slate-600">{label}</p><p className="mt-2 text-xl font-extrabold">{value}</p></article>)}</div><Panel title="Sessions récentes"><p className="text-sm text-slate-600">Périmètre limité aux sessions ouvertes par ce compte ; ventes limitées aux 500 plus récentes.</p>{sessions.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Ouverture</th><th className="p-2">État</th><th className="p-2 text-right">Fond</th><th className="p-2 text-right">Théorique</th><th className="p-2 text-right">Écart</th></tr></thead><tbody>{sessions.map((s) => <tr key={s.id} className="border-t"><td className="p-2">{dateLabel(s.ouvert_at)}</td><td className="p-2">{s.statut}</td><td className="p-2 text-right">{fcfa(s.fond_initial)}</td><td className="p-2 text-right">{fcfa(s.total_theorique)}</td><td className="p-2 text-right">{s.ecart == null ? "—" : fcfa(s.ecart)}</td></tr>)}</tbody></table></div> : <Empty>Aucune session accessible.</Empty>}</Panel></div>}
      {section === "profil" && <div className={(textSize === "grand" ? "space-y-4 text-lg" : "space-y-4") + (compactDisplay ? " [&_td]:!p-1 [&_th]:!p-1" : "")}>
        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Onglets du profil">
          {([
            ["compte", "Mon compte"],
            ["securite", "Mot de passe & PIN"],
            ["preferences", "Affichage"],
            ["activite", "Activité récente"],
          ] as const).map(([id, label]) => <button key={id} type="button" aria-current={profileTab === id ? "page" : undefined} onClick={() => setProfileTab(id)} className={"min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-bold " + (profileTab === id ? "bg-[#0B3D26] text-white" : "border border-slate-200 bg-white text-slate-700")}>{label}</button>)}
        </nav>
        {profileTab === "compte" && <Panel title="Informations du compte"><dl className="grid gap-3 sm:grid-cols-2">{[["Nom", displayName(account)],["Identifiant", account?.username || "—"],["Téléphone", account?.phone || "Non renseigné"],["Poste actif", account?.active_role || account?.fonction_interne || account?.role || "—"],["Pharmacie", pharmacyName],["Compte", account?.actif ? "Actif" : "Inactif"]].map(([label, value]) => <div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl><p className="text-xs text-slate-500">Les informations d’identité sont affichées en lecture seule : leur modification doit rester dans le parcours d’administration autorisé.</p></Panel>}
        {profileTab === "securite" && <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Changer le mot de passe"><p className="text-sm text-slate-600">Le changement est transmis à Supabase Auth. Utilisez un mot de passe long et unique.</p><label className="block text-sm font-semibold">Nouveau mot de passe<input className="champ mt-1 w-full" type="password" autoComplete="new-password" minLength={10} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label><label className="mt-3 block text-sm font-semibold">Confirmer le mot de passe<input className="champ mt-1 w-full" type="password" autoComplete="new-password" minLength={10} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label><button type="button" className="btn btn-vert mt-3" disabled={passwordBusy || !newPassword || !confirmPassword} onClick={() => void changePassword()}>{passwordBusy ? "Mise à jour…" : "Mettre à jour le mot de passe"}</button></Panel>
          <Panel title="Vérification du PIN de reprise"><p className="text-sm text-slate-600">Le PIN doit être configuré par le Promoteur. Le serveur applique les contrôles de session et la limitation des tentatives.</p>{!locked ? <button className="btn btn-vert" onClick={() => setLocked(true)}>Ouvrir la vérification PIN</button> : <div className="space-y-3"><p className="text-sm">Session ouverte détectée : {sessionId ? sessionId.slice(0, 8) + "…" : "aucune"}</p><label className="block text-sm font-semibold">PIN<input className="champ mt-1 w-full" value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" type="password" maxLength={8} autoComplete="off" /></label><button className="btn btn-vert" disabled={busy || !sessionId} onClick={() => void unlock()}>Vérifier le PIN</button><button className="btn btn-clair ml-2" onClick={() => { setLocked(false); setPin(""); }}>Annuler</button></div>}</Panel>
        </div>}
        {profileTab === "preferences" && <Panel title="Préférences d’affichage"><p className="text-sm text-slate-600">Ces réglages sont enregistrés localement sur cet appareil et ne modifient ni les données métier ni les droits du compte.</p><label className="flex items-center justify-between gap-3 rounded-xl border p-3"><span><span className="block font-semibold">Taille du texte</span><span className="text-sm text-slate-500">Améliore la lisibilité de cet espace</span></span><select className="champ max-w-40" value={textSize} onChange={(e) => setTextSize(e.target.value as "normal" | "grand")}><option value="normal">Normale</option><option value="grand">Grande</option></select></label><label className="flex items-center justify-between gap-3 rounded-xl border p-3"><span><span className="block font-semibold">Affichage compact</span><span className="text-sm text-slate-500">Réduit les espacements des tableaux de ce parcours</span></span><input type="checkbox" checked={compactDisplay} onChange={(e) => setCompactDisplay(e.target.checked)} /></label><button type="button" className="btn btn-vert" disabled={!preferencesReady} onClick={() => void saveProfilePreferences()}>Enregistrer les préférences</button></Panel>}
        {profileTab === "activite" && <Panel title="Activité récente"><p className="text-sm text-slate-600">Les sessions de caisse sont consultables ci-dessous. L’historique des connexions Auth (heure, appareil et adresse IP) n’est pas exposé par les tables et API vérifiées ; aucune connexion fictive n’est affichée.</p>{sessions.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Ouverture du service</th><th className="p-2">État</th><th className="p-2 text-left">Clôture</th></tr></thead><tbody>{sessions.slice(0, 10).map((s) => <tr key={s.id} className="border-t"><td className="p-2">{dateLabel(s.ouvert_at)}</td><td className="p-2">{s.statut}</td><td className="p-2">{dateLabel(s.cloture_at)}</td></tr>)}</tbody></table></div> : <Empty>Aucune session de caisse enregistrée pour ce compte.</Empty>}</Panel>}
      </div>}
      {section === "notifications" && <Panel title={"Notifications · " + notifications.length}>{notifications.length ? <ul className="space-y-2">{notifications.map((n) => <li key={n.id} className={"rounded-xl border p-3 " + (n.lu_le ? "border-slate-200 bg-white" : "border-yellow-300 bg-yellow-50")}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{n.titre}</p><p className="mt-1 text-sm">{n.corps}</p><p className="mt-2 text-xs text-slate-500">{n.type} · {dateLabel(n.created_at)} · {n.lu_le ? "Lue" : "Non lue"}</p></div>{n.user_id === uid && !n.lu_le && <button className="btn btn-clair" disabled={busy} onClick={() => void markRead(n)}>Marquer lue</button>}</div></li>)}</ul> : <Empty>Aucune notification pour ce compte ou cette pharmacie.</Empty>}<p className="text-xs text-slate-500">Les notifications de pharmacie sont consultables ; seules les notifications personnelles disposent ici de l’action de lecture autorisée par la base.</p></Panel>}
      {section === "service" && <Panel title="Prise / fin de service"><p className="text-sm text-slate-600">L’ouverture et la clôture restent pilotées par le moteur de caisse existant.</p>{sessions.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Ouverture</th><th className="p-2">État</th><th className="p-2 text-right">Fond initial</th><th className="p-2 text-left">Clôture</th></tr></thead><tbody>{sessions.map((s) => <tr key={s.id} className="border-t"><td className="p-2">{dateLabel(s.ouvert_at)}</td><td className="p-2">{s.statut}</td><td className="p-2 text-right">{fcfa(s.fond_initial)}</td><td className="p-2">{dateLabel(s.cloture_at)}</td></tr>)}</tbody></table></div> : <Empty>Aucune session enregistrée pour ce compte.</Empty>}<a className="btn btn-vert inline-block" href="/pharmacie/caisse">Ouvrir le poste de caisse</a></Panel>}
    </>}
    </CaisseWorkspaceShell>
    <style jsx global>{`@media print { body * { visibility: hidden !important; } .ticket-detail-print, .ticket-detail-print *, .credit-repayment-receipt, .credit-repayment-receipt * { visibility: visible !important; } .ticket-detail-print, .credit-repayment-receipt { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
  </>;
}
