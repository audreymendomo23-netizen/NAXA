"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type AddressLabel = "Maison" | "Travail" | "Autre";
type SavedAddress = {
  id: string;
  label: AddressLabel;
  city: string;
  neighborhood: string;
  street: string;
  landmark: string;
  isDefault: boolean;
  latitude?: number;
  longitude?: number;
};
type AddressDraft = Omit<SavedAddress, "id">;
const STORAGE_KEY = "naxa-client-addresses-v1";
const ADDRESS_EVENT = "naxa-addresses-updated";

const emptyDraft: AddressDraft = {
  label: "Maison", city: "", neighborhood: "", street: "", landmark: "", isDefault: true,
};

function PinIcon({ name, className = "h-6 w-6" }: { name: "pin" | "home" | "work" | "edit" | "trash" | "plus" | "check" | "close" | "back" | "more" | "location"; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    home: <><path d="m3 10 9-7 9 7"/><path d="M5.5 9v11h13V9M9 20v-6h6v6"/></>,
    work: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2"/></>,
    edit: <><path d="m4 16-.8 4.8L8 20l11-11-4-4Z"/><path d="m13.5 6.5 4 4"/></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    back: <><path d="m15 18-6-6 6-6M9 12h12"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    location: <><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.2"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...common}>{paths[name]}</svg>;
}

function addressText(address: SavedAddress) {
  return [address.street, address.neighborhood, address.city].map((part) => part.trim()).filter(Boolean).join(", ");
}
function readSavedAddresses(): SavedAddress[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is SavedAddress =>
      Boolean(item && typeof item.id === "string" && ["Maison", "Travail", "Autre"].includes(item.label) &&
      typeof item.city === "string" && typeof item.neighborhood === "string" && typeof item.street === "string" &&
      typeof item.landmark === "string" && typeof item.isDefault === "boolean"));
  } catch { return []; }
}

