"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";
import { ContacterPharmacie } from "@/components/ContacterPharmacie";
import { BoutonNotifications } from "@/components/BoutonNotifications";
import { ActionProtegee } from "@/components/ActionProtegee";
import { usePanier, MAX_LIGNES } from "@/lib/panier";
import { Logo } from "@/components/Logo";

type Produit = {
  id: string;
  nom: string;
  dci: string | null;
  dosage: string | null;
  forme: string | null;
  description: string | null;
  photo_url: string | null;
  fabricant: string | null;
  sur_ordonnance: boolean;
};
type Pharmacie = {
  id: string;
  nom: string;
  quartier: string | null;
  adresse: string | null;
  garde_debut: string | null;
  garde_fin: string | null;
};
type Stock = { prix: number | null; quantite: number };

export default function OffrePage() {
  const { pharmacieId, produitId } = useParams<{ pharmacieId: string; produitId: string }>();
  const router = useRouter();
  const { lignes, ajouter } = usePanier();
  const [produit, setProduit] = useState<Produit | null>(null);
  const [pharmacie, setPharmacie] = useState<Pharmacie | null>(null);
  const [stock, setStock] = useState<Stock | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [quantite, setQuantite] = useState(1);

  useEffect(() => {
    let actif = true;
    async function charger() {
      setChargement(true);
      setErreur("");
      const sb = supabaseBrowser();
      const [resultatProduit, resultatPharmacie, resultatStock] = await Promise.all([
        sb.from("produits")
          .select("id,nom,dci,dosage,forme,description,photo_url,fabricant,sur_ordonnance")
          .eq("id", produitId)
          .maybeSingle(),
        sb.from("pharmacies")
          .select("id,nom,quartier,adresse,garde_debut,garde_fin")
          .eq("id", pharmacieId)
          .maybeSingle(),
        sb.rpc("marketplace_offre_stock_disponible", {
          p_pharmacie: pharmacieId,
          p_produit: produitId,
        }).maybeSingle(),
      ]);

      if (!actif) return;
      if (resultatProduit.error || resultatPharmacie.error || !resultatProduit.data || !resultatPharmacie.data) {
        setErreur("Cette fiche n'est pas disponible pour le moment. Réessayez dans quelques instants.");
      } else {
        setProduit(resultatProduit.data as Produit);
        setPharmacie(resultatPharmacie.data as Pharmacie);
        if (!resultatStock.error && resultatStock.data) {
          const donneesStock = resultatStock.data as Stock;
          setStock({ prix: donneesStock.prix, quantite: Math.max(0, donneesStock.quantite || 0) });
          setQuantite((ancienne) => Math.max(1, Math.min(ancienne, 10, donneesStock.quantite || 1)));
        } else {
          setStock(null);
        }
      }
      setChargement(false);
    }
    void charger().catch(() => {
      if (!actif) return;
      setErreur("Impossible de charger cette fiche pour le moment.");
      setChargement(false);
    });
    return () => { actif = false; };
  }, [pharmacieId, produitId]);

  // La disponibilité est recalculée côté base en tenant compte des lots utilisables.
  // Relecture à chaque mise à jour du stock et au retour sur la page (fallback si Realtime n'est pas activé).
  useEffect(() => {
    let actif = true;
    const sb = supabaseBrowser();
    const rafraichirStock = async () => {
      const { data, error: erreurStock } = await sb.rpc("marketplace_offre_stock_disponible", {
        p_pharmacie: pharmacieId,
        p_produit: produitId,
      }).maybeSingle();
      if (!actif || erreurStock) return;
      if (!data) {
        setStock(null);
        return;
      }
      const stockActuel = data as Stock;
      setStock({ prix: stockActuel.prix, quantite: Math.max(0, stockActuel.quantite || 0) });
      setQuantite((ancienne) => Math.max(1, Math.min(ancienne, 10, stockActuel.quantite || 1)));
    };
    const channel = sb
      .channel(`marketplace-stock-${pharmacieId}-${produitId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "stocks",
        filter: `pharmacie_id=eq.${pharmacieId}`,
      }, (payload) => {
        const record = (payload.new || payload.old) as { produit_id?: string } | null;
        if (record?.produit_id === produitId) void rafraichirStock();
      })
      .subscribe();
    const onFocus = () => { void rafraichirStock(); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void rafraichirStock();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      actif = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      void sb.removeChannel(channel);
    };
  }, [pharmacieId, produitId]);

  const dejaAuPanier = Boolean(produit && lignes.some((ligne) => ligne.produit_id === produit.id));
  const panierPlein = Boolean(produit && !dejaAuPanier && lignes.length >= MAX_LIGNES);
  const disponible = Boolean(stock && stock.quantite > 0);
  const quantiteMax = Math.max(1, Math.min(10, stock?.quantite ?? 1));

  function ajouterAuPanier() {
    if (!produit || !stock || stock.quantite < 1) {
      setErreur("Ce médicament n'est pas disponible dans le stock communiqué par cette pharmacie.");
      return;
    }
    if (panierPlein) {
      setErreur("Votre panier contient déjà le nombre maximal de produits différents. Retirez-en un avant de continuer.");
      return;
    }
    setErreur("");
    ajouter(
      { produit_id: produit.id, nom: produit.nom, dosage: produit.dosage || "" },
      Math.min(quantite, stock.quantite, 10),
    );
    router.push("/panier");
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 pb-28">
      <header className="-mx-4 flex items-center justify-between bg-naxa-green-900 px-4 py-3 text-white">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-2xl hover:bg-white/10"
          aria-label="Retour à la page précédente"
        >←</button>
        <Link href="/" aria-label="Accueil NAXA"><Logo taille={32} /></Link>
        <BoutonNotifications />
      </header>

      <nav aria-label="Fil d’Ariane" className="py-4 text-sm text-slate-500">
        <Link href="/recherche" className="font-semibold text-naxa-green-800 hover:underline">Recherche</Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <span className="text-slate-700">Détails du produit</span>
      </nav>

      {chargement && (
        <section className="carte flex min-h-40 items-center justify-center gap-3 text-sm text-slate-600" role="status">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-naxa-green-700 border-t-transparent" aria-hidden="true" />
          Chargement des informations du produit…
        </section>
      )}

      {!chargement && erreur && (
        <section className="carte mt-2 border-red-200" role="alert">
          <p className="font-bold text-red-700">Fiche indisponible</p>
          <p className="mt-1 text-sm text-slate-600">{erreur}</p>
          <button type="button" className="btn btn-vert mt-4 w-full" onClick={() => router.refresh()}>
            Réessayer
          </button>
        </section>
      )}

      {produit && pharmacie && !chargement && (
        <>
          <section className="overflow-hidden rounded-2xl border border-naxa-green-100 bg-white shadow-sm">
            <div className="relative flex min-h-64 items-center justify-center bg-gradient-to-b from-naxa-green-50 to-white p-6">
              {produit.photo_url ? (
                <img
                  src={produit.photo_url}
                  alt={`Photo du produit ${produit.nom}`}
                  className="h-56 w-full object-contain"
                />
              ) : (
                <div className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-naxa-green-200 bg-white/70 text-naxa-green-800">
                  <span className="text-4xl" aria-hidden="true">＋</span>
                  <span className="text-sm font-semibold">Photo non disponible</span>
                </div>
              )}
              {produit.sur_ordonnance && (
                <span className="absolute left-4 top-4 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900">
                  Sur ordonnance
                </span>
              )}
            </div>

            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-naxa-green-700">Détails du produit</p>
              <h1 className="mt-2 text-2xl font-black leading-tight text-naxa-green-900">{produit.nom}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {[produit.dci, produit.dosage, produit.forme].filter(Boolean).join(" · ") || "Informations complémentaires non renseignées"}
              </p>

              {stock?.prix !== null && stock?.prix !== undefined ? (
                <p className="mt-5 text-3xl font-black text-naxa-green-900">{fcfa(stock.prix)}</p>
              ) : (
                <p className="mt-5 text-sm font-semibold text-slate-600">Prix non communiqué par cette pharmacie</p>
              )}
              <p className="mt-1 text-xs text-slate-500">Prix communiqué par la pharmacie, à confirmer avant achat.</p>

              <div className={`mt-5 flex items-center gap-2 rounded-xl p-3 ${disponible ? "bg-naxa-green-50" : "bg-slate-50"}`}>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${disponible ? "bg-green-600" : "bg-slate-400"}`} aria-hidden="true" />
                <div>
                  <p className="text-sm font-bold text-slate-800">{disponible ? "Stock communiqué comme disponible" : "Disponibilité non confirmée"}</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {disponible ? `${stock?.quantite} unité(s) indiquée(s) en stock` : "Contactez la pharmacie pour vérifier le stock actuel."}
                  </p>
                </div>
              </div>

              {produit.fabricant && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fabricant</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{produit.fabricant}</p>
                </div>
              )}
              {produit.description && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <h2 className="font-bold text-naxa-green-900">À propos de ce produit</h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{produit.description}</p>
                </div>
              )}
              <p className="mt-5 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                Les informations affichées ne remplacent pas les conseils d’un professionnel de santé. NAXA ne fournit pas de posologie.
              </p>
            </div>
          </section>

          <section className="carte mt-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-naxa-green-50 text-xl" aria-hidden="true">⌖</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-naxa-green-700">Pharmacie partenaire</p>
                <h2 className="mt-1 text-lg font-extrabold text-naxa-green-900">{pharmacie.nom}</h2>
                {(pharmacie.quartier || pharmacie.adresse) && (
                  <p className="mt-1 text-sm leading-5 text-slate-600">{[pharmacie.quartier, pharmacie.adresse].filter(Boolean).join(" · ")}</p>
                )}
                {pharmacie.garde_debut && pharmacie.garde_fin && (
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-semibold">Horaires communiqués :</span> {pharmacie.garde_debut} – {pharmacie.garde_fin}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500">Confirmez le prix et la disponibilité directement auprès de l’équipe officinale.</p>
              </div>
            </div>
          </section>

          <section className="carte mt-4">
            <h2 className="font-extrabold text-naxa-green-900">Ajouter au panier</h2>
            <p className="mt-1 text-sm text-slate-600">Choisissez la quantité souhaitée, dans la limite du stock indiqué.</p>
            <div className="mt-4 flex items-center justify-between gap-4">
              <label htmlFor="quantite-produit" className="text-sm font-semibold text-slate-800">Quantité</label>
              <select
                id="quantite-produit"
                className="champ !w-28"
                value={Math.min(quantite, quantiteMax)}
                onChange={(event) => setQuantite(Number(event.target.value))}
                disabled={!disponible}
              >
                {Array.from({ length: disponible ? quantiteMax : 1 }, (_, index) => index + 1).map((nombre) => (
                  <option key={nombre} value={nombre}>{nombre}</option>
                ))}
              </select>
            </div>
            {panierPlein && (
              <p className="mt-3 text-sm font-semibold text-amber-800" role="status">
                Le panier a atteint sa limite de {MAX_LIGNES} produits différents.
              </p>
            )}
            {erreur && <p className="mt-3 text-sm text-red-700" role="alert">{erreur}</p>}
            <ActionProtegee
              href="/panier"
              className="btn btn-canari mt-4 w-full"
              onAutorise={ajouterAuPanier}
              aria-label={`Ajouter ${produit.nom} au panier`}
            >
              {panierPlein ? "Panier plein" : dejaAuPanier ? "Ajouter une quantité au panier" : "Ajouter au panier"}
            </ActionProtegee>
            <p className="mt-3 text-center text-xs text-slate-500">Aucun paiement n’est effectué sur cette page.</p>
          </section>

          <div className="mt-4">
            <ContacterPharmacie pharmacieId={pharmacieId} produitId={produitId} variante="flottant" />
          </div>
        </>
      )}
    </main>
  );
}
