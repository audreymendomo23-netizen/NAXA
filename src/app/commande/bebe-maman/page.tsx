"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { usePanier } from "@/lib/panier";
import { Logo } from "@/components/Logo";
import { BoutonNotifications } from "@/components/BoutonNotifications";

type OwnerType = "pharmacie" | "parapharmacie";
type Created = {
  id: string;
  mode: "reservation" | "partner";
  owner_type: OwnerType;
  owner_id: string;
  expires_at: string;
};
type Group = {
  owner_type: OwnerType;
  owner_id: string;
  owner_name: string;
  lines: ReturnType<typeof usePanier>["lignes"];
};

const money = (value: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value) + " FCFA";
const ownerLabel = (owner: OwnerType) => owner === "pharmacie" ? "Pharmacie" : "Parapharmacie";

export default function FinaliserBebeMamanPage() {
  const router = useRouter();
  const { lignes, pret, retirer } = usePanier();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created[]>([]);

  const bebeMaman = useMemo(
    () => lignes.filter(line => line.type_article === "bebe-maman"),
    [lignes],
  );
  const groups = useMemo<Group[]>(() => {
    const grouped = new Map<string, Group>();
    for (const line of bebeMaman) {
      const ownerType: OwnerType | null = line.owner_type
        ?? (line.pharmacie_id ? "pharmacie" : line.partner_id ? "parapharmacie" : null);
      const ownerId = line.owner_id ?? line.pharmacie_id ?? line.partner_id;
      if (!ownerType || !ownerId || !line.universe_product_id) continue;
      const key = ownerType + ":" + ownerId;
      const current = grouped.get(key);
      if (current) current.lines.push(line);
      else grouped.set(key, {
        owner_type: ownerType,
        owner_id: ownerId,
        owner_name: line.pharmacie_nom || ownerLabel(ownerType),
        lines: [line],
      });
    }
    return Array.from(grouped.values()).sort((a, b) =>
      a.owner_name.localeCompare(b.owner_name, "fr"),
    );
  }, [bebeMaman]);

  const proprietaire = (line: (typeof bebeMaman)[number]) => ({
    type: line.owner_type ?? (line.pharmacie_id ? "pharmacie" : line.partner_id ? "parapharmacie" : undefined),
    id: line.owner_id ?? line.pharmacie_id ?? line.partner_id,
  });

  const total = bebeMaman.reduce(
    (sum, line) => sum + Number(line.prix_unitaire_fcfa || 0) * line.quantite,
    0,
  );
  const valid = bebeMaman.length > 0
    && groups.length > 0
    && groups.reduce((sum, group) => sum + group.lines.length, 0) === bebeMaman.length
    && bebeMaman.every(line => Boolean(line.universe_product_id));

  async function submit() {
    if (busy || !valid) return;
    setBusy(true);
    setError("");
    try {
      const { data: auth, error: authError } = await supabaseBrowser().auth.getUser();
      if (authError || !auth.user) {
        router.push("/connexion?retour=" + encodeURIComponent("/commande/bebe-maman"));
        return;
      }
      const p_groups = groups.map(group => ({
        owner_type: group.owner_type,
        owner_id: group.owner_id,
        items: group.lines.map(line => ({
          produit_id: line.universe_product_id,
          quantite: line.quantite,
        })),
      }));
      const { data, error: rpcError } = await supabaseBrowser().rpc(
        "creer_reservations_bebe_maman_multi_proprietaires_client",
        { p_groups },
      );
      if (rpcError) {
        throw new Error(
          rpcError.message.includes("Stock disponible insuffisant") || rpcError.message.includes("Stock insuffisant")
            ? "Le stock vient de changer. Actualisez le catalogue avant de réessayer."
            : rpcError.message.includes("48 heures")
              ? "L’établissement doit actualiser son stock avant de recevoir cette réservation."
              : "La réservation a été refusée par le contrôle serveur. Vérifiez les disponibilités et réessayez.",
        );
      }
      if (!Array.isArray(data) || data.length !== groups.length) {
        throw new Error("La confirmation serveur des réservations est incomplète.");
      }
      const reservations = data as Created[];
      if (reservations.some(item =>
        !item.id
        || !["reservation", "partner"].includes(item.mode)
        || !["pharmacie", "parapharmacie"].includes(item.owner_type)
        || !item.owner_id
      )) {
        throw new Error("Réponse serveur de réservation invalide.");
      }
      setCreated(reservations);
      bebeMaman.forEach(line => retirer(
        line.produit_id,
        line.owner_type ?? (line.pharmacie_id ? "pharmacie" : line.partner_id ? "parapharmacie" : undefined),
        line.owner_id ?? line.pharmacie_id ?? line.partner_id,
      ));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Une erreur inattendue est survenue.");
    } finally {
      setBusy(false);
    }
  }

  if (created.length) {
    return (
      <main className="mx-auto min-h-screen max-w-xl px-4 pb-24">
        <header className="-mx-4 flex items-center justify-between bg-naxa-green-900 px-4 py-3">
          <Link href="/"><Logo taille={32}/></Link>
          <h1 className="font-bold text-white">Bébé &amp; Maman</h1>
          <BoutonNotifications/>
        </header>
        <section className="carte mt-5">
          <h2 className="text-2xl font-black">Demandes enregistrées</h2>
          <p className="mt-2 text-sm text-slate-600">
            Chaque réservation a été envoyée au système de stock de son établissement propriétaire.
            Le paiement reste traité directement par le vendeur.
          </p>
          <div className="mt-4 space-y-3">
            {created.map(item => (
              <Link key={item.id}
                href={(item.mode === "partner" ? "/univers-reservation/" : "/reservation/") + item.id}
                className="block rounded-xl border p-4">
                <strong>{ownerLabel(item.owner_type)} · Réservation {item.id.slice(0, 8).toUpperCase()}</strong>
                <span className="mt-1 block text-sm text-slate-600">
                  Expire le {new Date(item.expires_at).toLocaleString("fr-FR")}
                </span>
                <span className="mt-2 block text-sm font-bold underline">Ouvrir le suivi</span>
              </Link>
            ))}
          </div>
          <Link href="/client" className="btn btn-vert mt-4 w-full">Mes transactions</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 pb-24">
      <header className="-mx-4 flex items-center justify-between bg-naxa-green-900 px-4 py-3">
        <Link href="/"><Logo taille={32}/></Link>
        <h1 className="font-bold text-white">Finaliser · Bébé &amp; Maman</h1>
        <BoutonNotifications/>
      </header>
      {!pret ? <p className="mt-5">Chargement du panier…</p> : bebeMaman.length === 0 ? (
        <section className="carte mt-5">
          <p className="font-bold">Aucun article Bébé &amp; Maman à finaliser.</p>
          <Link href="/bebe-maman" className="btn btn-vert mt-4 w-full">Retour au catalogue</Link>
        </section>
      ) : (
        <>
          <section className="carte mt-5">
            <h2 className="text-xl font-black">Réservations par établissement propriétaire</h2>
            <p className="mt-1 text-sm text-slate-600">
              Les demandes sont groupées par propriétaire. Une pharmacie utilise son ERP ; une parapharmacie utilise son catalogue et son stock propres.
            </p>
            <div className="mt-4 space-y-4">
              {groups.map(group => (
                <article key={group.owner_type + ":" + group.owner_id} className="rounded-xl border border-rose-200 p-3">
                  <h3 className="font-extrabold text-rose-800">{ownerLabel(group.owner_type)} · {group.owner_name}</h3>
                  <ul className="mt-2 space-y-2">
                    {group.lines.map(line => (
                      <li key={line.produit_id} className="flex justify-between gap-3 border-t border-rose-100 pt-2 text-sm">
                        <span>{line.quantite} × {line.nom}</span>
                        <strong className="shrink-0">
                          {typeof line.prix_unitaire_fcfa === "number"
                            ? money(line.prix_unitaire_fcfa * line.quantite)
                            : "Prix à confirmer"}
                        </strong>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-right text-sm font-bold">
                    Sous-total indicatif : {group.lines.every(line => typeof line.prix_unitaire_fcfa === "number")
                      ? money(group.lines.reduce((sum, line) => sum + Number(line.prix_unitaire_fcfa) * line.quantite, 0))
                      : "À confirmer"}
                  </p>
                </article>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <span className="font-extrabold">Total indicatif</span>
              <strong>{bebeMaman.every(line => typeof line.prix_unitaire_fcfa === "number") ? money(total) : "À confirmer"}</strong>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Les prix et disponibilités sont revérifiés par le serveur. Chaque réservation est transmise au système d’inventaire de son propriétaire. NAXA n’encaisse aucun paiement.
            </p>
          </section>
          {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
          <button type="button" disabled={busy || !valid} onClick={() => void submit()}
            className="btn btn-vert mt-4 w-full disabled:opacity-50">
            {busy ? "Enregistrement sécurisé…" : "Envoyer les réservations"}
          </button>
          <Link href="/panier" className="mt-3 block text-center text-sm font-bold underline">Retour au panier</Link>
        </>
      )}
    </main>
  );
}
