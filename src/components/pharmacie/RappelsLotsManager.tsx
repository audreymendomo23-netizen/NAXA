"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Profile = { id: string; role: string; actif: boolean; pharmacie_id: string | null; fonction_interne: string | null };
type Pharmacy = { id: string; nom: string };
type StockProduct = { produit_id: string; quantite: number; emplacement: string | null; produits: { nom: string; dosage: string | null } | null };
type Lot = { id: string; pharmacie_id: string; produit_id: string; numero_lot: string; date_peremption: string; quantite: number; bloque: boolean; motif_blocage: string | null; produits: { nom: string; dosage: string | null } | null };
type Recall = { id: string; lot_id: string; reference_rappel: string | null; motif: string; statut: "actif" | "leve"; date_rappel: string; leve_at: string | null; leve_par: string | null; quantite_trouvee: number | null; quantite_isolee: number | null; compte_at: string | null };
type SaleImpact = { lot_id: string; quantite: number; ventes: { id: string; numero_vente: string; created_at: string; pharmacie_id: string; prescription_id: string | null } | null };
type OrdonnanceImpact = { lot_id: string; vente_id: string; reference_interne: string | null; designation: string; quantite_dispensee: number; statut: string; dispensed_at: string | null; created_at: string };
type Traitement = { id: string; rappel_id: string; lot_id: string; type: "retour_fournisseur" | "destruction"; quantite: number; reference: string | null; motif: string; created_at: string };
type PurchaseCost = { produit_id: string; cout_unitaire: number; devise: string };