export default function AdressesClientPage() {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState<AddressDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = supabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        window.location.assign("/connexion?retour=" + encodeURIComponent("/client/profil/adresse"));
        return;
      }
      const saved = readSavedAddresses();
      if (saved.length) {
        if (active) { setAddresses(saved); setLoaded(true); }
        return;
      }
      const { data: prefs } = await supabase.from("client_preferences").select("adresse_defaut,quartier").eq("user_id", user.id).maybeSingle();
      if (!active) return;
      const legacyAddress = [prefs?.adresse_defaut, prefs?.quartier].filter((part): part is string => typeof part === "string" && Boolean(part.trim()));
      if (legacyAddress.length) {
        setAddresses([{
          id: "default-imported", label: "Maison", city: "", neighborhood: String(prefs?.quartier ?? ""),
          street: String(prefs?.adresse_defaut ?? ""), landmark: "", isDefault: true,
        }]);
      }
      setLoaded(true);
    })();
    return () => { active = false; };
  }, []);

  const defaultAddress = useMemo(() => addresses.find((address) => address.isDefault) ?? null, [addresses]);

  function persist(next: SavedAddress[]) {
    const normalized = next.map((address, index) => ({ ...address, isDefault: next.some((candidate) => candidate.isDefault) ? address.isDefault : index === 0 }));
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch {
      flash("Le navigateur n’a pas pu enregistrer les adresses sur cet appareil.");
      return;
    }
    setAddresses(normalized);
    window.dispatchEvent(new CustomEvent(ADDRESS_EVENT, { detail: { defaultAddress: normalized.find((address) => address.isDefault) ?? null } }));
  }

  function openNew() {
    setEditingId(null);
    setDraft({ ...emptyDraft, isDefault: addresses.length === 0 });
    setLocationError("");
    setSheet(true);
  }
  function openEdit(address: SavedAddress) {
    setEditingId(address.id);
    setDraft({
      label: address.label, city: address.city, neighborhood: address.neighborhood,
      street: address.street, landmark: address.landmark, isDefault: address.isDefault,
      latitude: address.latitude, longitude: address.longitude,
    });
    setMenuId(null);
    setLocationError("");
    setSheet(true);
  }
  function saveAddress() {
    if (!draft.city.trim() || !draft.neighborhood.trim() || !draft.street.trim()) {
      flash("Renseignez la ville, le quartier et la rue.");
      return;
    }
    const id = editingId ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()));
    const updated: SavedAddress = { ...draft, id, city: draft.city.trim(), neighborhood: draft.neighborhood.trim(), street: draft.street.trim(), landmark: draft.landmark.trim() };
    let next = editingId ? addresses.map((address) => address.id === editingId ? updated : address) : [...addresses, updated];
    if (updated.isDefault || next.length === 1) next = next.map((address) => ({ ...address, isDefault: address.id === id }));
    else if (!next.some((address) => address.isDefault)) next[0] = { ...next[0], isDefault: true };
    persist(next);
    setSheet(false);
    flash(editingId ? "Adresse modifiée." : "Adresse ajoutée.");
  }
  function setDefault(id: string) {
    persist(addresses.map((address) => ({ ...address, isDefault: address.id === id })));
    setMenuId(null);
    flash("Adresse par défaut mise à jour.");
  }
  function removeAddress() {
    if (!deleteId) return;
    const next = addresses.filter((address) => address.id !== deleteId);
    if (next.length && !next.some((address) => address.isDefault)) next[0] = { ...next[0], isDefault: true };
    persist(next);
    setDeleteId(null);
    flash("Adresse supprimée.");
  }
  function useMyLocation() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("La géolocalisation n’est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDraft((current) => ({
          ...current,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          landmark: current.landmark.trim() || "Position GPS enregistrée",
        }));
        setLocating(false);
        flash("Position GPS ajoutée à l’adresse.");
      },
      () => {
        setLocating(false);
        setLocationError("Position inaccessible. Autorisez la localisation dans les réglages ou saisissez l’adresse manuellement.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  return (
    <main className="min-h-dvh bg-[#E9F5EC] px-4 pb-[calc(32px+env(safe-area-inset-bottom,0px))] text-[#111111]">
      <div className="mx-auto w-full max-w-[430px] pt-3">
        <header className="mb-5 flex min-h-12 items-center gap-3">
          <Link href="/client/profil" aria-label="Retour au profil" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#1E7B3A] shadow-[0_2px_8px_rgba(0,0,0,.08)] transition-transform active:scale-95">
            <PinIcon name="back" />
          </Link>
          <h1 className="text-[24px] font-extrabold tracking-tight text-[#0F4D26]">Mes adresses</h1>
        </header>

        {!loaded ? (
          <div className="space-y-3" aria-label="Chargement des adresses">
            {[1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-white/80" />)}
          </div>
        ) : addresses.length === 0 ? (
          <section className="flex min-h-[46vh] flex-col items-center justify-center rounded-3xl bg-white px-7 py-10 text-center shadow-[0_2px_8px_rgba(0,0,0,.08)]">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E9F5EC] text-[#1E7B3A]"><PinIcon name="pin" className="h-8 w-8" /></span>
            <h2 className="text-lg font-extrabold text-[#0F4D26]">Aucune adresse enregistrée</h2>
            <p className="mt-2 max-w-[270px] text-sm leading-6 text-[#6B7280]">Ajoutez une adresse pour retrouver facilement votre lieu de livraison.</p>
            <button onClick={openNew} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1E7B3A] px-4 font-bold text-white transition-transform active:scale-[.99]"><PinIcon name="plus" className="h-5 w-5" /> Ajouter une adresse</button>
          </section>
        ) : (
          <section className="space-y-3">
            {addresses.map((address, index) => (
              <article key={address.id} style={{ animationDelay: `${index * 45}ms` }} className="naxa-address-card relative rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,.08)]">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E9F5EC] text-[#1E7B3A]"><PinIcon name={address.label === "Maison" ? "home" : address.label === "Travail" ? "work" : "pin"} /></span>
                  <div className="min-w-0 flex-1 pr-8">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-extrabold text-[#111111]">{address.label}</h2>
                      {address.isDefault && <span className="rounded-full bg-[#E2F4E7] px-2.5 py-1 text-[11px] font-bold text-[#1E7B3A]">Par défaut</span>}
                    </div>
                    <p className="mt-1 text-sm leading-5 text-[#6B7280]">{addressText(address) || "Adresse à compléter"}</p>
                    {address.landmark && <p className="mt-1 text-xs leading-5 text-[#6B7280]">Repère : {address.landmark}</p>}
                    {address.latitude != null && address.longitude != null && <p className="mt-1 text-xs text-[#6B7280]">Position GPS enregistrée</p>}
                  </div>
                  <button type="button" aria-label={`Options pour l’adresse ${address.label}`} aria-expanded={menuId === address.id} onClick={() => setMenuId(menuId === address.id ? null : address.id)} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-[#6B7280] transition-colors hover:bg-[#E9F5EC]"><PinIcon name="more" /></button>
                </div>
                {menuId === address.id && <div className="absolute right-3 top-14 z-20 w-52 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-xl" role="menu">
                  <button role="menuitem" onClick={() => openEdit(address)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-medium hover:bg-[#E9F5EC]"><PinIcon name="edit" className="h-4 w-4" /> Modifier</button>
                  {!address.isDefault && <button role="menuitem" onClick={() => setDefault(address.id)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-medium hover:bg-[#E9F5EC]"><PinIcon name="check" className="h-4 w-4" /> Définir par défaut</button>}
                  <button role="menuitem" onClick={() => { setDeleteId(address.id); setMenuId(null); }} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-medium text-[#B3261E] hover:bg-red-50"><PinIcon name="trash" className="h-4 w-4" /> Supprimer</button>
                </div>}
              </article>
            ))}
            <button onClick={openNew} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1E7B3A] px-4 font-bold text-white shadow-sm transition-transform active:scale-[.99]"><PinIcon name="plus" className="h-5 w-5" /> Ajouter une adresse</button>
          </section>
        )}

        <p className="mt-5 text-center text-xs leading-5 text-[#6B7280]">Vos adresses sont enregistrées sur cet appareil pour le moment.</p>
      </div>

      {sheet && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) setSheet(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="address-sheet-title" className="naxa-address-sheet w-full max-w-[430px] rounded-t-[24px] bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl">
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#D1D5DB]" />
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="address-sheet-title" className="text-xl font-extrabold text-[#0F4D26]">{editingId ? "Modifier une adresse" : "Ajouter une adresse"}</h2>
            <button type="button" onClick={() => setSheet(false)} aria-label="Fermer" className="flex h-10 w-10 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#F3F4F6]"><PinIcon name="close" /></button>
          </div>
          <div className="max-h-[70dvh] space-y-3 overflow-y-auto pb-1">
            <div>
              <p className="mb-2 text-sm font-semibold text-[#374151]">Libellé</p>
              <div className="grid grid-cols-3 gap-2">
                {(["Maison", "Travail", "Autre"] as const).map((label) => <button key={label} type="button" onClick={() => setDraft((current) => ({ ...current, label }))} className={`min-h-11 rounded-xl border px-2 text-sm font-bold transition-colors ${draft.label === label ? "border-[#1E7B3A] bg-[#E9F5EC] text-[#1E7B3A]" : "border-[#E5E7EB] bg-white text-[#6B7280]"}`}>{label}</button>)}
              </div>
            </div>
            {([
              ["city", "Ville", "Ex. Douala"],
              ["neighborhood", "Quartier", "Ex. Bonanjo"],
              ["street", "Rue et numéro", "Ex. Rue Paix, immeuble 12"],
              ["landmark", "Point de repère (facultatif)", "Ex. en face de la pharmacie"],
            ] as const).map(([key, label, placeholder]) => <label key={key} className="block text-sm font-semibold text-[#374151]">{label}<input value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} maxLength={key === "landmark" ? 180 : 120} className="mt-1.5 min-h-12 w-full rounded-xl border border-[#D1D5DB] bg-white px-3 text-[16px] font-normal text-[#111111] outline-none transition focus:border-[#1E7B3A] focus:ring-2 focus:ring-[#1E7B3A]/15" /></label>)}
            <button type="button" onClick={useMyLocation} disabled={locating} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#1E7B3A] px-3 text-sm font-bold text-[#1E7B3A] disabled:opacity-60"><PinIcon name="location" className="h-5 w-5" />{locating ? "Localisation…" : "Utiliser ma position"}</button>
            {locationError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-[#B3261E]">{locationError}</p>}
            {draft.latitude != null && draft.longitude != null && <p className="text-xs text-[#6B7280]">Coordonnées GPS ajoutées à cette adresse.</p>}
            <button type="button" role="switch" aria-checked={draft.isDefault} onClick={() => setDraft((current) => ({ ...current, isDefault: !current.isDefault }))} className="flex min-h-12 w-full items-center justify-between gap-3 py-1 text-left">
              <span className="text-sm font-semibold text-[#111111]">Définir par défaut</span>
              <span className={`relative h-6 w-11 rounded-full transition-colors ${draft.isDefault ? "bg-[#1E7B3A]" : "bg-[#D1D5DB]"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${draft.isDefault ? "translate-x-[22px]" : "translate-x-0.5"}`} /></span>
            </button>
          </div>
          <button type="button" onClick={saveAddress} className="mt-4 min-h-12 w-full rounded-xl bg-[#1E7B3A] px-4 font-extrabold text-white transition-transform active:scale-[.99]">Enregistrer</button>
          <button type="button" onClick={() => setSheet(false)} className="mt-1 min-h-11 w-full font-semibold text-[#6B7280]">Annuler</button>
        </section>
      </div>}

      {deleteId && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteId(null); }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="delete-address-title" className="w-full max-w-[360px] rounded-2xl bg-white p-5 shadow-2xl">
          <h2 id="delete-address-title" className="text-lg font-extrabold text-[#0F4D26]">Supprimer cette adresse ?</h2>
          <p className="mt-2 text-sm leading-6 text-[#6B7280]">Cette adresse sera retirée de votre liste enregistrée sur cet appareil.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setDeleteId(null)} className="min-h-11 rounded-xl border border-[#E5E7EB] font-bold text-[#374151]">Annuler</button>
            <button type="button" onClick={removeAddress} className="min-h-11 rounded-xl bg-[#B3261E] font-bold text-white">Supprimer</button>
          </div>
        </section>
      </div>}

      {toast && <div role="status" aria-live="polite" className="naxa-profile-toast fixed left-1/2 top-4 z-[150] -translate-x-1/2 rounded-full bg-[#0F4D26] px-4 py-3 text-sm font-semibold text-white shadow-lg">{toast}</div>}
    </main>
  );
}
