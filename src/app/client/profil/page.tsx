"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { IconeNAXA } from "@/components/IconeNAXA";

type ProfileData = { name: string; phone: string; email: string; address: string; photo: string | null; orders: number };
type DemoMode = "real" | "complete" | "incomplete";
const PHOTO_KEY = "naxa-client-profile-photo-v1";
const PROFILE_EVENT = "naxa-profile-updated";
const DEMO_PORTRAIT = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d8eee0"/><stop offset="1" stop-color="#9bc6a9"/></linearGradient></defs><rect width="200" height="200" fill="url(#b)"/><path d="M35 200c4-43 30-67 65-67s61 24 65 67" fill="#1e7b3a"/><ellipse cx="100" cy="83" rx="42" ry="48" fill="#9b6348"/><path d="M57 77c-5-39 17-57 44-57 35 0 50 23 42 58l-8-22c-20 3-42-4-55-15-4 15-12 27-23 36" fill="#202b25"/><circle cx="84" cy="85" r="3" fill="#211d1b"/><circle cx="116" cy="85" r="3" fill="#211d1b"/><path d="M88 106q12 9 24 0" stroke="#653a2b" stroke-width="3" fill="none" stroke-linecap="round"/></svg>');

function initials(name: string) { return name.trim().split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(x => Array.from(x)[0]?.toLocaleUpperCase("fr-FR") ?? "").join("") || "C"; }
function isProfileVerified(user: Pick<ProfileData, "address" | "phone" | "photo">) { return Boolean(user.address.trim() && user.phone.trim() && user.photo); }
function Icon({ name, size = 24, className = "" }: { name: string; size?: number; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2.5"/><path d="M3 9h18M16 14h2"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.4 1.9c-1.2 1-1.9 1.4-1.9 3M12 17.2h.01"/></>,
    headset: <><path d="M4 13v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="12" width="4" height="7" rx="2"/><rect x="17" y="12" width="4" height="7" rx="2"/><path d="M17 19c-1 2-3 2-5 2"/></>,
    star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></>,
    phone: <><path d="M7 3H4a1 1 0 0 0-1 1c0 9 7 16 16 16a1 1 0 0 0 1-1v-3l-5-2-2 2a13 13 0 0 1-6-6l2-2Z"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    camera: <><path d="M4 8h3l2-3h6l2 3h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="3.5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    home: <><path d="m3 10 9-7 9 7"/><path d="M5.5 9v11h13V9M9 20v-6h6v6"/></>,
    search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
    bag: <><rect x="4" y="7" width="16" height="14" rx="2"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></>,
    edit: <><path d="m4 16-.8 4.8L8 20l11-11-4-4Z"/><path d="m13.5 6.5 4 4"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name] ?? paths.file}</svg>;
}
function Verified({ small = false }: { small?: boolean }) { return <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#1D9BF0] text-white ${small ? "h-[13px] w-[13px]" : "h-5 w-5"} animate-[naxa-verified-in_240ms_ease-out]`} aria-label="Profil vérifié"><Icon name="check" size={small ? 9 : 13} /></span>; }

export default function ProfilClientPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [profile, setProfile] = useState<ProfileData>({ name: "Client NAXA", phone: "", email: "", address: "", photo: null, orders: 0 });
  const [loaded, setLoaded] = useState(false);
  const [demo, setDemo] = useState<DemoMode>("real");
  const [sheet, setSheet] = useState<"photo" | "edit" | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", email: "" });
  const [cameraBusy, setCameraBusy] = useState(false);

  const shown = useMemo<ProfileData>(() => demo === "complete"
    ? { name: "Jean Dupont", phone: "+237 6 12 34 56 78", email: "j.dupont@email.com", address: "123 Rue Paix Bonanjo Douala", photo: DEMO_PORTRAIT, orders: 12 }
    : demo === "incomplete"
      ? { name: "Marie Nguema", phone: "", email: "marie@email.com", address: "", photo: null, orders: 0 }
      : profile, [demo, profile]);
  const verified = isProfileVerified(shown);
  const shownInitials = initials(shown.name);

  const flash = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); }, []);
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCameraBusy(false);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!active) return;
      if (!user) { router.replace("/connexion?retour=" + encodeURIComponent("/client/profil")); return; }
      const { data: row } = await sb.from("profiles").select("first_name,last_name,avatar_url").eq("id", user.id).maybeSingle();
      const { data: prefs } = await sb.from("client_preferences").select("adresse_defaut,quartier").eq("user_id", user.id).maybeSingle();
      const { count } = await sb.from("reservations").select("id", { count: "exact", head: true }).eq("client_id", user.id);
      let savedPhoto: string | null = null;
      try { savedPhoto = window.localStorage.getItem(PHOTO_KEY); } catch { /* Le profil reste utilisable sans stockage local. */ }
      const meta = user.user_metadata ?? {};
      const name = [row?.first_name, row?.last_name].filter((v): v is string => typeof v === "string" && Boolean(v.trim())).join(" ") || String(meta.full_name ?? meta.name ?? "Client NAXA");
      const phone = user.phone || String(meta.phone ?? "");
      const email = user.email ?? "";
      const address = [prefs?.adresse_defaut, prefs?.quartier].filter((v): v is string => typeof v === "string" && Boolean(v.trim())).join(", ");
      const photo = savedPhoto || (typeof row?.avatar_url === "string" ? row.avatar_url : null) || (typeof meta.avatar_url === "string" ? meta.avatar_url : null);
      setProfile({ name, phone, email, address, photo, orders: count ?? 0 });
      setDraft({ name, phone, email });
      setLoaded(true);
    })();
    const onPhotoUpdate = () => { try { const photo = window.localStorage.getItem(PHOTO_KEY); setProfile(p => ({ ...p, photo })); } catch {} };
    window.addEventListener(PROFILE_EVENT, onPhotoUpdate);
    return () => { active = false; window.removeEventListener(PROFILE_EVENT, onPhotoUpdate); streamRef.current?.getTracks().forEach(track => track.stop()); };
  }, [router]);

  useEffect(() => { if (cameraOpen && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current; }, [cameraOpen]);
  useEffect(() => () => { if (toast) window.clearTimeout(0); }, [toast]);

  function openEdit() { setDraft({ name: profile.name, phone: profile.phone, email: profile.email }); setSheet("edit"); }
  async function saveInfo() {
    setSaving(true);
    const sb = supabaseBrowser();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setSaving(false); flash("Reconnectez-vous pour modifier votre profil."); return; }
    const parts = draft.name.trim().split(/\s+/);
    const { error: profileError } = await sb.from("profiles").update({ first_name: parts[0] || "", last_name: parts.slice(1).join(" ") }).eq("id", user.id);
    const { error: authError } = await sb.auth.updateUser({ data: { full_name: draft.name.trim(), phone: draft.phone.trim() } });
    if (profileError || authError) { setSaving(false); flash("Enregistrement partiel impossible. Réessayez."); return; }
    setProfile(p => ({ ...p, name: draft.name.trim() || p.name, phone: draft.phone.trim(), email: draft.email.trim() || p.email }));
    setSaving(false); setSheet(null); flash("Informations mises à jour.");
  }
  async function openCamera() {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError("La caméra n’est pas disponible sur cet appareil. Vous pouvez importer une photo."); setSheet("photo"); return; }
    try {
      setCameraBusy(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      setCameraBusy(false);
      setSheet(null);
      window.setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play().catch(() => {}); } }, 50);
    } catch {
      setCameraBusy(false);
      setCameraError("Autorisation caméra refusée ou caméra indisponible. Réessayez ou importez une photo depuis la galerie.");
      setSheet("photo");
    }
  }
  function beginCrop(src: string) { stopCamera(); setCropSource(src); setZoom(1); setOffset({ x: 0, y: 0 }); setSheet(null); }
  function importPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { flash("Choisissez un fichier image."); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") beginCrop(reader.result); };
    reader.onerror = () => flash("Impossible de lire cette image. Réessayez.");
    reader.readAsDataURL(file);
  }
  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { setCameraError("La caméra démarre encore. Réessayez dans un instant."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setCameraError("Impossible de capturer l’image. Importez une photo."); return; }
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    beginCrop(canvas.toDataURL("image/jpeg", 0.88));
  }
  async function saveCrop() {
    if (!cropSource) return;
    setSaving(true);
    try {
      const image = new Image();
      image.src = cropSource;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("image")); });
      const frame = 240;
      const scale = Math.max(frame / image.naturalWidth, frame / image.naturalHeight) * zoom;
      const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 512, 512);
      const ratio = 512 / frame;
      ctx.drawImage(image, (frame - image.naturalWidth * scale) / 2 * ratio + offset.x * ratio, (frame - image.naturalHeight * scale) / 2 * ratio + offset.y * ratio, image.naturalWidth * scale * ratio, image.naturalHeight * scale * ratio);
      const compressed = canvas.toDataURL("image/jpeg", 0.76);
      try { window.localStorage.setItem(PHOTO_KEY, compressed); } catch { throw new Error("storage"); }
      setProfile(p => ({ ...p, photo: compressed }));
      window.dispatchEvent(new Event(PROFILE_EVENT));
      setCropSource(null); setSheet(null); flash("Photo de profil mise à jour.");
    } catch {
      flash("La photo n’a pas pu être enregistrée. Choisissez une image plus légère ou réessayez.");
    } finally { setSaving(false); }
  }
  function deletePhoto() {
    try { window.localStorage.removeItem(PHOTO_KEY); } catch {}
    setProfile(p => ({ ...p, photo: null }));
    window.dispatchEvent(new Event(PROFILE_EVENT));
    setSheet(null); flash("Photo supprimée.");
  }
  function dragStartAt(e: ReactPointerEvent<HTMLDivElement>) { e.currentTarget.setPointerCapture(e.pointerId); setDragStart({ x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }); }
  function dragMove(e: ReactPointerEvent<HTMLDivElement>) { if (dragStart) setOffset({ x: Math.max(-100, Math.min(100, dragStart.ox + e.clientX - dragStart.x)), y: Math.max(-100, Math.min(100, dragStart.oy + e.clientY - dragStart.y)) }); }

  const topRows = [
    { icon: "pin", title: "Adresse par défaut", subtitle: shown.address || "Ajouter une adresse", href: "/client/profil/adresse" },
    { icon: "wallet", title: "Paiement", subtitle: "MTN MoMo", href: "/client/profil/paiement" },
    { icon: "globe", title: "Langue", subtitle: "Français", href: "/client/profil/langue" }
  ];
  const sections = [
    { title: "Mes commandes", rows: [
      { icon: "clock", title: "Historique", subtitle: shown.orders ? `${shown.orders} commande${shown.orders === 1 ? "" : "s"}` : "Aucune commande", href: "/client?onglet=achats", trailing: true },
      { icon: "file", title: "Factures", href: "/client/profil/factures" }
    ]},
    { title: "Support", rows: [
      { icon: "help", title: "Centre d'aide", href: "/client/profil/aide" },
      { icon: "headset", title: "Contacter NAXA", href: "/client/profil/contact" },
      { icon: "star", title: "Noter l'app", href: "/client/profil/noter" }
    ]},
    { title: "Paramètres", rows: [
      { icon: "bell", title: "Notifications", href: "/client/profil/notifications" },
      { icon: "shield", title: "Confidentialité", href: "/client/profil/confidentialite" },
      { icon: "trash", title: "Supprimer le compte", href: "/client/profil/suppression", danger: true },
      { icon: "logout", title: "Déconnexion", href: "/connexion", danger: true, action: "logout" }
    ]}
  ];

  async function logout() { await supabaseBrowser().auth.signOut(); window.location.replace("/"); }

  return <main className="naxa-profile min-h-dvh bg-[#E9F5EC] px-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))] text-[#111111]">
    <div className="mx-auto w-full max-w-[430px] pt-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#1E7B3A]">Espace client</span>
        <label className="flex min-h-8 items-center gap-1.5 rounded-full border border-[#d1e5d6] bg-white/80 px-2 text-[11px] font-semibold text-[#526457]">
          Profil test
          <select aria-label="Choisir un profil de démonstration" value={demo} onChange={e => setDemo(e.target.value as DemoMode)} className="max-w-[112px] bg-transparent text-[#0F4D26] outline-none">
            <option value="real">Mon compte</option><option value="complete">Complet</option><option value="incomplete">Incomplet</option>
          </select>
        </label>
      </div>
      <section className="naxa-profile-card naxa-profile-enter rounded-[24px] bg-white px-5 pb-7 pt-5 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => { setSheet("photo"); setCameraError(""); }} className="relative h-[72px] w-[72px] shrink-0 rounded-full bg-[#1E7B3A] text-[#F4C430] active:scale-[.97]" aria-label="Modifier la photo de profil">
            {shown.photo ? <img src={shown.photo} alt="" className="h-full w-full rounded-full object-cover" /> : <span className="flex h-full w-full items-center justify-center rounded-full text-[27px] font-black">{shownInitials}</span>}
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-[#f4f4f4] bg-white text-[#1E7B3A] shadow-[0_2px_6px_rgba(0,0,0,.15)]"><Icon name="camera" size={15}/></span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="min-w-0 truncate text-[22px] font-extrabold leading-tight text-[#0F4D26]">{shown.name}</h1>
              {verified && <Verified/>}
              {demo === "real" && <button type="button" onClick={openEdit} aria-label="Modifier mes informations" className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#1E7B3A] hover:bg-[#E9F5EC]"><Icon name="edit" size={18}/></button>}
            </div>
            {shown.phone.trim() && <p className="mt-2 flex items-center gap-2 text-[15px] leading-5 text-[#111111]"><Icon name="phone" size={17} className="shrink-0 text-[#6B7280]"/><span className="truncate">{shown.phone}</span></p>}
            {shown.email.trim() && <p className="mt-1 flex items-center gap-2 text-[15px] leading-5 text-[#111111]"><Icon name="mail" size={17} className="shrink-0 text-[#6B7280]"/><span className="truncate">{shown.email}</span></p>}
          </div>
        </div>
      </section>

      <section className="naxa-profile-menu mt-3 overflow-hidden rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
        {topRows.map((row, index) => <Link key={row.title} href={row.href} style={{ animationDelay: `${index * 45}ms` }} className="naxa-profile-row relative flex min-h-16 items-center gap-4 px-4 py-2 transition-transform active:scale-[.99]">
          <Icon name={row.icon} className="shrink-0 text-[#1E7B3A]"/>
          <span className="min-w-0 flex-1 py-1"><span className="block text-[17px] font-bold leading-5 text-[#111111]">{row.title}</span><span className="mt-0.5 block truncate text-[15px] leading-5 text-[#6B7280]">{row.subtitle}</span></span>
          <span className="text-[25px] leading-none text-[#6B7280]" aria-hidden="true">›</span>
          {index < topRows.length - 1 && <span className="absolute bottom-0 right-0 h-px w-[calc(100%-56px)] bg-[#E5E7EB]"/>}
        </Link>)}
      </section>

      {sections.map((section, sIndex) => <section key={section.title} className="mt-6">
        <h2 className="mb-2 ml-1 text-[22px] font-extrabold leading-7 text-[#0F4D26]">{section.title}</h2>
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          {section.rows.map((row, index) => {
            const rowClass = `naxa-profile-row relative flex min-h-14 w-full items-center gap-4 px-4 py-2.5 text-left transition-transform active:scale-[.99] ${"danger" in row && row.danger ? "text-[#B3261E]" : "text-[#111111]"}`;
            const inner = <><Icon name={row.icon} className={`shrink-0 ${"danger" in row && row.danger ? "text-[#B3261E]" : "text-[#1E7B3A"}`}/><span className="min-w-0 flex-1 text-[16px] font-bold">{row.title}</span>{"subtitle" in row && row.trailing && <span className="shrink-0 text-[13px] text-[#6B7280]">{row.subtitle}</span>}<span className="text-[25px] leading-none text-[#6B7280]" aria-hidden="true">›</span>{index < section.rows.length - 1 && <span className="absolute bottom-0 right-0 h-px w-[calc(100%-56px)] bg-[#E5E7EB]"/>}</>;
            return "action" in row && row.action === "logout" ? <button key={row.title} type="button" onClick={() => void logout()} className={rowClass}>{inner}</button> : <Link key={row.title} href={row.href} style={{ animationDelay: `${(sIndex * 3 + index) * 40}ms` }} className={rowClass}>{inner}</Link>;
          })}
        </div>
      </section>)}
      <p className="pb-3 pt-5 text-center text-[11px] text-[#6B7280]">NAXA · Votre espace personnel</p>
    </div>

    <nav aria-label="Navigation principale" className="naxa-profile-bottom fixed inset-x-0 z-[60] mx-auto h-16 max-w-[430px] border-t border-[#E5E7EB] bg-white px-2 shadow-[0_-2px_8px_rgba(0,0,0,.04)]" style={{ bottom: 0, paddingBottom: "env(safe-area-inset-bottom, 0px)", height: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>
      <div className="grid h-16 grid-cols-4 items-center">
        {[{label:"Accueil",href:"/",icon:"home"},{label:"Recherche",href:"/recherche",icon:"search"},{label:"Commandes",href:"/client?onglet=achats",icon:"bag"}].map(tab => <Link key={tab.label} href={tab.href} className="flex min-h-12 flex-col items-center justify-center gap-1 text-[#6B7280] transition-transform active:scale-95"><Icon name={tab.icon} size={22}/><span className="text-[10px] font-medium">{tab.label}</span></Link>)}
        <Link href="/client/profil" aria-current="page" className="flex min-h-12 flex-col items-center justify-center gap-1 text-[#1E7B3A]">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#1E7B3A] bg-[#1E7B3A] text-[11px] font-extrabold text-[#F4C430]">
            {shown.photo ? <img src={shown.photo} alt="" className="h-full w-full rounded-full object-cover"/> : shownInitials}
            {verified && <span className="absolute -bottom-1 -right-1"><Verified small/></span>}
          </span><span className="text-[10px] font-bold">Profil</span>
        </Link>
      </div>
    </nav>

    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={importPhoto}/>
    {sheet && <div className="naxa-profile-overlay fixed inset-0 z-[100] flex items-end justify-center bg-black/35" onMouseDown={e => { if (e.target === e.currentTarget) setSheet(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="profile-sheet-title" className="naxa-profile-sheet w-full max-w-[430px] rounded-t-[24px] bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#D1D5DB]"/>
        {sheet === "photo" ? <>
          <h2 id="profile-sheet-title" className="mb-3 text-lg font-extrabold text-[#0F4D26]">Photo de profil</h2>
          {cameraError && <div role="alert" className="mb-3 rounded-xl bg-[#FCEDEA] p-3 text-sm text-[#8F211B]">{cameraError}</div>}
          <button type="button" onClick={() => void openCamera()} disabled={cameraBusy} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left font-semibold text-[#111111] transition-colors hover:bg-[#E9F5EC]"><Icon name="camera" className="text-[#1E7B3A]"/>Prendre une photo{cameraBusy && <span className="ml-auto text-xs text-[#6B7280]">Ouverture…</span>}</button>
          <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left font-semibold text-[#111111] transition-colors hover:bg-[#E9F5EC]"><Icon name="file" className="text-[#1E7B3A]"/>Importer depuis la galerie</button>
          {profile.photo && <button type="button" onClick={deletePhoto} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left font-semibold text-[#B3261E] transition-colors hover:bg-red-50"><Icon name="trash" className="text-[#B3261E]"/>Supprimer la photo</button>}
          <button type="button" onClick={() => setSheet(null)} className="mt-2 min-h-11 w-full rounded-xl border border-[#E5E7EB] font-semibold text-[#6B7280]">Annuler</button>
        </> : <>
          <h2 id="profile-sheet-title" className="mb-4 text-lg font-extrabold text-[#0F4D26]">Modifier mes informations</h2>
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-[#374151]">Nom complet<input autoComplete="name" value={draft.name} onChange={e => setDraft(p => ({...p,name:e.target.value}))} className="naxa-profile-input mt-1" maxLength={100}/></label>
            <label className="block text-sm font-semibold text-[#374151]">Téléphone<input autoComplete="tel" inputMode="tel" value={draft.phone} onChange={e => setDraft(p => ({...p,phone:e.target.value}))} className="naxa-profile-input mt-1" placeholder="+237 6 XX XX XX XX" maxLength={24}/></label>
            <label className="block text-sm font-semibold text-[#374151]">E-mail<input autoComplete="email" type="email" value={draft.email} onChange={e => setDraft(p => ({...p,email:e.target.value}))} className="naxa-profile-input mt-1" maxLength={254}/></label>
          </div>
          <button type="button" onClick={() => void saveInfo()} disabled={saving || !draft.name.trim()} className="mt-5 min-h-12 w-full rounded-xl bg-[#1E7B3A] font-bold text-white transition-transform active:scale-[.99] disabled:opacity-50">{saving ? "Enregistrement…" : "Enregistrer"}</button>
          <button type="button" onClick={() => setSheet(null)} className="mt-2 min-h-11 w-full font-semibold text-[#6B7280]">Annuler</button>
        </>}
      </section>
    </div>}

    {cameraOpen && <div className="fixed inset-0 z-[110] flex flex-col bg-black p-4 text-white" role="dialog" aria-modal="true" aria-label="Prendre une photo">
      <header className="flex items-center justify-between"><button type="button" onClick={() => { stopCamera(); setSheet("photo"); }} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15" aria-label="Fermer la caméra">×</button><h2 className="font-bold">Prendre une photo</h2><span className="w-11"/></header>
      {cameraError && <p role="alert" className="mt-3 rounded-xl bg-white/10 p-3 text-sm">{cameraError}</p>}
      <div className="my-auto flex justify-center"><div className="relative aspect-square w-full max-w-[330px] overflow-hidden rounded-full border-4 border-white/80 bg-[#222]"><video ref={videoRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover"/></div></div>
      <div className="flex items-center justify-center gap-8 pb-8"><button type="button" onClick={() => { stopCamera(); setSheet("photo"); }} className="min-h-12 rounded-full px-4 font-semibold">Annuler</button><button type="button" onClick={capturePhoto} className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[5px] border-white bg-white/20" aria-label="Déclencher la photo"><span className="h-12 w-12 rounded-full bg-white"/></button></div>
    </div>}

    {cropSource && <div className="fixed inset-0 z-[120] flex flex-col bg-[#0b2415] px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-[max(18px,env(safe-area-inset-top,0px))] text-white" role="dialog" aria-modal="true" aria-labelledby="crop-title">
      <header className="flex items-center justify-between"><button type="button" onClick={() => setCropSource(null)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl" aria-label="Annuler le recadrage">×</button><h2 id="crop-title" className="font-bold">Recadrer la photo</h2><span className="w-11"/></header>
      <p className="mt-3 text-center text-sm text-white/75">Déplacez la photo dans le cercle et ajustez le zoom.</p>
      <div className="my-auto flex justify-center">
        <div className="relative h-[min(72vw,300px)] w-[min(72vw,300px)] touch-none overflow-hidden rounded-full border-4 border-white" onPointerDown={dragStartAt} onPointerMove={dragMove} onPointerUp={() => setDragStart(null)} onPointerCancel={() => setDragStart(null)}>
          <img src={cropSource} alt="Aperçu du recadrage" draggable={false} className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none" style={{ width: "auto", height: "auto", minWidth: "100%", minHeight: "100%", maxHeight: "none", maxWidth: "none", transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`, objectFit: "cover" }}/>
        </div>
      </div>
      <label className="mx-auto mb-8 flex w-full max-w-[300px] items-center gap-3 text-sm"><span>−</span><input aria-label="Zoom de la photo" type="range" min="1" max="2.5" step=".05" value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-full accent-[#F4C430]"/><span>+</span></label>
      <button type="button" onClick={() => void saveCrop()} disabled={saving} className="min-h-12 w-full rounded-xl bg-[#F4C430] font-extrabold text-[#0F4D26] disabled:opacity-60">{saving ? "Enregistrement…" : "Utiliser cette photo"}</button>
      <button type="button" onClick={() => { setCropSource(null); setSheet("photo"); }} className="mt-2 min-h-11 font-semibold text-white/80">Reprendre / choisir une autre</button>
    </div>}

    {toast && <div role="status" aria-live="polite" className="naxa-profile-toast fixed left-1/2 top-4 z-[150] -translate-x-1/2 rounded-full bg-[#0F4D26] px-4 py-3 text-sm font-semibold text-white shadow-lg">{toast}</div>}
    {!loaded && <div className="sr-only" aria-live="polite">Chargement du profil…</div>}
  </main>;
}