export function RappelsLotsManager() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [pharmacieId, setPharmacieId] = useState("");
  const [stocks, setStocks] = useState<StockProduct[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [rappels, setRappels] = useState<Recall[]>([]);
  const [impacts, setImpacts] = useState<SaleImpact[]>([]);
  const [ordonnances, setOrdonnances] = useState<OrdonnanceImpact[]>([]);
  const [traitements, setTraitements] = useState<Traitement[]>([]);
  const [purchaseCosts, setPurchaseCosts] = useState<PurchaseCost[]>([]);
  const [canViewCosts, setCanViewCosts] = useState(false);
  const [sorties, setSorties] = useState<Record<string, { type: "retour_fournisseur" | "destruction"; quantite: string; reference: string; motif: string }>>({});
  const [canManage, setCanManage] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [produitId, setProduitId] = useState("");
  const [numeroLot, setNumeroLot] = useState("");
  const [peremption, setPeremption] = useState("");
  const [quantiteLot, setQuantiteLot] = useState("");
  const [lotSource, setLotSource] = useState("");
  const [lotRappel, setLotRappel] = useState("");
  const [motif, setMotif] = useState("");
  const [reference, setReference] = useState("");
  const [comptages, setComptages] = useState<Record<string, { trouvee: string; isolee: string }>>({});

  useEffect(() => {
    void (async () => {
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) { router.replace("/connexion?retour=/pharmacie/rappels-lots"); return; }
      const { data: p, error: profileError } = await sb.from("profiles")
        .select("id,role,actif,pharmacie_id,fonction_interne").eq("id", auth.user.id).maybeSingle();
      if (profileError || !p || p.actif !== true) { setErreur("Compte actif requis pour consulter les rappels de lot."); setChargement(false); return; }
      const current = p as Profile;
      setProfile(current);
      if (current.role === "promoteur") {
        const { data: links, error: linkError } = await sb.from("promoteur_pharmacies")
          .select("pharmacie_id").eq("promoteur_id", current.id).eq("actif", true);
        if (linkError || !links?.length) { setErreur("Aucune pharmacie active n’est rattachée à votre réseau."); setChargement(false); return; }
        const ids = [...new Set(links.map((x) => x.pharmacie_id))];
        const { data: ph, error: phError } = await sb.from("pharmacies").select("id,nom").in("id", ids).order("nom");
        if (phError || !ph?.length) { setErreur("Impossible de charger les pharmacies du réseau."); setChargement(false); return; }
        setPharmacies(ph as Pharmacy[]);
        const requested = new URLSearchParams(window.location.search).get("pharmacie");
        setPharmacieId(ids.includes(requested || "") ? requested! : ph[0].id);
      } else if (current.pharmacie_id) {
        setPharmacieId(current.pharmacie_id);
        const { data: ph } = await sb.from("pharmacies").select("id,nom").eq("id", current.pharmacie_id).maybeSingle();
        if (ph) setPharmacies([ph as Pharmacy]);
      } else {
        setErreur("Ce compte n’est rattaché à aucune pharmacie.");
        setChargement(false);
      }
    })();
  }, [router, sb]);

  const charger = useCallback(async () => {
    if (!pharmacieId || !profile) return;
    setChargement(true); setErreur("");
    const [{ data: stockData, error: stockError }, { data: lotData, error: lotError }, { data: recallData, error: recallError }, { data: privilege, error: privilegeError }, { data: costPrivilege, error: costPrivilegeError }] = await Promise.all([
      sb.from("stocks").select("produit_id,quantite,emplacement,produits(nom,dosage)").eq("pharmacie_id", pharmacieId).order("produit_id"),
      sb.from("stocks_lots").select("id,pharmacie_id,produit_id,numero_lot,date_peremption,quantite,bloque,motif_blocage,produits(nom,dosage)").eq("pharmacie_id", pharmacieId).order("date_peremption"),
      sb.from("rappels_lots").select("id,lot_id,reference_rappel,motif,statut,date_rappel,leve_at,leve_par,quantite_trouvee,quantite_isolee,compte_at").eq("pharmacie_id", pharmacieId).order("date_rappel", { ascending: false }).limit(100),
      sb.rpc("naxa_has_privilege", { p_privilege: "MANAGE_LOTS", p_pharmacie: pharmacieId, p_scope: "PHARMACIE" }),
      sb.rpc("naxa_has_privilege", { p_privilege: "VIEW_PURCHASE_COST", p_pharmacie: pharmacieId, p_scope: "PHARMACIE" }),
    ]);
    if (stockError || lotError || recallError) { setErreur("Impossible de charger les lots et rappels. Vérifiez les droits et la connexion."); setChargement(false); return; }
    setStocks((stockData ?? []) as unknown as StockProduct[]);
    setLots((lotData ?? []) as unknown as Lot[]);
    setRappels((recallData ?? []) as Recall[]);
    const allowedFunction = ["pharmacien", "pharmacien_assistant", "responsable"].includes(profile.fonction_interne || "");
    setCanManage(profile.role === "promoteur" || (profile.role !== "caisse" && profile.fonction_interne !== "caisse" && (allowedFunction || (!privilegeError && privilege === true))));
    const viewCosts = profile.role === "promoteur" || profile.fonction_interne === "comptable" || (!costPrivilegeError && costPrivilege === true);
    setCanViewCosts(viewCosts);
    if (viewCosts) {
      const productIds = [...new Set((lotData ?? []).map((l) => l.produit_id))];
      if (productIds.length) {
        const { data: costRows } = await sb.from("stocks_couts").select("produit_id,cout_unitaire,devise").eq("pharmacie_id", pharmacieId).in("produit_id", productIds);
        setPurchaseCosts((costRows ?? []) as PurchaseCost[]);
      } else setPurchaseCosts([]);
      const { data: treatmentRows } = await sb.from("rappels_lots_traitements").select("id,rappel_id,lot_id,type,quantite,reference,motif,created_at").eq("pharmacie_id", pharmacieId).order("created_at", { ascending: false }).limit(100);
      setTraitements((treatmentRows ?? []) as Traitement[]);
    } else { setPurchaseCosts([]); setTraitements([]); }
    const activeIds = (recallData ?? []).filter((r) => r.statut === "actif").map((r) => r.lot_id);
    if ((profile.role === "promoteur" || profile.fonction_interne === "pharmacien_assistant") && activeIds.length) {
      const { data: sold } = await sb.from("vente_lignes").select("lot_id,quantite,ventes!inner(id,numero_vente,created_at,pharmacie_id,prescription_id)").in("lot_id", activeIds);
      const sales = (sold ?? []) as unknown as SaleImpact[];
      if (profile.role === "promoteur") { setImpacts(sales); setOrdonnances([]); }
      else {
        setImpacts([]);
        const prescriptionSales = [...new Set(sales.filter((s) => s.ventes?.prescription_id).map((s) => s.ventes!.id))];
        if (prescriptionSales.length) {
          const { data: orderRows } = await sb.from("ordonnancier").select("vente_id,reference_interne,designation,quantite_dispensee,statut,dispensed_at,created_at").in("vente_id", prescriptionSales).eq("pharmacie_id", pharmacieId);
          const saleLots = new Map<string, string[]>();
          for (const sale of sales) if (sale.ventes?.prescription_id) saleLots.set(sale.ventes.id, [...(saleLots.get(sale.ventes.id) ?? []), sale.lot_id]);
          setOrdonnances((orderRows ?? []).flatMap((o) => (saleLots.get(o.vente_id) ?? []).map((lot_id) => ({ ...o, lot_id }))) as OrdonnanceImpact[]);
        } else setOrdonnances([]);
      }
    } else { setImpacts([]); setOrdonnances([]); }
    setChargement(false);
  }, [pharmacieId, profile, sb]);

  useEffect(() => { void charger(); }, [charger]);

  const lotsProduit = lots.filter((lot) => lot.produit_id === produitId);
  const stockProduit = stocks.find((stock) => stock.produit_id === produitId);
  const rappelsActifs = rappels.filter((r) => r.statut === "actif");
  const lotMap = useMemo(() => new Map(lots.map((lot) => [lot.id, lot])), [lots]);
  const impactsParLot = useMemo(() => {
    const map = new Map<string, SaleImpact[]>();
    for (const item of impacts) map.set(item.lot_id, [...(map.get(item.lot_id) ?? []), item]);
    return map;
  }, [impacts]);

  async function enregistrerLot() {
    if (!pharmacieId || !produitId || !numeroLot.trim() || !peremption || !quantiteLot || busy) return;
    setBusy(true); setErreur(""); setMessage("");
    const { error } = await sb.rpc("stock_lot_enregistrer", {
      p_pharmacie: pharmacieId, p_produit: produitId, p_numero_lot: numeroLot.trim(),
      p_date_peremption: peremption, p_quantite: Number(quantiteLot), p_lot_source: lotsProduit.length ? lotSource || null : null,
    });
    if (error) setErreur(error.message || "Lot non enregistré. Vérifiez la quantité agrégée et le lot source.");
    else { setMessage("Lot enregistré sans modifier la quantité totale du stock."); setNumeroLot(""); setPeremption(""); setQuantiteLot(""); setLotSource(""); await charger(); }
    setBusy(false);
  }

  async function declarerRappel() {
    if (!lotRappel || motif.trim().length < 5 || busy) return;
    setBusy(true); setErreur(""); setMessage("");
    const { error } = await sb.rpc("lot_rappeler", { p_lot: lotRappel, p_motif: motif.trim(), p_reference: reference.trim() || null });
    if (error) setErreur(error.message || "Le rappel n’a pas été enregistré.");
    else { setMessage("Rappel enregistré : le lot est bloqué dans le stock canonique et le POS le refusera."); setMotif(""); setReference(""); await charger(); }
    setBusy(false);
  }

  async function enregistrerComptage(rappel: Recall) {
    const values = comptages[rappel.id] ?? { trouvee: String(rappel.quantite_trouvee ?? ""), isolee: String(rappel.quantite_isolee ?? "") };
    const trouvee = Number(values.trouvee), isolee = Number(values.isolee);
    if (!Number.isSafeInteger(trouvee) || !Number.isSafeInteger(isolee) || trouvee < 0 || isolee < 0 || isolee > trouvee || busy) {
      setErreur("Comptage invalide : les unités isolées doivent être comprises entre 0 et les unités retrouvées."); return;
    }
    setBusy(true); setErreur(""); setMessage("");
    const { error } = await sb.rpc("lot_quarantaine_compter", { p_rappel: rappel.id, p_quantite_trouvee: trouvee, p_quantite_isolee: isolee });
    if (error) setErreur(error.message || "Comptage non enregistré.");
    else { setMessage("Comptage de quarantaine enregistré sans modifier le stock ni les prix."); await charger(); }
    setBusy(false);
  }

  async function traiterSortie(rappel: Recall) {
    const values = sorties[rappel.id] ?? { type: "retour_fournisseur" as const, quantite: "", reference: "", motif: "" };
    const quantite = Number(values.quantite);
    if (!Number.isSafeInteger(quantite) || quantite <= 0 || values.motif.trim().length < 5 || busy) {
      setErreur("Renseignez une quantité positive et un motif de 5 à 500 caractères."); return;
    }
    setBusy(true); setErreur(""); setMessage("");
    const { error } = await sb.rpc("lot_rappel_traiter_sortie", { p_rappel: rappel.id, p_type: values.type, p_quantite: quantite, p_reference: values.reference.trim() || null, p_motif: values.motif.trim() });
    if (error) setErreur(error.message || "Sortie de lot non enregistrée.");
    else { setMessage(values.type === "retour_fournisseur" ? "Retour fournisseur enregistré et stock décrémenté." : "Destruction enregistrée et stock décrémenté."); setSorties((old) => ({ ...old, [rappel.id]: { ...values, quantite: "", reference: "", motif: "" } })); await charger(); }
    setBusy(false);
  }

  async function leverRappel(rappel: Recall) {
    if (busy || profile?.role !== "promoteur") return;
    if (!window.confirm("Confirmez-vous la clôture du rappel ? Le blocage antérieur du lot sera conservé, s’il existait.")) return;
    setBusy(true); setErreur(""); setMessage("");
    const { error } = await sb.rpc("lot_lever_rappel", { p_lot: rappel.lot_id });
    if (error) setErreur(error.message || "Clôture refusée. Seul le Promoteur peut clôturer le rappel.");
    else { setMessage("Rappel clôturé et historique conservé."); await charger(); }
    setBusy(false);
  }

  const nomPharmacie = pharmacies.find((p) => p.id === pharmacieId)?.nom ?? "Pharmacie";
  return <main className="mx-auto min-h-dvh max-w-5xl space-y-5 px-4 py-5 pb-20 text-slate-900">
    <header className="rounded-3xl bg-[#0B3D26] p-5 text-white sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-white/70">NAXA · ERP pharmacie · F64</p>
      <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Rappels de lots</h1>
      <p className="mt-2 max-w-3xl text-sm text-white/80">Déclarez un avis de retrait, bloquez le lot dans le stock canonique et gardez une trace de la clôture. Le paiement et les ventes restent dans le POS existant.</p>
      {pharmacies.length > 1 && <label className="mt-4 block text-sm font-semibold">Pharmacie du réseau<select className="champ mt-1 w-full max-w-lg text-slate-900" value={pharmacieId} onChange={(e) => setPharmacieId(e.target.value)}>{pharmacies.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}</select></label>}
    </header>
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {erreur && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{erreur}</p>}
    <section className="grid gap-3 sm:grid-cols-3">
      <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Lots connus</p><p className="text-2xl font-extrabold">{lots.length}</p></article>
      <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Rappels actifs</p><p className="text-2xl font-extrabold text-red-700">{rappelsActifs.length}</p></article>
      <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Pharmacie</p><p className="truncate text-lg font-extrabold">{nomPharmacie}</p></article>
    </section>

    {canManage && <section className="rounded-2xl border bg-white p-4 sm:p-5">
      <h2 className="text-lg font-extrabold">Enregistrer un lot</h2>
      <p className="mt-1 text-sm text-slate-600">Le premier lot reprend tout le stock agrégé actuel. Pour ajouter un second lot, transférez une quantité depuis un lot source ; le total de stock ne change pas. La date doit venir de l’emballage ou du document fournisseur, jamais être inventée.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Produit<select className="champ mt-1 w-full" value={produitId} onChange={(e) => { setProduitId(e.target.value); setLotSource(""); const n = lots.filter((l) => l.produit_id === e.target.value); const s = stocks.find((x) => x.produit_id === e.target.value); setQuantiteLot(n.length ? "1" : String(s?.quantite ?? "")); }}><option value="">Choisir un produit</option>{stocks.filter((s) => s.quantite > 0).map((s) => <option key={s.produit_id} value={s.produit_id}>{s.produits?.nom ?? "Produit"}{s.produits?.dosage ? " · " + s.produits.dosage : ""} — stock {s.quantite}</option>)}</select></label>
        <label className="text-sm font-semibold">Numéro de lot<input className="champ mt-1 w-full" maxLength={120} value={numeroLot} onChange={(e) => setNumeroLot(e.target.value)} placeholder="Ex. B1234" /></label>
        <label className="text-sm font-semibold">Date de péremption<input className="champ mt-1 w-full" type="date" value={peremption} onChange={(e) => setPeremption(e.target.value)} /></label>
        {lotsProduit.length > 0 && <label className="text-sm font-semibold">Lot source<select className="champ mt-1 w-full" value={lotSource} onChange={(e) => setLotSource(e.target.value)}><option value="">Choisir le lot à répartir</option>{lotsProduit.filter((l) => !l.bloque && l.date_peremption >= new Date().toISOString().slice(0,10) && l.quantite > 0).map((l) => <option key={l.id} value={l.id}>{l.numero_lot} · {l.quantite} unités</option>)}</select></label>}
        <label className="text-sm font-semibold">Quantité à affecter<input className="champ mt-1 w-full" type="number" min="1" step="1" inputMode="numeric" value={quantiteLot} onChange={(e) => setQuantiteLot(e.target.value)} disabled={!produitId} /></label>
      </div>
      {produitId && lotsProduit.length === 0 && <p className="mt-2 text-xs text-amber-800">Premier lot : saisissez exactement {stockProduit?.quantite ?? 0} unité(s), car aucune quantité de lot n’est encore suivie.</p>}
      <button type="button" className="btn btn-vert mt-4" disabled={busy || !produitId || !numeroLot.trim() || !peremption || !Number.isSafeInteger(Number(quantiteLot)) || Number(quantiteLot) <= 0 || (lotsProduit.length > 0 && !lotSource)} onClick={() => void enregistrerLot()}>{busy ? "Enregistrement…" : "Enregistrer le lot"}</button>
    </section>}

    {canManage && <section className="rounded-2xl border bg-white p-4 sm:p-5">
      <h2 className="text-lg font-extrabold">Déclarer un rappel</h2>
      <p className="mt-1 text-sm text-slate-600">Le lot est bloqué immédiatement dans la source de stock utilisée par le POS. Les ventes du lot restent consultables dans l’historique POS ; aucune donnée client n’est exposée ici.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Lot concerné<select className="champ mt-1 w-full" value={lotRappel} onChange={(e) => setLotRappel(e.target.value)}><option value="">Choisir un lot</option>{lots.map((l) => <option key={l.id} value={l.id}>{l.produits?.nom ?? "Produit"} · {l.numero_lot} · {l.quantite} unités{l.bloque ? " · déjà bloqué" : ""}</option>)}</select></label>
        <label className="text-sm font-semibold">Référence de l’avis (facultative)<input className="champ mt-1 w-full" maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Fabricant / autorité / référence" /></label>
        <label className="text-sm font-semibold sm:col-span-2">Motif obligatoire<textarea className="champ mt-1 w-full" rows={2} maxLength={500} minLength={5} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Consigne de retrait et source de l’avis" /></label>
      </div>
      <button type="button" className="btn btn-vert mt-4" disabled={busy || !lotRappel || motif.trim().length < 5} onClick={() => void declarerRappel()}>{busy ? "Enregistrement…" : "Déclarer le rappel et bloquer le lot"}</button>
    </section>}

    <section className="rounded-2xl border bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-extrabold">Historique des rappels</h2><button type="button" className="btn btn-clair" onClick={() => void charger()} disabled={chargement || busy}>Actualiser</button></div>
      {chargement ? <p className="mt-3 text-sm text-slate-500">Chargement…</p> : rappels.length === 0 ? <p className="mt-3 text-sm text-slate-500">Aucun rappel enregistré pour cette pharmacie.</p> : <div className="mt-3 space-y-3">{rappels.map((r) => {
        const lot = lotMap.get(r.lot_id);
        const sold = impactsParLot.get(r.lot_id) ?? [];
        const ordersForLot = ordonnances.filter((o) => o.lot_id === r.lot_id);
        return <article key={r.id} className="rounded-xl border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-extrabold">{lot?.produits?.nom ?? "Produit"} · lot {lot?.numero_lot ?? "inconnu"}</p><p className="text-sm">{r.motif}</p><p className="text-xs text-slate-500">Référence : {r.reference_rappel ?? "—"} · Déclaré le {new Date(r.date_rappel).toLocaleString("fr-FR")}</p>{lot && <p className="mt-1 text-sm">Péremption : {new Date(lot.date_peremption).toLocaleDateString("fr-FR")} · Stock restant : {lot.quantite} · Emplacement : {stocks.find((s) => s.produit_id === lot.produit_id)?.emplacement ?? "—"} · Blocage : {lot.bloque ? lot.motif_blocage : "aucun"}</p>}</div><span className={r.statut === "actif" ? "rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800" : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"}>{r.statut === "actif" ? "ACTIF · vente bloquée" : "LEVÉ"}</span></div>
          {r.statut === "actif" && profile && !["client", "admin"].includes(profile.role) && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="font-bold text-sm">Comptage de quarantaine</p><p className="text-xs text-slate-600">Saisissez les unités retrouvées et celles physiquement isolées. Ce comptage ne modifie ni le stock ni les prix.</p><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-xs font-semibold">Unités retrouvées<input className="champ mt-1 w-full" type="number" min="0" step="1" value={comptages[r.id]?.trouvee ?? String(r.quantite_trouvee ?? "")} onChange={(e) => setComptages((old) => ({ ...old, [r.id]: { trouvee: e.target.value, isolee: old[r.id]?.isolee ?? String(r.quantite_isolee ?? "") } }))} /></label><label className="text-xs font-semibold">Unités isolées<input className="champ mt-1 w-full" type="number" min="0" step="1" value={comptages[r.id]?.isolee ?? String(r.quantite_isolee ?? "")} onChange={(e) => setComptages((old) => ({ ...old, [r.id]: { trouvee: old[r.id]?.trouvee ?? String(r.quantite_trouvee ?? ""), isolee: e.target.value } }))} /></label></div><button type="button" className="btn btn-clair mt-2" disabled={busy} onClick={() => void enregistrerComptage(r)}>Enregistrer le comptage</button>{r.compte_at && <p className="mt-1 text-xs text-slate-600">Dernier comptage : {r.quantite_trouvee ?? "—"} retrouvé(s), {r.quantite_isolee ?? "—"} isolé(s), le {new Date(r.compte_at).toLocaleString("fr-FR")}</p>}</div>}
          {canViewCosts && lot && <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm"><p className="font-bold">Valeur comptable (lecture seule)</p>{purchaseCosts.find((c) => c.produit_id === lot.produit_id) ? <><p>Valeur du stock restant au coût d’achat enregistré : {(lot.quantite * Number(purchaseCosts.find((c) => c.produit_id === lot.produit_id)!.cout_unitaire)).toLocaleString("fr-FR")} {purchaseCosts.find((c) => c.produit_id === lot.produit_id)!.devise}</p><p>Avoir attendu estimatif sur retours enregistrés : ${(traitements.filter((t) => t.rappel_id === r.id && t.type === "retour_fournisseur").reduce((sum, t) => sum + t.quantite, 0) * Number(purchaseCosts.find((c) => c.produit_id === lot.produit_id)!.cout_unitaire)).toLocaleString("fr-FR")} {purchaseCosts.find((c) => c.produit_id === lot.produit_id)!.devise}</p><p className="text-xs text-slate-500">Estimation au coût unitaire enregistré, à rapprocher de l’avoir fournisseur réel.</p></> : <p className="text-xs text-slate-500">Coût d’achat non renseigné : aucune valeur estimée.</p>}</div>}          {profile?.role === "promoteur" && r.statut === "actif" && <div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="text-sm font-bold">Ventes concernées (tickets POS)</p>{sold.length ? sold.map((s, i) => <p key={i} className="text-xs text-slate-600">{s.ventes?.numero_vente ?? "Ticket"} · {new Date(s.ventes?.created_at ?? r.date_rappel).toLocaleString("fr-FR")} · {s.quantite} unité(s)</p>) : <p className="text-xs text-slate-500">Aucune ligne de vente POS associée à ce lot.</p>}</div>}
          {profile?.fonction_interne === "pharmacien_assistant" && r.statut === "actif" && <div className="mt-3 rounded-lg bg-blue-50 p-3"><p className="text-sm font-bold">Ordonnances concernées</p>{ordersForLot.length ? ordersForLot.map((o, i) => <p key={o.vente_id + "-" + i} className="text-xs text-slate-700">{o.reference_interne ?? "Numéro d’ordre non renseigné"} · {o.designation} · {o.quantite_dispensee} unité(s) · {o.statut}</p>) : <p className="text-xs text-slate-500">Aucune ligne d’ordonnancier liée à une vente de ce lot.</p>}</div>}
          {profile?.role === "promoteur" && r.statut === "actif" && <div className="mt-3 rounded-lg border p-3"><p className="text-sm font-bold">Retour fournisseur / destruction</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="text-xs font-semibold">Type de sortie<select className="champ mt-1 w-full" value={sorties[r.id]?.type ?? "retour_fournisseur"} onChange={(e) => setSorties((old) => ({ ...old, [r.id]: { type: e.target.value as "retour_fournisseur" | "destruction", quantite: old[r.id]?.quantite ?? "", reference: old[r.id]?.reference ?? "", motif: old[r.id]?.motif ?? "" } }))}><option value="retour_fournisseur">Retour fournisseur</option><option value="destruction">Destruction</option></select></label><label className="text-xs font-semibold">Quantité<input className="champ mt-1 w-full" type="number" min="1" step="1" value={sorties[r.id]?.quantite ?? ""} onChange={(e) => setSorties((old) => ({ ...old, [r.id]: { type: old[r.id]?.type ?? "retour_fournisseur", quantite: e.target.value, reference: old[r.id]?.reference ?? "", motif: old[r.id]?.motif ?? "" } }))} /></label><label className="text-xs font-semibold sm:col-span-2">Référence du retour (facultative)<input className="champ mt-1 w-full" maxLength={120} value={sorties[r.id]?.reference ?? ""} onChange={(e) => setSorties((old) => ({ ...old, [r.id]: { type: old[r.id]?.type ?? "retour_fournisseur", quantite: old[r.id]?.quantite ?? "", reference: e.target.value, motif: old[r.id]?.motif ?? "" } }))} /></label><label className="text-xs font-semibold sm:col-span-2">Motif / preuve<textarea className="champ mt-1 w-full" rows={2} maxLength={500} value={sorties[r.id]?.motif ?? ""} onChange={(e) => setSorties((old) => ({ ...old, [r.id]: { type: old[r.id]?.type ?? "retour_fournisseur", quantite: old[r.id]?.quantite ?? "", reference: old[r.id]?.reference ?? "", motif: e.target.value } }))} /></label></div><button type="button" className="btn btn-clair mt-2" disabled={busy} onClick={() => void traiterSortie(r)}>Enregistrer la sortie et ajuster le stock</button>{traitements.filter((t) => t.rappel_id === r.id).map((t) => <p key={t.id} className="mt-2 text-xs text-slate-600">{t.type === "retour_fournisseur" ? "Retour fournisseur" : "Destruction"} · {t.quantite} unité(s) · {t.reference ?? "sans référence"} · {new Date(t.created_at).toLocaleString("fr-FR")} — {t.motif}</p>)}</div>}
          {profile?.role === "promoteur" && r.statut === "actif" && <button type="button" className="btn btn-clair mt-3" disabled={busy} onClick={() => void leverRappel(r)}>Clôturer le rappel (Promoteur)</button>}
          {r.statut === "leve" && r.leve_at && <p className="mt-2 text-xs text-slate-500">Clôturé le {new Date(r.leve_at).toLocaleString("fr-FR")}</p>}
        </article>;
      })}</div>}
    </section>
  </main>;
}
