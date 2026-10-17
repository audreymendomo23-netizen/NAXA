"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { NAXA_EMAIL, NAXA_WHATSAPP, lienGmail, lienWhatsApp } from "@/lib/contact-naxa";
import { Logo } from "@/components/Logo";
import SuppressionCompteClient from "@/components/client/SuppressionCompteClient";

type Prefs = { notif_messages: boolean; notif_reservations: boolean; anonyme_defaut: boolean; note_app: number | null; avis_app: string | null };
const defaultPrefs: Prefs = { notif_messages: true, notif_reservations: true, anonyme_defaut: true, note_app: null, avis_app: "" };
type LigneRecu = { reservation_id: string; produit_id: string; medicament: string; quantite: number; prix_unitaire: number; total_ligne: number; total_transaction: number; reference_paiement: string | null; achat_le: string | null; reservation_creee_le: string; pharmacie: string; ville: string; statut: string };
type NotificationSettings = { pharmacyReplies: boolean; orderStatus: boolean; promotions: boolean; treatmentReminders: boolean; channels: { push: boolean; sms: boolean; email: boolean } };
const NOTIF_KEY = "naxa-client-notifications-v1";
const defaultNotifications: NotificationSettings = { pharmacyReplies: true, orderStatus: true, promotions: false, treatmentReminders: true, channels: { push: false, sms: false, email: true } };
function decoderClePush(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const raw = atob(padded);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}
async function activerPushProfil(userId: string): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || Notification.permission !== "granted") return false;
  const registration = await navigator.serviceWorker.register("/naxa-push-sw.js", { scope: "/" });
  const response = await fetch("/api/posologie/push-key", { cache: "no-store" });
  if (!response.ok) throw new Error("Le service Push NAXA n’est pas configuré.");
  const { publicKey } = await response.json() as { publicKey: string };
  const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
    userVisibleOnly: true, applicationServerKey: decoderClePush(publicKey)
  });
  const { error } = await supabaseBrowser().from("naxa_push_subscriptions").upsert({
    endpoint: subscription.endpoint, user_id: userId, subscription: subscription.toJSON(), updated_at: new Date().toISOString()
  }, { onConflict: "endpoint" });
  if (error) throw error;
  return true;
}
const titles: Record<string, string> = { factures: "Factures", aide: "Centre d’aide", contact: "Contacter NAXA", noter: "Noter l’application", notifications: "Notifications", confidentialite: "Confidentialité", suppression: "Supprimer le compte" };
const statusLabels: Record<string, string> = { payee: "Payée", retiree: "Retirée", confirmee: "Confirmée", en_attente: "En attente", expiree: "Expirée", annulee: "Annulée" };
const faqCategories = ["Tout", "Commande", "Paiement", "Livraison", "Ordonnance", "Compte"];
const faqCategoriesEn: Record<string, string> = { Tout: "All", Commande: "Orders", Paiement: "Payment", Livraison: "Delivery", Ordonnance: "Prescription", Compte: "Account" };
const faqs = [
  { category: "Compte", question: "Comment modifier mes informations ?", answer: "Ouvrez Profil, puis touchez votre nom ou votre photo pour modifier vos coordonnées.", questionEn: "How do I update my information?", answerEn: "Open Profile, then tap your name or photo to update your details." },
  { category: "Ordonnance", question: "Comment trouver un médicament ?", answer: "Recherchez le nom du médicament depuis l’accueil. Consultez sa fiche et vérifiez sa disponibilité auprès de la pharmacie.", questionEn: "How do I find a medicine?", answerEn: "Search for the medicine from the home page. Check its details and confirm availability with the pharmacy." },
  { category: "Commande", question: "Comment réserver un médicament ?", answer: "Choisissez le produit et la pharmacie, puis suivez les étapes proposées. La réservation dépend de la confirmation et du stock de la pharmacie.", questionEn: "How do I reserve a medicine?", answerEn: "Choose the product and pharmacy, then follow the steps shown. Reservation depends on pharmacy confirmation and stock." },
  { category: "Paiement", question: "Comment payer ma réservation ?", answer: "Les modalités de paiement sont confirmées par la pharmacie. NAXA ne conserve ni code secret ni solde Mobile Money.", questionEn: "How do I pay for my reservation?", answerEn: "The pharmacy confirms the payment method. NAXA never stores your secret code or Mobile Money balance." },
  { category: "Commande", question: "Où suivre mes commandes ?", answer: "Ouvrez Profil puis Historique, ou la rubrique Commandes dans la barre de navigation.", questionEn: "Where can I track my orders?", answerEn: "Open Profile and then History, or select Orders in the bottom navigation." },
  { category: "Livraison", question: "Les stocks et les prix sont-ils garantis ?", answer: "Les stocks et les prix peuvent changer. La pharmacie confirme la disponibilité et les conditions avant le retrait ou la vente.", questionEn: "Are stock and prices guaranteed?", answerEn: "Stock and prices may change. The pharmacy confirms availability and conditions before pickup or sale." },
  { category: "Ordonnance", question: "NAXA donne-t-il des conseils de posologie ?", answer: "Non. NAXA ne remplace pas un professionnel de santé et ne fournit ni diagnostic ni conseil de dosage. Demandez conseil à un pharmacien ou à un médecin.", questionEn: "Does NAXA provide dosage advice?", answerEn: "No. NAXA does not replace a healthcare professional and does not provide diagnoses or dosage advice. Ask a pharmacist or doctor." },
  { category: "Compte", question: "Comment supprimer mon compte ?", answer: "Dans Profil, ouvrez Paramètres puis Supprimer le compte. La suppression exige le mot de passe du compte et une confirmation.", questionEn: "How do I delete my account?", answerEn: "In Profile, open Settings and choose Delete account. Your password and confirmation are required." }
];
const money = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value) || 0) + " FCFA";
const dateLabel = (value: string | null | undefined) => {
  if (!value) return "Date non disponible";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date non disponible" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
};

