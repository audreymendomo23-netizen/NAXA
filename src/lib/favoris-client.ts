"use client";

import { supabaseBrowser } from "@/lib/supabase/client";

export type FavoriNAXA = {
  id: string;
  nom: string;
  dosage: string;
  photo_url: string | null;
  prix: number;
  pharmacie: string;
  demo: boolean;
  savedAt: number;
};

const CLE = "naxa-favoris-v1";
const EVENEMENT = "naxa:favoris-change";

export function lireFavoris(): FavoriNAXA[] {
  if (typeof window === "undefined") return [];
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(CLE) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is FavoriNAXA =>
      !!x && typeof x.id === "string" && typeof x.nom === "string" &&
      typeof x.dosage === "string" && (typeof x.photo_url === "string" || x.photo_url === null) &&
      typeof x.prix === "number" && typeof x.pharmacie === "string" &&
      typeof x.demo === "boolean" && typeof x.savedAt === "number"
    );
  } catch {
    return [];
  }
}

export function ecrireFavoris(favoris: FavoriNAXA[]): void {
  if (typeof window === "undefined") return;
  const anciens = lireFavoris();
  try {
    window.localStorage.setItem(CLE, JSON.stringify(favoris));
    window.dispatchEvent(new CustomEvent(EVENEMENT));
    const ajoutes = favoris.filter(item => !anciens.some(old => old.id === item.id));
    if (ajoutes.length) {
      window.dispatchEvent(new CustomEvent("naxa:favori-ajoute", { detail: { ids: ajoutes.map(item => item.id), noms: ajoutes.map(item => item.nom) } }));
    }
  } catch {
    // Le cache local reste un secours si le stockage est indisponible.
  }
  void (async () => {
    try {
      const { data: { user } } = await supabaseBrowser().auth.getUser();
      if (!user) return;
      const retires = anciens.filter(old => !favoris.some(item => item.id === old.id) && !old.demo).map(item => item.id);
      const valides = favoris.filter(item => !item.demo);
      if (valides.length) {
        const { error } = await supabaseBrowser().from("favoris_client").upsert(valides.map(item => ({
          user_id: user.id, produit_ref: item.id,
          produit_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id) ? item.id : null,
          nom: item.nom.slice(0,200), dosage: item.dosage.slice(0,100), photo_url: item.photo_url,
          prix: Math.max(0, Math.trunc(item.prix)), pharmacie: item.pharmacie.slice(0,200),
          demo: false, saved_at: new Date(item.savedAt).toISOString(), updated_at: new Date().toISOString()
        })), { onConflict: "user_id,produit_ref" });
        if (error) console.warn("Synchronisation favoris différée.", error.message);
      }
      if (retires.length) await supabaseBrowser().from("favoris_client").delete().eq("user_id",user.id).in("produit_ref",retires);
    } catch { /* Les favoris locaux restent utilisables hors ligne. */ }
  })();
}

export async function synchroniserFavorisCompte(): Promise<FavoriNAXA[]> {
  if (typeof window === "undefined") return [];
  try {
    const sb = supabaseBrowser();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return lireFavoris();
    const { data, error } = await sb.from("favoris_client")
      .select("produit_ref,nom,dosage,photo_url,prix,pharmacie,demo,saved_at")
      .eq("user_id",user.id);
    if (error) return lireFavoris();
    const fusion = new Map(lireFavoris().map(item => [item.id,item]));
    for (const row of data ?? []) fusion.set(row.produit_ref, {
      id: row.produit_ref, nom: row.nom, dosage: row.dosage ?? "", photo_url: row.photo_url,
      prix: Number(row.prix ?? 0), pharmacie: row.pharmacie ?? "", demo: Boolean(row.demo),
      savedAt: row.saved_at ? new Date(row.saved_at).getTime() : Date.now()
    });
    const result = [...fusion.values()].sort((a,b)=>b.savedAt-a.savedAt).slice(0,100);
    window.localStorage.setItem(CLE,JSON.stringify(result));
    window.dispatchEvent(new CustomEvent(EVENEMENT));
    // La fusion est persistée pour transférer les favoris locaux au compte.
    const rows = result.filter(item=>!item.demo).map(item=>({
      user_id:user.id,produit_ref:item.id,
      produit_id:/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id)?item.id:null,
      nom:item.nom.slice(0,200),dosage:item.dosage.slice(0,100),photo_url:item.photo_url,
      prix:Math.max(0,Math.trunc(item.prix)),pharmacie:item.pharmacie.slice(0,200),demo:false,
      saved_at:new Date(item.savedAt).toISOString(),updated_at:new Date().toISOString()
    }));
    if(rows.length) await sb.from("favoris_client").upsert(rows,{onConflict:"user_id,produit_ref"});
    return result;
  } catch { return lireFavoris(); }
}

export function basculerFavori(item: Omit<FavoriNAXA, "savedAt">): FavoriNAXA[] {
  const actuels = lireFavoris();
  const existe = actuels.some(f => f.id === item.id);
  const suivants = existe
    ? actuels.filter(f => f.id !== item.id)
    : [{ ...item, savedAt: Date.now() }, ...actuels].slice(0, 100);
  ecrireFavoris(suivants);
  return suivants;
}

export function ecouterFavoris(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENEMENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENEMENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
