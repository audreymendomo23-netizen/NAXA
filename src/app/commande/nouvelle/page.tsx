"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { usePanier } from "@/lib/panier";
import { Logo } from "@/components/Logo";
import { BoutonNotifications } from "@/components/BoutonNotifications";

type Pharmacy = {
  id: string; nom: string; ville: string | null; quartier: string | null; adresse: string | null;
  lat: number; lng: number; livraison_active: boolean; rayon_livraison_km: number;
};
type Address = {
  city?: string; neighborhood?: string; street?: string; landmark?: string;
  latitude?: number; longitude?: number; isDefault?: boolean;
};
type RouteQuote = { km: number; minutes: number; frais: number; fournisseur: "google_routes" | "osrm"; quoteId: string; googleMapsUrl: string; expireLe: string };
type Created = {
  id: string; mode: "reservation" | "commande"; expires_at: string;
  frais_livraison?: number; distance_livraison_km?: number | null;
};

const METHODS = [
  ["mtn_marchand", "MTN Mobile Money — code marchand de la pharmacie"],
  ["orange_money", "Orange Money"],
  ["especes_retrait", "Espèces au retrait en pharmacie"],
  ["a_convenir", "À convenir directement avec la pharmacie"],
] as const;

export default function NouvelleTransactionPage() {
  const router = useRouter();
  const { lignes, pret, vider } = usePanier();
  const [pharmacie, setPharmacie] = useState<Pharmacy | null>(null);
  const [modes, setModes] = useState<Record<string, "reservation" | "commande">>({});
  const [method, setMethod] = useState("a_convenir");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [street, setStreet] = useState("");
  const [landmark, setLandmark] = useState("");
  const [phone, setPhone] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [routeQuote, setRouteQuote] = useState<RouteQuote | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created[]>([]);

  useEffect(() => {
    const id = new URLSearchParams(location.search).get("pharmacie") || "";
    void (async () => {
      const sb = supabaseBrowser();
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) {
        router.replace("/connexion?retour=" + encodeURIComponent("/commande/nouvelle?pharmacie=" + id));
        return;
      }
      const { data: profile } = await sb.from("profiles").select("phone").eq("id", auth.user.id).maybeSingle();
      setPhone(auth.user.phone || profile?.phone || "");
      try {
        const raw: unknown = JSON.parse(localStorage.getItem("naxa-client-addresses-v1") || "[]");
        if (Array.isArray(raw)) {
          const saved = raw.find((item): item is Address => Boolean(item && typeof item === "object" && (item as Address).isDefault));
          if (saved) {
            setCity(saved.city || "");
            setNeighborhood(saved.neighborhood || "");
            setStreet(saved.street || "");
            setLandmark(saved.landmark || "");
            setLat(saved.latitude ?? null);
            setLng(saved.longitude ?? null);
          }
        }
      } catch { /* L'adresse locale est facultative. */ }
      const { data: prefs } = await sb.from("client_preferences")
        .select("adresse_defaut,quartier,ville_defaut,repere_defaut,latitude_defaut,longitude_defaut")
        .eq("user_id", auth.user.id).maybeSingle();
      if (prefs) {
        setCity(value => value || prefs.ville_defaut || "");
        setNeighborhood(value => value || prefs.quartier || "");
        setStreet(value => value || prefs.adresse_defaut || "");
        setLandmark(value => value || prefs.repere_defaut || "");
        setLat(value => value ?? (typeof prefs.latitude_defaut === "number" ? prefs.latitude_defaut : null));
        setLng(value => value ?? (typeof prefs.longitude_defaut === "number" ? prefs.longitude_defaut : null));
      }
      if (id) {
        const { data, error: pharmacyError } = await sb.from("pharmacies")
          .select("id,nom,ville,quartier,adresse,lat,lng,livraison_active,rayon_livraison_km")
          .eq("id", id).maybeSingle();
        if (pharmacyError || !data) setError("Pharmacie indisponible.");
        else setPharmacie(data as Pharmacy);
      }
    })();
  }, [router]);

  useEffect(() => {
    setModes(current => {
      const next = { ...current };
      lignes.forEach(line => { if (!next[line.produit_id]) next[line.produit_id] = "reservation"; });
      Object.keys(next).forEach(id => { if (!lignes.some(line => line.produit_id === id)) delete next[id]; });
      return next;
    });
  }, [lignes]);

  const delivery = useMemo(() => lignes.some(line => modes[line.produit_id] === "commande"), [lignes, modes]);
  const allDelivery = useMemo(() => lignes.length > 0 && lignes.every(line => modes[line.produit_id] === "commande"), [lignes, modes]);
  const allReservation = useMemo(() => lignes.length > 0 && lignes.every(line => modes[line.produit_id] === "reservation"), [lignes, modes]);
  const mixedModes = lignes.length > 0 && !allDelivery && !allReservation;
  const methods = METHODS;

  useEffect(() => {
    const controller = new AbortController();
    if (!delivery || !pharmacie || lat === null || lng === null
      || !Number.isFinite(pharmacie.lat) || !Number.isFinite(pharmacie.lng)) {
      setRouteQuote(null);
      setRouteLoading(false);
      return () => controller.abort();
    }
    setRouteLoading(true);
    setRouteQuote(null);
    void (async () => {
      try {
        const response = await fetch("/api/livraison/devis", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ pharmacieId: pharmacie.id, latitude: lat, longitude: lng }),
          signal: controller.signal,
        });
        const payload = await response.json() as {
          ok?: boolean; quoteId?: string; km?: number; minutes?: number; frais?: number;
          fournisseur?: "google_routes" | "osrm"; googleMapsUrl?: string; expireLe?: string; error?: string;
        };
        if (!response.ok || !payload.ok || !payload.quoteId
          || !Number.isFinite(payload.km) || !Number.isFinite(payload.minutes)
          || !Number.isFinite(payload.frais) || !payload.fournisseur
          || !payload.googleMapsUrl || !payload.expireLe) {
          throw new Error(payload.error || "Impossible de calculer un itinéraire routier.");
        }
        if (!controller.signal.aborted) setRouteQuote({
          km: payload.km as number,
          minutes: payload.minutes as number,
          frais: payload.frais as number,
          fournisseur: payload.fournisseur,
          quoteId: payload.quoteId,
          googleMapsUrl: payload.googleMapsUrl,
          expireLe: payload.expireLe,
        });
      } catch (cause) {
        if (!controller.signal.aborted) {
          setRouteQuote(null);
          setError(cause instanceof Error ? cause.message : "Calcul routier indisponible.");
        }
      } finally {
        if (!controller.signal.aborted) setRouteLoading(false);
      }
    })();
    return () => controller.abort();
  }, [delivery, pharmacie, lat, lng]);

  const deliveryFee = useMemo(() => routeQuote?.frais ?? null, [routeQuote]);

  async function gps() {
    setError("");
    if (!navigator.geolocation) { setError("GPS non disponible."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async position => {
      const latitude = position.coords.latitude, longitude = position.coords.longitude;
      let nextCity = "", nextNeighborhood = "", nextStreet = "", nextLandmark = "";
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${latitude}&lon=${longitude}`,
          { headers: { "Accept-Language": "fr" }, cache: "no-store" },
        );
        if (response.ok) {
          const payload = await response.json() as { display_name?: string; address?: Record<string, string> };
          const address = payload.address || {};
          nextCity = address.city || address.town || address.municipality || address.village || "";
          nextNeighborhood = address.suburb || address.neighbourhood || address.quarter || address.city_district || "";
          nextStreet = [address.road, address.house_number].filter(Boolean).join(" ");
          nextLandmark = payload.display_name || "";
        }
      } catch { /* Les champs restent éditables si le géocodage échoue. */ }
      setLat(latitude); setLng(longitude);
      if (nextCity) setCity(nextCity);
      if (nextNeighborhood) setNeighborhood(nextNeighborhood);
      if (nextStreet) setStreet(nextStreet);
      if (nextLandmark && !landmark) setLandmark(nextLandmark);
      setLocating(false);
    }, () => {
      setLocating(false);
      setError("Position inaccessible. Autorisez le GPS ou vérifiez les réglages de localisation.");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  async function submit() {
    if (busy || !pharmacie || !lignes.length) return;
    setBusy(true); setError("");
    try {
      if (mixedModes) throw new Error("Séparez les réservations et les demandes de livraison en deux transactions.");
      if (delivery) {
        if (!pharmacie.livraison_active) throw new Error("Cette pharmacie n'offre pas actuellement la livraison.");
        if (!city.trim() || !neighborhood.trim() || !street.trim() || phone.trim().length < 6)
          throw new Error("Pour une livraison, renseignez la ville, le quartier, la rue et un téléphone joignable.");
        if (lat === null || lng === null) throw new Error("La position GPS est nécessaire au calcul du tarif de livraison.");
        if (!routeQuote || routeLoading || deliveryFee === null) throw new Error("Le calcul de la distance de livraison n'est pas encore disponible.");
        if (routeQuote.km > Number(pharmacie.rayon_livraison_km))
          throw new Error("Cette adresse dépasse le rayon de livraison de la pharmacie.");
      }
      const items = lignes.map(line => ({
        produit_id: line.produit_id,
        quantite: line.quantite,
        mode: modes[line.produit_id] || "reservation",
      }));
      const { data, error: rpcError } = await supabaseBrowser().rpc("creer_transactions_client", {
        p_pharmacie: pharmacie.id,
        p_items: items,
        p_paiement_mode: delivery ? null : method,
        p_adresse: {
          ville: city, quartier: neighborhood, rue: street, repere: landmark,
          telephone: phone, latitude: lat, longitude: lng,
          distance_km: routeQuote?.km ?? null,
          delivery_quote_id: routeQuote?.quoteId ?? null,
        },
      });
      if (rpcError) throw new Error(rpcError.message.includes("Stock insuffisant")
        ? "Le stock a changé. Revérifiez les disponibilités."
        : rpcError.message.includes("ne propose pas actuellement la livraison")
          ? "Cette pharmacie ne propose pas actuellement la livraison."
          : "Création impossible. Vérifiez les informations puis réessayez.");
      if (!Array.isArray(data) || !data.length) throw new Error("Aucune transaction créée.");
      setCreated(data as Created[]);
      vider();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur inattendue.");
    } finally { setBusy(false); }
  }

  if (created.length) {
    const deliveryOrder = created.find(item => item.mode === "commande");
    return (
      <main className="mx-auto min-h-screen max-w-xl px-4 pb-24">
        <header className="-mx-4 flex items-center justify-between bg-naxa-green-900 px-4 py-3">
          <Link href="/"><Logo taille={32}/></Link><BoutonNotifications/>
        </header>
        <section className="carte mt-6">
          <h1 className="text-2xl font-black">{deliveryOrder ? "Demande de livraison envoyée" : "C’est enregistré"}</h1>
          {deliveryOrder ? (
            <>
              <p className="mt-2 text-sm text-slate-700">La demande est en attente de confirmation par la pharmacie. Le Gestionnaire de stock doit accepter la prise en charge avant que vous procédiez au paiement.</p>
              <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-950">Frais de livraison estimés : {Number(deliveryOrder.frais_livraison ?? deliveryFee ?? 0).toLocaleString("fr-FR")} FCFA</p>
              <p className="mt-2 text-xs text-slate-500">Le montant affiché est le tarif total de livraison. Aucun supplément ne sera ajouté au paiement.</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">La transaction est enregistrée. Le paiement suit le mode choisi et sera confirmé par la pharmacie.</p>
          )}
          <div className="mt-4 space-y-3">
            {created.map(item => (
              <Link key={item.id} href={"/reservation/" + item.id} className="block rounded-xl border p-4">
                <strong>{item.mode === "reservation" ? "Réservation" : "Demande de livraison"}</strong>
                <span className="mt-1 block text-sm">Référence {item.id.slice(0, 8).toUpperCase()}</span>
                <span className="text-sm underline">Ouvrir le suivi</span>
              </Link>
            ))}
          </div>
          <Link href="/client/messages" className="btn btn-vert mt-4 w-full">Écrire à la pharmacie</Link>
          <Link href="/client" className="btn btn-clair mt-2 w-full">Mes transactions</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 pb-24">
      <header className="-mx-4 flex items-center justify-between bg-naxa-green-900 px-4 py-3">
        <Link href="/"><Logo taille={32}/></Link><h1 className="font-bold text-white">Finaliser</h1><BoutonNotifications/>
      </header>
      {!pret ? <p className="mt-5">Chargement…</p> : !lignes.length ? (
        <section className="carte mt-5">Votre panier est vide.<Link href="/" className="btn btn-vert mt-4 w-full">Rechercher un médicament</Link></section>
      ) : (
        <>
          {pharmacie && (
            <section className="carte mt-4">
              <h2 className="font-extrabold">{pharmacie.nom}</h2>
              <p className="text-sm text-slate-600">{[pharmacie.quartier, pharmacie.ville].filter(Boolean).join(", ")}</p>
              {delivery && !pharmacie.livraison_active && <p role="alert" className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Cette pharmacie n'a pas activé son service de livraison.</p>}
            </section>
          )}
          <section className="carte mt-4">
            <h2 className="font-extrabold">Choisissez pour chaque article</h2>
            <p className="mt-1 text-sm text-slate-600">Pour une livraison, tous les articles de cette transaction doivent être regroupés dans une même commande.</p>
            <ul className="mt-3 space-y-3">
              {lignes.map(line => (
                <li key={line.produit_id} className="rounded-xl border p-3">
                  <p className="font-bold">{line.nom}{line.dosage ? " · " + line.dosage : ""}</p>
                  <p className="text-sm text-slate-600">Quantité : {line.quantite}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(["reservation", "commande"] as const).map(mode => {
                      const disabled = mode === "commande" && !pharmacie?.livraison_active;
                      return (
                        <button key={mode} type="button" disabled={disabled}
                          onClick={() => setModes(current => ({ ...current, [line.produit_id]: mode }))}
                          aria-pressed={modes[line.produit_id] === mode}
                          className={"rounded-xl px-3 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 " +
                            (modes[line.produit_id] === mode ? "bg-naxa-green-900 text-white" : "bg-slate-100")}>
                          {mode === "reservation" ? "Réservation" : "Demander une livraison"}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
            {mixedModes && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Une réservation et une livraison ne peuvent pas être finalisées ensemble. Choisissez le même mode pour tous les articles.</p>}
          </section>
          {!delivery && (
            <section className="carte mt-4">
              <h2 className="font-extrabold">Mode de paiement</h2>
              <p className="mt-1 text-sm text-slate-600">Le paiement se fait directement entre vous et la pharmacie. NAXA ne l'encaisse pas.</p>
              <div className="mt-3 space-y-2">
                {methods.map(item => (
                  <label key={item[0]} className="flex items-start gap-3 rounded-xl border p-3 text-sm">
                    <input type="radio" name="method" checked={method === item[0]} onChange={() => setMethod(item[0])} className="mt-1"/>
                    <span>{item[1]}</span>
                  </label>
                ))}
              </div>
            </section>
          )}
          {delivery && (
            <section className="carte mt-4 space-y-3">
              <div>
                <h2 className="font-extrabold">Demande de livraison</h2>
                <p className="text-sm text-slate-600">Vous demandez d'abord la livraison. Le Gestionnaire de stock confirmera la prise en charge ; le paiement sera demandé ensuite.</p>
              </div>
              <button type="button" onClick={() => void gps()} disabled={locating} className="btn btn-clair w-full">
                {locating ? "Recherche GPS…" : "Utiliser ma position GPS"}
              </button>
              {([
                ["Ville", city, setCity], ["Quartier", neighborhood, setNeighborhood],
                ["Rue / adresse", street, setStreet], ["Repère (facultatif)", landmark, setLandmark],
                ["Téléphone joignable", phone, setPhone],
              ] as const).map(([label, value, setter]) => (
                <label key={label} className="block text-sm font-semibold">
                  {label}
                  <input value={value} onChange={event => setter(event.target.value)} className="champ mt-1" required={label !== "Repère (facultatif)"}/>
                </label>
              ))}
              {lat !== null && lng !== null && <p className="text-xs text-slate-500">GPS : {lat.toFixed(5)}, {lng.toFixed(5)}</p>}
              {routeLoading && <p className="text-sm text-slate-600">Calcul de la distance routière…</p>}
              {routeQuote && deliveryFee !== null && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-900">Distance routière calculée ({routeQuote.fournisseur === "google_routes" ? "Google Routes" : "OpenStreetMap / OSRM"}) : {routeQuote.km.toFixed(1)} km · environ {routeQuote.minutes} min</p>
                  <p className="mt-1 text-lg font-black text-emerald-950">Frais de livraison : {deliveryFee.toLocaleString("fr-FR")} FCFA</p>
                  <p className="text-xs text-emerald-900">Tarif minimum 1 500 FCFA · maximum 3 500 FCFA · devis valable 10 minutes.</p>
                  <a href={routeQuote.googleMapsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-bold text-emerald-950 underline">Voir le trajet dans Google Maps</a>
                  <p className="mt-1 text-xs text-emerald-900">Le serveur NAXA enregistrera ce devis à la création de la commande. Le paiement interviendra après acceptation par le Gestionnaire de stock.</p>
                </div>
              )}
            </section>
          )}
          {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <button type="button" disabled={!pharmacie || busy || !lignes.length || mixedModes || (delivery && (!pharmacie.livraison_active || routeLoading || !routeQuote))}
            onClick={() => void submit()} className="btn btn-vert mt-5 w-full">
            {busy ? "Enregistrement…" : delivery ? "Envoyer ma demande de livraison" : "Confirmer ma réservation"}
          </button>
          <p className="mt-2 text-center text-xs text-slate-500">Une réservation expire après 4 heures. Une demande de livraison reste en attente de confirmation par la pharmacie avant paiement.</p>
        </>
      )}
    </main>
  );
}