export default function ProfilSectionPage() {
  const params = useParams<{ section: string }>();
  const section = params.section;
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [nom, setNom] = useState("Client");
  const [email, setEmail] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const [toast, setToast] = useState("");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [reçus, setRecus] = useState<LigneRecu[]>([]);
  const [chargementRecus, setChargementRecus] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [faqQuery, setFaqQuery] = useState("");
  const [faqCategory, setFaqCategory] = useState("Tout");
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [contactMode, setContactMode] = useState<"options" | "message">("options");
  const [subject, setSubject] = useState("Demande d’aide");
  const [orderNumber, setOrderNumber] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [notifications, setNotifications] = useState<NotificationSettings>(defaultNotifications);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [notificationsDirty, setNotificationsDirty] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const groupedInvoices = useMemo(() => {
    const grouped = new Map<string, LigneRecu[]>();
    for (const line of reçus) grouped.set(line.reservation_id, [...(grouped.get(line.reservation_id) ?? []), line]);
    return [...grouped.entries()].sort((a, b) => new Date(b[1][0].achat_le ?? b[1][0].reservation_creee_le).getTime() - new Date(a[1][0].achat_le ?? a[1][0].reservation_creee_le).getTime());
  }, [reçus]);
  const selectedLines = groupedInvoices.find(([id]) => id === selectedInvoice);
  const filteredFaqs = faqs.filter(item => (faqCategory === "Tout" || item.category === faqCategory) && (!faqQuery.trim() || (item.question + " " + item.answer + " " + item.questionEn + " " + item.answerEn + " " + item.category).toLowerCase().includes(faqQuery.trim().toLowerCase())));

  function flash(text: string) { setToast(text); window.setTimeout(() => setToast(""), 2800); }

  useEffect(() => {
    const readLanguage = () => {
      try { setLanguage(window.localStorage.getItem("naxa-langue") === "en" ? "en" : "fr"); } catch { setLanguage("fr"); }
    };
    readLanguage();
    window.addEventListener("naxa-language-updated", readLanguage);
    window.addEventListener("storage", readLanguage);
    return () => { window.removeEventListener("naxa-language-updated", readLanguage); window.removeEventListener("storage", readLanguage); };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const sb = supabaseBrowser();
      const { data: { user }, error: userError } = await sb.auth.getUser();
      if (!active) return;
      if (userError || !user) { router.replace("/connexion?retour=" + encodeURIComponent("/client/profil/" + section)); return; }
      setUserId(user.id); setEmail(user.email ?? "");
      setNom(String(user.user_metadata?.full_name || user.user_metadata?.name || "Client"));
      const { data } = await sb.from("client_preferences").select("*").eq("user_id", user.id).maybeSingle();
      if (!active) return;
      if (data) { setPrefs({ ...defaultPrefs, ...data }); setRating(Number(data.note_app) || 0); setReview(typeof data.avis_app === "string" ? data.avis_app : ""); }
      if (typeof Notification !== "undefined") setPermission(Notification.permission); else setPermission("unsupported");
    })();
    return () => { active = false; };
  }, [router, section]);

  useEffect(() => {
    if (section !== "factures" || !userId) return;
    let active = true; setChargementRecus(true);
    void (async () => {
      const { data, error } = await supabaseBrowser().from("client_achats").select("reservation_id,produit_id,medicament,quantite,prix_unitaire,total_ligne,total_transaction,reference_paiement,achat_le,reservation_creee_le,pharmacie,ville,statut").eq("client_id", userId).in("statut", ["payee", "retiree"]).order("achat_le", { ascending: false, nullsFirst: false }).limit(500);
      if (!active) return;
      if (error) setErreur("Impossible de charger les reçus. Vérifiez que l’historique des achats est disponible, puis réessayez.");
      else { const rows = (data ?? []) as LigneRecu[]; setRecus(rows);  }
      setChargementRecus(false);
    })();
    return () => { active = false; };
  }, [section, userId]);

  useEffect(() => {
    if (section !== "notifications" || !userId) return;
    try {
      const saved = window.localStorage.getItem(NOTIF_KEY);
      const parsed = saved ? JSON.parse(saved) as Partial<NotificationSettings> : {};
      setNotifications({
        ...defaultNotifications,
        pharmacyReplies: typeof parsed.pharmacyReplies === "boolean" ? parsed.pharmacyReplies : prefs.notif_messages,
        orderStatus: typeof parsed.orderStatus === "boolean" ? parsed.orderStatus : prefs.notif_reservations,
        promotions: typeof parsed.promotions === "boolean" ? parsed.promotions : false,
        treatmentReminders: typeof parsed.treatmentReminders === "boolean" ? parsed.treatmentReminders : true,
        channels: { ...defaultNotifications.channels, ...(parsed.channels ?? {}) }
      });
    } catch { setNotifications({ ...defaultNotifications, pharmacyReplies: prefs.notif_messages, orderStatus: prefs.notif_reservations }); }
    setNotificationsLoaded(true);
  }, [section, userId, prefs.notif_messages, prefs.notif_reservations]);

  useEffect(() => {
    if (section !== "notifications" || !userId || !notificationsLoaded || !notificationsDirty) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        try { window.localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications)); } catch { /* Les réglages restent actifs pendant cette visite. */ }
        const { error } = await supabaseBrowser().from("client_preferences").upsert({ user_id: userId, notif_messages: notifications.pharmacyReplies, notif_reservations: notifications.orderStatus, updated_at: new Date().toISOString() });
        if (error) flash("Réglages appliqués sur cet appareil, mais la synchronisation du compte a échoué.");
        else { flash("Préférences de notification enregistrées."); setNotificationsDirty(false); }
      })();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [section, userId, notificationsLoaded, notificationsDirty, notifications]);

  async function saveReview() {
    if (!userId || rating < 1 || busy) return;
    setBusy(true); setErreur("");
    const { error } = await supabaseBrowser().from("client_preferences").upsert({ user_id: userId, note_app: rating, avis_app: review.trim(), updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) setErreur("Votre avis n’a pas pu être enregistré. Réessayez."); else flash("✓ Merci pour votre avis !");
  }

  async function savePrivacy() {
    if (!userId || busy) return;
    setBusy(true); setErreur("");
    const { error } = await supabaseBrowser().from("client_preferences").upsert({ user_id: userId, anonyme_defaut: prefs.anonyme_defaut, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) setErreur("Le réglage de confidentialité n’a pas pu être enregistré."); else flash("Préférence de confidentialité enregistrée.");
  }

  async function changePassword() {
    setErreur("");
    if (newPassword.length < 8) { setErreur("Le nouveau mot de passe doit contenir au moins 8 caractères."); return; }
    if (newPassword !== confirmPassword) { setErreur("Les deux mots de passe ne correspondent pas."); return; }
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) { setErreur("Le mot de passe n’a pas pu être modifié. Vérifiez votre session et réessayez."); return; }
    setNewPassword(""); setConfirmPassword(""); flash("Mot de passe modifié.");
  }

  async function exportData() {
    if (!userId || exportBusy) return;
    setExportBusy(true); setErreur("");
    const sb = supabaseBrowser();
    const [profile, preferences, reservations, purchases] = await Promise.all([
      sb.from("profiles").select("*").eq("id", userId).maybeSingle(),
      sb.from("client_preferences").select("*").eq("user_id", userId).maybeSingle(),
      sb.from("reservations").select("id,statut,total,created_at,expires_at,paiement_ref,pharmacie_id,reservation_items(quantite,prix_unitaire,produits(nom,dci,dosage,forme))").eq("client_id", userId).order("created_at", { ascending: false }).limit(1000),
      sb.from("client_achats").select("*").eq("client_id", userId).limit(1000)
    ]);
    if (profile.error || preferences.error || reservations.error || purchases.error) { setExportBusy(false); setErreur("L’export n’a pas pu être préparé. Réessayez plus tard."); return; }
    const payload = { exporte_le: new Date().toISOString(), compte: { nom, email }, profil: profile.data, preferences: preferences.data, reservations: reservations.data ?? [], historique_achats: purchases.error ? [] : (purchases.data ?? []) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "naxa-mes-donnees.json"; anchor.click(); URL.revokeObjectURL(url);
    setExportBusy(false); setShowExportConfirm(false); flash("Export de vos données téléchargé.");
  }

  function submitContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) { setErreur("Renseignez le sujet et votre message."); return; }
    const body = ["Bonjour NAXA,", "", "Nom du compte : " + nom, "E-mail du compte : " + email, orderNumber.trim() ? "Numéro de commande : " + orderNumber.trim() : "", "", message.trim(), "", "Envoyé depuis l’espace client NAXA."].filter(Boolean).join("\n");
    window.location.href = "mailto:" + NAXA_EMAIL + "?subject=" + encodeURIComponent("[NAXA] " + subject.trim()) + "&body=" + encodeURIComponent(body);
    flash("Votre application e-mail va s’ouvrir pour envoyer le message.");
  }

  async function shareInvoice(id: string, lines: LigneRecu[]) {
    const first = lines[0];
    const text = ["Reçu récapitulatif NAXA", "Référence : " + id, "Pharmacie : " + first.pharmacie, "Date : " + dateLabel(first.achat_le ?? first.reservation_creee_le), ...lines.map(line => line.quantite + " × " + line.medicament + " — " + money(line.total_ligne)), "Total : " + money(first.total_transaction)].join("\n");
    try {
      if (navigator.share) await navigator.share({ title: "Reçu NAXA", text });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); flash("Récapitulatif copié pour le partager."); }
      else window.location.href = "mailto:?subject=" + encodeURIComponent("Reçu NAXA") + "&body=" + encodeURIComponent(text);
    } catch { /* L’utilisateur peut fermer la feuille de partage sans erreur. */ }
  }

  async function requestPush() {
    if (!userId) return;
    if (typeof Notification === "undefined") { flash("Les notifications push ne sont pas prises en charge par ce navigateur."); return; }
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next !== "granted") {
      setNotifications(value => ({ ...value, channels: { ...value.channels, push: false } }));
      setNotificationsDirty(true);
      flash("Autorisation push non accordée.");
      return;
    }
    try {
      const ready = await activerPushProfil(userId);
      if (!ready) throw new Error("Push indisponible");
      setNotifications(value => ({ ...value, channels: { ...value.channels, push: true } }));
      setNotificationsDirty(true);
      flash("Abonnement Push activé sur cet appareil.");
    } catch {
      setNotifications(value => ({ ...value, channels: { ...value.channels, push: false } }));
      setNotificationsDirty(true);
      flash("Autorisation accordée, mais l’abonnement Push n’a pas pu être configuré.");
    }
  }

  async function updateTreatmentSchedules(enabled: boolean) {
    if (!userId) return;
    try {
      const key = "naxa:posologies:" + userId;
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const saved: unknown = JSON.parse(raw);
        if (Array.isArray(saved)) window.localStorage.setItem(key, JSON.stringify(saved.map(item => item && typeof item === "object" ? { ...item, rappels: enabled } : item)));
      }
    } catch { /* Le réglage du profil reste enregistré même si le stockage local est indisponible. */ }
    const { error } = await supabaseBrowser().from("naxa_posologie_schedules").update({ rappels: enabled, updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (error) flash("Préférence modifiée sur cet appareil ; synchronisation des rappels serveur indisponible.");
  }

  const title = titles[section] ?? "Profil";
  const validSection = Object.prototype.hasOwnProperty.call(titles, section);
  return <main className="min-h-dvh bg-[#E9F5EC] px-4 pb-10 text-[#111111]">
    <div className="mx-auto w-full max-w-[430px]">
      <header className="-mx-4 flex items-center gap-3 bg-[#064B2A] px-4 py-3 text-white">
        <Link href="/client/profil" aria-label="Retour au profil" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl">←</Link>
        <Link href="/" aria-label="Accueil NAXA"><Logo taille={30}/></Link>
        <h1 className="min-w-0 flex-1 text-lg font-extrabold">{title}</h1>
      </header>

      {!validSection ? <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm"><p>Cette option du profil n’existe pas.</p><Link className="mt-3 inline-block font-bold underline" href="/client/profil">Retour au profil</Link></section> : <>
        {section === "factures" && <section className="mt-5 space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm leading-6 text-[#53685C]">Vos reçus récapitulatifs sont établis à partir des achats enregistrés. Ils ne remplacent pas une facture fiscale délivrée par la pharmacie.</p><p className="mt-2 text-sm font-bold">{groupedInvoices.length} reçu(s)</p></div>
          {chargementRecus && <div className="rounded-2xl bg-white p-5">Chargement de vos reçus…</div>}
          {!chargementRecus && groupedInvoices.length === 0 && <div className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-extrabold">Aucun reçu disponible</h2><p className="mt-2 text-sm text-[#6B7280]">Vos reçus apparaîtront ici lorsque des achats payés ou retirés seront présents dans votre historique.</p><Link className="mt-3 inline-block font-bold text-[#1E7B3A] underline" href="/client?onglet=achats">Consulter mon historique</Link></div>}
          {groupedInvoices.map(([id, lines]) => {
            const first = lines[0]; const total = Number(first.total_transaction) || lines.reduce((sum, line) => sum + Number(line.total_ligne || 0), 0);
            return <article key={id} className={"naxa-invoice-card rounded-2xl bg-white p-4 shadow-sm " + (selectedInvoice === id ? "naxa-invoice-print-target" : "")}>
              <button type="button" onClick={() => setSelectedInvoice(id)} className="flex w-full items-start justify-between gap-3 text-left"><span className="min-w-0"><span className="block font-extrabold">Reçu · {first.pharmacie || "Pharmacie"}</span><span className="mt-1 block text-xs text-[#6B7280]">{first.ville || "Cameroun"} · {dateLabel(first.achat_le ?? first.reservation_creee_le)}</span><span className="mt-1 block text-xs text-[#6B7280]">N° {id.slice(0, 8).toUpperCase()}</span></span><span className="shrink-0 rounded-full bg-[#FFF1A6] px-2 py-1 text-xs font-bold">{statusLabels[first.statut] || first.statut}</span></button>
              <div className="mt-3 divide-y divide-[#E5E7EB]">{lines.map(line => <div key={line.produit_id} className="flex justify-between gap-3 py-2 text-sm"><span>{line.quantite} × {line.medicament}</span><strong className="shrink-0">{money(line.total_ligne || line.prix_unitaire * line.quantite)}</strong></div>)}</div>
              <div className="mt-3 flex justify-between border-t border-[#E5E7EB] pt-3"><span className="text-sm text-[#6B7280]">Total</span><strong>{money(total)}</strong></div>
              {first.reference_paiement && <p className="mt-2 text-xs text-[#6B7280]">Référence de paiement : {first.reference_paiement}</p>}
              <div className="mt-4 flex gap-2 print:hidden"><button type="button" onClick={() => setSelectedInvoice(id)} className="min-h-11 flex-1 rounded-xl border border-[#D8E5DC] px-3 text-sm font-bold text-[#1E7B3A]">Aperçu</button><button type="button" onClick={() => { setSelectedInvoice(id); window.setTimeout(() => window.print(), 100); }} className="min-h-11 flex-1 rounded-xl bg-[#FFE33D] px-3 text-sm font-extrabold text-[#064B2A]">Télécharger en PDF</button><button type="button" onClick={() => void shareInvoice(id, lines)} className="min-h-11 flex-1 rounded-xl border border-[#D8E5DC] px-3 text-sm font-bold text-[#1E7B3A]">Partager</button></div>
            </article>;
          })}
        </section>}

        {section === "aide" && <section className="mt-5 space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="text-lg font-extrabold text-[#0F4D26]">{language === "en" ? "How can we help you?" : "Comment pouvons-nous vous aider ?"}</h2><label className="mt-3 block"><span className="sr-only">{language === "en" ? "Search help" : "Rechercher dans l’aide"}</span><input className="w-full rounded-xl border border-[#D8E5DC] bg-[#F8FBF8] px-4 py-3 outline-none focus:border-[#1E7B3A]" value={faqQuery} onChange={e => setFaqQuery(e.target.value)} placeholder={language === "en" ? "Search questions…" : "Rechercher une question…"}/></label></div>
          <div className="flex gap-2 overflow-x-auto pb-1">{faqCategories.map(category => <button key={category} type="button" onClick={() => setFaqCategory(category)} className={"min-h-10 shrink-0 rounded-full px-4 text-sm font-bold transition-all " + (faqCategory === category ? "bg-[#1E7B3A] text-white" : "bg-white text-[#0F4D26]")}>{language === "en" ? faqCategoriesEn[category] : category}</button>)}</div>
          <div className="space-y-2">{filteredFaqs.length ? filteredFaqs.map((item, index) => <details key={item.question} className="naxa-faq rounded-2xl bg-white p-4 shadow-sm" style={{ animationDelay: (index * 35) + "ms" }}><summary className="cursor-pointer list-none pr-5 font-bold text-[#111111]">{language === "en" ? item.questionEn : item.question}<span className="float-right text-xl text-[#1E7B3A]">＋</span></summary><p className="mt-3 border-t border-[#E5E7EB] pt-3 text-sm leading-6 text-[#53685C]">{language === "en" ? item.answerEn : item.answer}</p></details>) : <div className="rounded-2xl bg-white p-5 text-sm text-[#6B7280]">{language === "en" ? "No results. Try another word or contact NAXA." : "Aucun résultat. Essayez un autre mot ou contactez NAXA."}</div>}</div>
          <Link href="/client/profil/contact" className="block rounded-2xl bg-[#064B2A] p-4 text-white shadow-sm"><span className="block text-lg font-extrabold">{language === "en" ? "Need help?" : "Besoin d’aide ?"}</span><span className="mt-1 block text-sm text-white/85">{language === "en" ? "Contact the NAXA team" : "Contacter l’équipe NAXA"}</span><span className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-[#FFE33D] px-4 text-sm font-extrabold text-[#064B2A]">{language === "en" ? "Contact NAXA →" : "Contacter NAXA →"}</span></Link>
        </section>}

        {section === "contact" && <section className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40">
          <div className="w-full max-w-[430px] rounded-t-[28px] bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl">
            <Link href="/client/profil" className="mx-auto mb-4 flex h-5 w-full justify-center" aria-label="Fermer"><span className="h-1.5 w-10 rounded-full bg-[#D1D5DB]"/></Link>
            <div className="mb-4 flex items-center justify-between"><div><p className="text-sm text-[#6B7280]">Assistance client</p><h2 className="text-xl font-extrabold text-[#0F4D26]">Contacter NAXA</h2></div><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E9F5EC] text-2xl">✉</span></div>
            {contactMode === "options" ? <>
              <a href={lienWhatsApp(nom)} target="_blank" rel="noreferrer" className="mb-2 flex min-h-14 items-center gap-3 rounded-2xl border border-[#D8E5DC] p-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E4F8E9] text-xl text-[#16803D]">◉</span><span className="min-w-0 flex-1"><strong className="block">WhatsApp</strong><small className="text-[#6B7280]">+{NAXA_WHATSAPP}</small></span><span>›</span></a>
              <a href={"tel:+" + NAXA_WHATSAPP} className="mb-2 flex min-h-14 items-center gap-3 rounded-2xl border border-[#D8E5DC] p-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E9F5EC] text-xl text-[#1E7B3A]">☎</span><span className="min-w-0 flex-1"><strong className="block">Appeler</strong><small className="text-[#6B7280]">+{NAXA_WHATSAPP}</small></span><span>›</span></a>
              <a href={lienGmail(nom)} className="mb-2 flex min-h-14 items-center gap-3 rounded-2xl border border-[#D8E5DC] p-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FCEDEA] text-xl text-[#B3261E]">✉</span><span className="min-w-0 flex-1"><strong className="block">E-mail</strong><small className="text-[#6B7280]">{NAXA_EMAIL}</small></span><span>›</span></a>
              <button type="button" onClick={() => setContactMode("message")} className="mt-2 min-h-12 w-full rounded-xl bg-[#FFE33D] font-extrabold text-[#064B2A]">Écrire un message</button>
              <p className="mt-3 text-center text-xs leading-5 text-[#6B7280]">Vous pouvez nous écrire à tout moment. Les réponses sont apportées dès que l’équipe est disponible.</p><p className="mt-1 text-center text-xs text-[#6B7280]">Horaires fixes d’assistance : non communiqués pour le moment.</p>
            </> : <form onSubmit={submitContact} className="space-y-3">
              <label className="block text-sm font-semibold">Sujet<input className="mt-1 w-full rounded-xl border border-[#D8E5DC] px-3 py-3" value={subject} onChange={e => setSubject(e.target.value)} maxLength={120} required/></label>
              <label className="block text-sm font-semibold">Numéro de commande (facultatif)<input className="mt-1 w-full rounded-xl border border-[#D8E5DC] px-3 py-3" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} maxLength={80} placeholder="Référence de réservation"/></label>
              <label className="block text-sm font-semibold">Votre message<textarea className="mt-1 min-h-28 w-full rounded-xl border border-[#D8E5DC] px-3 py-3" value={message} onChange={e => setMessage(e.target.value)} maxLength={3000} required placeholder="Décrivez votre demande…"/></label>
              <button type="submit" className="min-h-12 w-full rounded-xl bg-[#1E7B3A] font-extrabold text-white">Envoyer</button><button type="button" onClick={() => setContactMode("options")} className="min-h-10 w-full font-semibold text-[#6B7280]">Retour aux moyens de contact</button>
            </form>}
          </div>
        </section>}

        {section === "noter" && <section className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40" onMouseDown={e => { if (e.target === e.currentTarget) router.push("/client/profil"); }}><div className="max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] bg-[#F8FBF8] px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl"><Link href="/client/profil" className="mx-auto mb-4 flex h-5 w-full justify-center" aria-label="Fermer"><span className="h-1.5 w-10 rounded-full bg-[#D1D5DB]"/></Link><div className="rounded-2xl bg-white p-5 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E9F5EC] text-2xl">★</span><h2 className="mt-3 text-xl font-extrabold text-[#0F4D26]">Votre avis compte</h2><p className="mt-1 text-sm text-[#6B7280]">Aidez-nous à améliorer votre expérience NAXA.</p>
          <div className="mt-5 flex justify-center gap-2" role="radiogroup" aria-label="Note de l’application">{[1,2,3,4,5].map(n => <button key={n} type="button" onClick={() => setRating(n)} aria-label={n + " étoile(s)"} aria-pressed={rating === n} className={"rounded-full p-1 text-4xl transition-transform duration-200 active:scale-90 " + (rating >= n ? "animate-[naxa-verified-in_240ms_ease-out] text-[#F4C430]" : "text-[#D1D5DB]")}>★</button>)}</div>
          {rating > 0 && rating <= 3 && <label className="mt-5 block text-left text-sm font-semibold">Que pouvons-nous améliorer ?<textarea className="mt-1 min-h-28 w-full rounded-xl border border-[#D8E5DC] px-3 py-3" maxLength={500} value={review} onChange={e => setReview(e.target.value)} required placeholder="Dites-nous ce qui pourrait être mieux…"/></label>}
          {rating > 3 && <label className="mt-5 block text-left text-sm font-semibold">Un commentaire ? (facultatif)<textarea className="mt-1 min-h-24 w-full rounded-xl border border-[#D8E5DC] px-3 py-3" maxLength={500} value={review} onChange={e => setReview(e.target.value)} placeholder="Un mot pour l’équipe NAXA…"/></label>}
          <button type="button" disabled={busy || rating < 1 || (rating <= 3 && !review.trim())} onClick={() => void saveReview()} className="mt-5 min-h-12 w-full rounded-xl bg-[#FFE33D] font-extrabold text-[#064B2A] disabled:opacity-50">{busy ? "Envoi…" : "Envoyer mon avis"}</button>
        </div></div></section>}

        {section === "notifications" && <section className="mt-5 space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="font-extrabold text-[#0F4D26]">Ce que vous souhaitez recevoir</h2><p className="mt-1 text-sm leading-5 text-[#6B7280]">Les préférences sont enregistrées automatiquement. Les canaux dépendent des autorisations et coordonnées disponibles.</p></div>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">{([
            ["pharmacyReplies", "Réponses des pharmacies", "Messages et réponses liés à vos demandes"],
            ["orderStatus", "Statut des commandes", "Confirmations et changements de réservation"],
            ["promotions", "Offres et nouveautés", "Informations commerciales NAXA"],
            ["treatmentReminders", "Rappels de posologie", "Rappels que vous avez configurés"]
          ] as const).map(([key, label, description]) => <label key={key} className="flex min-h-[76px] items-center gap-3 border-b border-[#E5E7EB] px-4 py-3 last:border-b-0"><span className="min-w-0 flex-1"><strong className="block text-sm">{label}</strong><small className="mt-1 block leading-4 text-[#6B7280]">{description}</small></span><input type="checkbox" checked={notifications[key]} onChange={e => { const checked = e.target.checked; setNotifications(value => ({ ...value, [key]: checked })); setNotificationsDirty(true); if (key === "treatmentReminders") void updateTreatmentSchedules(checked); }} className="naxa-profile-toggle shrink-0" aria-label={label}/></label>)}</div>
          <div className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="font-extrabold text-[#0F4D26]">Canaux préférés</h2><div className="mt-2 divide-y divide-[#E5E7EB]">{([
            ["push", "Notifications push", "Autorisation : " + (permission === "unsupported" ? "non prise en charge" : permission)],
            ["sms", "SMS", "Selon les services activés pour votre compte"],
            ["email", "E-mail", "Messages liés au compte"]
          ] as const).map(([key, label, description]) => <label key={key} className="flex min-h-14 items-center gap-3 py-3"><span className="min-w-0 flex-1"><strong className="block text-sm">{label}</strong><small className="text-xs text-[#6B7280]">{description}</small></span><input type="checkbox" checked={notifications.channels[key]} onChange={e => { setNotifications(value => ({ ...value, channels: { ...value.channels, [key]: e.target.checked } })); setNotificationsDirty(true); }} className="naxa-profile-toggle shrink-0" aria-label={label} disabled={key === "push" && permission !== "granted"}/></label>)}</div><button type="button" onClick={() => void requestPush()} className="mt-3 min-h-11 w-full rounded-xl border border-[#1E7B3A] font-bold text-[#1E7B3A]">{permission === "granted" ? "Autorisation push accordée" : "Activer les notifications push"}</button></div>
          <p className="text-xs leading-5 text-[#6B7280]">Les préférences SMS et e-mail indiquent vos canaux souhaités ; l’envoi effectif dépend des services activés pour votre compte.</p>
        </section>}

        {section === "confidentialite" && <section className="mt-5 space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="font-extrabold text-[#0F4D26]">Sécurité du compte</h2><p className="mt-1 text-sm text-[#6B7280]">Modifiez votre mot de passe et protégez l’accès à votre espace NAXA.</p><div className="mt-4 space-y-3">
            <label className="block text-sm font-semibold">Nouveau mot de passe<input type="password" autoComplete="new-password" minLength={8} className="mt-1 w-full rounded-xl border border-[#D8E5DC] px-3 py-3" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="8 caractères minimum"/></label>
            <label className="block text-sm font-semibold">Confirmer le mot de passe<input type="password" autoComplete="new-password" minLength={8} className="mt-1 w-full rounded-xl border border-[#D8E5DC] px-3 py-3" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Répétez le nouveau mot de passe"/></label>
            <button type="button" disabled={busy || !newPassword || !confirmPassword} onClick={() => void changePassword()} className="min-h-11 w-full rounded-xl bg-[#1E7B3A] px-4 font-bold text-white disabled:opacity-50">{busy ? "Mise à jour…" : "Changer le mot de passe"}</button>
          </div></div>
          <div className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="font-extrabold text-[#0F4D26]">Vos données</h2><p className="mt-1 text-sm leading-5 text-[#6B7280]">Téléchargez une copie des informations de profil, préférences, réservations et achats disponibles pour votre compte.</p><button type="button" onClick={() => setShowExportConfirm(true)} className="mt-3 min-h-11 w-full rounded-xl border border-[#1E7B3A] font-bold text-[#1E7B3A]">Télécharger mes données</button></div>
          <label className="flex min-h-16 items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"><span className="min-w-0 flex-1"><strong className="block">Rester anonyme par défaut</strong><small className="text-[#6B7280]">Lorsque cette option est proposée dans un parcours NAXA.</small></span><input type="checkbox" checked={prefs.anonyme_defaut} onChange={e => setPrefs(value => ({ ...value, anonyme_defaut: e.target.checked }))} className="naxa-profile-toggle shrink-0"/></label>
          <button type="button" disabled={busy} onClick={() => void savePrivacy()} className="min-h-11 w-full rounded-xl bg-[#FFE33D] font-extrabold text-[#064B2A] disabled:opacity-50">Enregistrer la confidentialité</button>
          <div className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="font-extrabold text-[#0F4D26]">Documents légaux</h2><div className="mt-3 divide-y divide-[#E5E7EB]"><Link className="flex min-h-12 items-center justify-between font-semibold" href="/conditions-utilisation">Conditions générales d’utilisation <span>›</span></Link><Link className="flex min-h-12 items-center justify-between font-semibold" href="/politique-confidentialite">Politique de confidentialité <span>›</span></Link><Link className="flex min-h-12 items-center justify-between font-semibold" href="/politique-securite">Politique de sécurité <span>›</span></Link></div></div>
        </section>}

        {section === "suppression" && <section className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40" onMouseDown={e => { if (e.target === e.currentTarget) router.push("/client/profil"); }}><div className="max-h-[90dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl"><Link href="/client/profil" className="mx-auto mb-4 flex h-5 w-full justify-center" aria-label="Fermer"><span className="h-1.5 w-10 rounded-full bg-[#D1D5DB]"/></Link><h2 className="mb-4 text-xl font-extrabold text-[#0F4D26]">Supprimer le compte</h2><SuppressionCompteClient/></div></section>}
        {erreur && <p role="alert" className="mt-4 rounded-xl border border-[#E7B4AF] bg-white p-3 text-sm text-[#B3261E]">{erreur}</p>}
      </>}
    </div>

    {selectedLines && section === "factures" && <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedInvoice(null); }}><section role="dialog" aria-modal="true" aria-labelledby="invoice-preview-title" className="w-full max-w-[430px] rounded-t-[26px] bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl"><div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#D1D5DB]"/><h2 id="invoice-preview-title" className="text-xl font-extrabold text-[#0F4D26]">Aperçu du reçu</h2><p className="mt-1 text-sm text-[#6B7280]">{selectedLines[1][0].pharmacie} · {dateLabel(selectedLines[1][0].achat_le ?? selectedLines[1][0].reservation_creee_le)}</p><div className="mt-4 max-h-[38dvh] space-y-2 overflow-y-auto rounded-xl bg-[#F8FBF8] p-3">{selectedLines[1].map(line => <div key={line.produit_id} className="flex justify-between gap-3 text-sm"><span>{line.quantite} × {line.medicament}</span><strong>{money(line.total_ligne)}</strong></div>)}</div><div className="mt-3 flex justify-between border-t pt-3"><span className="font-semibold">Total</span><strong>{money(selectedLines[1][0].total_transaction)}</strong></div><button type="button" onClick={() => { setSelectedInvoice(selectedLines[0]); window.setTimeout(() => window.print(), 100); }} className="mt-4 min-h-12 w-full rounded-xl bg-[#FFE33D] font-extrabold text-[#064B2A]">Télécharger en PDF</button><button type="button" onClick={() => void shareInvoice(selectedLines[0], selectedLines[1])} className="mt-2 min-h-11 w-full rounded-xl border border-[#D8E5DC] font-bold text-[#1E7B3A]">Partager le reçu</button><button type="button" onClick={() => setSelectedInvoice(null)} className="mt-1 min-h-10 w-full font-semibold text-[#6B7280]">Fermer</button></section></div>}

    {showExportConfirm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-5" onMouseDown={e => { if (e.target === e.currentTarget && !exportBusy) setShowExportConfirm(false); }}><section role="alertdialog" aria-modal="true" aria-labelledby="export-title" className="w-full max-w-[380px] rounded-[24px] bg-white p-5 shadow-2xl"><h2 id="export-title" className="text-lg font-extrabold text-[#0F4D26]">Télécharger une copie de vos données ?</h2><p className="mt-2 text-sm leading-6 text-[#6B7280]">Le fichier JSON contiendra les données de compte, les préférences et les réservations/achats accessibles. Conservez-le dans un endroit sûr.</p><button type="button" disabled={exportBusy} onClick={() => void exportData()} className="mt-4 min-h-12 w-full rounded-xl bg-[#1E7B3A] font-bold text-white disabled:opacity-50">{exportBusy ? "Préparation…" : "Confirmer le téléchargement"}</button><button type="button" disabled={exportBusy} onClick={() => setShowExportConfirm(false)} className="mt-2 min-h-11 w-full rounded-xl border border-[#E5E7EB] font-semibold">Annuler</button></section></div>}

    {toast && <div role="status" aria-live="polite" className="naxa-profile-toast fixed left-1/2 top-4 z-[150] -translate-x-1/2 rounded-full bg-[#0F4D26] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">{toast}</div>}
  </main>;
}
