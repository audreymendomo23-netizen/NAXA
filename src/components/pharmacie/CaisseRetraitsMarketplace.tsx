"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";
import { TicketPharmacyLogo } from "@/components/pharmacie/TicketPharmacyLogo";
import { printAfterImagesLoaded } from "@/lib/print-after-images";

type ReservationItem = {
  quantite: number;
  prix_unitaire: number;
  produits: { nom: string; dosage: string | null } | null;
};
type Reservation = {
  id: string;
  code_paiement: string;
  statut: string;
  total: number;
  created_at: string;
  expires_at: string;
  paiement_statut: string | null;
  paiement_mode: string | null;
  paiement_ref: string | null;
  credit_request_id: string | null;
  reservation_items: ReservationItem[] | null;
};
type AssuranceInfo={reservation_id:string;assureur_id:string;assureur:string;montant_brut_fcfa:number;montant_assureur_fcfa:number;montant_client_fcfa:number;valide_client:boolean;controle_documents_statut:string;statut_dossier:string|null;};
type QRDetector = { detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>> };
type QRDetectorConstructor = new (options?: { formats: string[] }) => QRDetector;
type Receipt = {
  transactionId: string;
  code: string;
  numero: string;
  total: number;
  montantRecu: number;
  monnaie: number;
  canal: string;
  date: string;
  items: ReservationItem[];
};
const channels = [
  { value: "especes", label: "Espèces au retrait" },
  { value: "orange_money", label: "Orange Money (paiement reçu et vérifié par la pharmacie)" },
  { value: "mtn_momo", label: "MTN MoMo (paiement reçu et vérifié par la pharmacie)" },
  { value: "mobile_money", label: "Autre Mobile Money (reçu et vérifié par la pharmacie)" },
  { value: "carte", label: "Carte (paiement reçu et vérifié par la pharmacie)" },
  { value: "autre", label: "Autre canal (paiement reçu et vérifié par la pharmacie)" },
];
const channelLabel = (value: string) => channels.find((item) => item.value === value)?.label ?? value;
const statusLabel: Record<string, string> = {
  en_attente: "En attente de confirmation pharmacie",
  confirmee: "Confirmée · paiement à constater",
  payee: "Payée · retrait à confirmer",
  retiree: "Retirée",
  annulee: "Annulée",
  expiree: "Expirée",
};

export function CaisseRetraitsMarketplace({
  pharmacieId,
  sessionId,
}: {
  pharmacieId: string | null;
  sessionId: string | null;
}) {
  const [rows, setRows] = useState<Reservation[]>([]);
  const [assuranceByReservation,setAssuranceByReservation]=useState<Record<string,AssuranceInfo>>({});
  const [codeInput, setCodeInput] = useState("");
  const [received, setReceived] = useState<Record<string, string>>({});
  const [channel, setChannel] = useState("especes");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const chargerAssurances = useCallback(async (ids:string[]) => {
    if(!ids.length){setAssuranceByReservation({});return;}
    const sb=supabaseBrowser();
    const [{data:snapshots,error:se},{data:dossiers,error:de}]=await Promise.all([
      sb.from("assurance_reservation_snapshots").select("reservation_id,assureur_id,montant_brut_fcfa,montant_assureur_fcfa,montant_client_fcfa,valide_client,controle_documents_statut").in("reservation_id",ids),
      sb.from("dossiers_assurance").select("reservation_id,statut").in("reservation_id",ids),
    ]);
    if(se||de){setError("Le détail Assurance n’a pas pu être vérifié. Aucun encaissement ne sera proposé.");setAssuranceByReservation({});return;}
    const insurerIds=[...new Set((snapshots??[]).map(x=>x.assureur_id))];
    const {data:insurers,error:ie}=insurerIds.length?await sb.from("assureurs").select("id,nom").in("id",insurerIds):{data:[] as {id:string;nom:string}[],error:null};
    if(ie){setError("Impossible de vérifier le référentiel des assureurs.");setAssuranceByReservation({});return;}
    const names=new Map((insurers??[]).map(x=>[x.id,x.nom]));
    const statuses=new Map((dossiers??[]).map(x=>[x.reservation_id,x.statut]));
    const next:Record<string,AssuranceInfo>={};
    for(const s of snapshots??[])next[s.reservation_id]={...s,assureur:names.get(s.assureur_id)??"Assureur",statut_dossier:statuses.get(s.reservation_id)??null};
    setAssuranceByReservation(next);
  },[]);

  const load = useCallback(async () => {
    if (!pharmacieId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabaseBrowser()
      .from("reservations")
      .select("id,code_paiement,statut,total,created_at,expires_at,paiement_statut,paiement_mode,paiement_ref,credit_request_id,reservation_items(quantite,prix_unitaire,produits(nom,dosage))")
      .eq("pharmacie_id", pharmacieId)
      .eq("mode", "reservation")
      .in("statut", ["en_attente", "confirmee", "payee"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (queryError) {
      setError("Impossible de charger les réservations de cette pharmacie. Aucune action n’a été effectuée.");
      setRows([]);
    } else {
      setRows((data ?? []) as unknown as Reservation[]);
    }
    setLoading(false);
  }, [pharmacieId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!cameraOpen) return;
    let active = true;
    let stream: MediaStream | null = null;
    let frame = 0;
    let detector: QRDetector | null = null;
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };
    void (async () => {
      try {
        const Detector = (window as unknown as { BarcodeDetector?: QRDetectorConstructor }).BarcodeDetector;
        if (!Detector) throw new Error("Ce navigateur ne prend pas en charge le scan QR caméra. Utilisez un lecteur QR qui saisit le code ou entrez-le manuellement.");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("La caméra exige un navigateur sécurisé (HTTPS) et une autorisation caméra.");
        detector = new Detector({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!active) { stop(); return; }
        const video = videoRef.current;
        if (!video) { stop(); return; }
        video.srcObject = stream;
        await video.play();
        const scan = async () => {
          if (!active || !videoRef.current || !detector) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes.find((item) => item.rawValue)?.rawValue;
            if (value) {
              setCodeInput(value);
              setCameraOpen(false);
              setMessage("QR code lu. Vérifiez la transaction avant de valider le paiement.");
              return;
            }
          } catch {
            // Ignore transient frame/focus errors and continue scanning.
          }
          frame = requestAnimationFrame(() => { void scan(); });
        };
        void scan();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Impossible d’ouvrir le scanner QR.");
        setCameraOpen(false);
        stop();
      }
    })();
    return () => { active = false; stop(); };
  }, [cameraOpen]);

  const normalizedCode = useMemo(() => {
    const raw = codeInput.trim().toUpperCase();
    if (raw.startsWith("NAXA:PAY:")) return raw.slice("NAXA:PAY:".length).trim();
    return raw;
  }, [codeInput]);

  async function lookupTransaction() {
    if (!pharmacieId || !normalizedCode) return;
    setError("");
    setMessage("");
    setReceipt(null);
    const sb = supabaseBrowser();
    const columns = "id,code_paiement,statut,total,created_at,expires_at,paiement_statut,paiement_mode,paiement_ref,credit_request_id,reservation_items(quantite,prix_unitaire,produits(nom,dosage))";
    const byCode = await sb.from("reservations").select(columns).eq("pharmacie_id", pharmacieId).eq("mode", "reservation").eq("code_paiement", normalizedCode).maybeSingle();
    let found = byCode.data as unknown as Reservation | null;
    let lookupError = byCode.error;
    if (!found && /^[0-9A-F-]{36}$/i.test(normalizedCode)) {
      const byId = await sb.from("reservations").select(columns).eq("pharmacie_id", pharmacieId).eq("mode", "reservation").eq("id", normalizedCode).maybeSingle();
      found = byId.data as unknown as Reservation | null;
      lookupError = byId.error;
    }
    if (lookupError) {
      setError("La transaction n’a pas pu être vérifiée. Réessayez ou actualisez la caisse.");
      return;
    }
    if (!found) {
      setError("Aucune réservation Marketplace trouvée pour ce code dans cette pharmacie.");
      return;
    }
    setRows((current) => [found as Reservation, ...current.filter((row) => row.id !== found?.id)]);
    await chargerAssurances([found.id]);
    if (found.statut !== "confirmee" && found.statut !== "payee") {
      setError("Transaction retrouvée, mais son statut ne permet pas un règlement au retrait.");
    }
  }
  const selected = useMemo(() => {
    if (!normalizedCode) return null;
    return rows.find((row) =>
      row.code_paiement?.toUpperCase() === normalizedCode ||
      row.id.toUpperCase() === normalizedCode
    ) ?? null;
  }, [normalizedCode, rows]);

  async function encaisser(row: Reservation) {
    if (!sessionId) { setError("Ouvrez une session de caisse avant de valider un paiement Marketplace."); return; }
    if (busyId) return;
    const assurance=assuranceByReservation[row.id]??null;
    const clientDue=assurance?Number(assurance.montant_client_fcfa):row.total;
    if(assurance&&(!assurance.valide_client||assurance.controle_documents_statut!=="conforme"||!["accepte","clos"].includes(assurance.statut_dossier??""))){
      setError("Le devis doit être accepté, les justificatifs contrôlés conformes et la prise en charge confirmée avant encaissement.");return;
    }
    const amount=Number(received[row.id]??String(clientDue));
    if(!Number.isSafeInteger(amount)||amount<0||(clientDue>0&&amount===0)){
      setError("Saisissez le montant réellement reçu de la part client, en FCFA.");return;
    }
    if(row.statut!=="confirmee"||row.paiement_statut==="effectue"){
      setError("Cette réservation n’est plus éligible. Actualisez la liste avant toute nouvelle action.");return;
    }
    if(new Date(row.expires_at).getTime()<=Date.now()){setError("Cette réservation a expiré. Aucun paiement ne peut être validé.");return;}
    if(!normalizedCode||normalizedCode!==row.code_paiement.toUpperCase()){
      setError("Scannez le QR code ou saisissez le code de paiement exact de cette facture.");return;
    }
    if(channel!=="especes"&&amount!==clientDue){
      setError("Pour ce canal, confirmez exactement le reste à payer du client. La part assureur est une créance, pas un paiement reçu.");return;
    }
    if(channel==="especes"&&amount<clientDue){setError("Le montant reçu est inférieur au reste à payer du client.");return;}
    const confirmed=window.confirm(
      "Confirmez-vous avoir réellement reçu "+fcfa(clientDue)+" du client via "+channelLabel(channel)+
      (assurance?". La part assureur de "+fcfa(assurance.montant_assureur_fcfa)+" sera enregistrée comme créance, jamais comme argent reçu.":"")+
      " Pour la réservation "+row.code_paiement+" ? NAXA n’initie et ne traite aucun paiement."
    );
    if(!confirmed)return;
    setBusyId(row.id);setError("");setMessage("");setReceipt(null);
    const {data,error:paymentError}=await supabaseBrowser().rpc("vente_reservation_encaisser",{
      p_reservation:row.id,p_session:sessionId,p_montant_percu:amount,p_canal:channel,p_code_paiement:normalizedCode,
    });
    if(paymentError){setError(paymentError.message||"Paiement non confirmé. Actualisez la réservation avant de réessayer.");}
    else{
      const result=Array.isArray(data)?data[0]:data;
      const change=Number(result?.monnaie_rendue??(channel==="especes"?amount-clientDue:0));
      setReceipt({
        transactionId:row.id,code:String(result?.code_paiement??row.code_paiement),
        numero:String(result?.numero_vente??"à consulter dans l’historique"),
        total:Number(result?.total??row.total),montantRecu:amount,monnaie:change,
        canal:channelLabel(channel),date:new Date().toLocaleString("fr-FR"),
        items:row.reservation_items??[],
        assurance:assurance?{assureur:assurance.assureur,partAssureur:Number(assurance.montant_assureur_fcfa),partClient:clientDue}:null,
      });
      setReceived(current=>({...current,[row.id]:""}));
      setMessage("Règlement client enregistré. La part assureur reste une créance et n’est pas présentée comme un encaissement. Le reçu Marketplace est prêt à imprimer.");
      await load();
    }
    setBusyId(null);
  }

  async function validerRetraitCredit(row: Reservation) {
    if (!sessionId) {
      setError("Ouvrez une session de caisse avant de valider le retrait à crédit.");
      return;
    }
    if (busyId) return;
    if (!row.credit_request_id || row.statut !== "confirmee" || row.paiement_statut === "effectue") {
      setError("Cette réservation n’est pas liée à une demande de crédit approuvée et retirable.");
      return;
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      setError("Cette réservation a expiré. Aucun retrait à crédit ne peut être validé.");
      return;
    }
    if (!normalizedCode || normalizedCode !== row.code_paiement.toUpperCase()) {
      setError("Scannez le QR code ou saisissez le code de paiement exact de cette réservation.");
      return;
    }
    if (!window.confirm("Confirmer le retrait des produits sur le crédit client déjà approuvé pour " + fcfa(row.total) + " ? Aucun paiement espèces ou Mobile Money ne sera déclaré.")) return;

    setBusyId(row.id);
    setError("");
    setMessage("");
    setReceipt(null);
    const { data, error: creditError } = await supabaseBrowser().rpc("vente_reservation_credit_finaliser", {
      p_reservation: row.id,
      p_session: sessionId,
      p_reference: normalizedCode,
    });
    if (creditError) {
      setError(creditError.message || "Retrait à crédit non confirmé. Actualisez la réservation avant de réessayer.");
    } else {
      const result = Array.isArray(data) ? data[0] : data;
      setReceived((current) => ({ ...current, [row.id]: "" }));
      setMessage("Retrait à crédit enregistré. Ticket " + String(result?.numero_vente ?? "créé") + " ; dette client et journal de crédit mis à jour. Aucun encaissement comptant n’a été enregistré.");
      setCodeInput("");
      await load();
    }
    setBusyId(null);
  }

  async function confirmerRetrait(row: Reservation) {
    if (!sessionId) {
      setError("Ouvrez une session de caisse avant de confirmer le retrait.");
      return;
    }
    if (busyId) return;
    if (row.statut !== "payee" || (!row.credit_request_id && row.paiement_statut !== "effectue")) {
      setError("Le retrait ne peut être confirmé qu’après validation du paiement par la pharmacie.");
      return;
    }
    if (!window.confirm("Confirmer la remise des produits de la réservation " + row.code_paiement + " ?")) return;
    setBusyId(row.id);
    setError("");
    setMessage("");
    const { error: transitionError } = await supabaseBrowser().rpc("set_reservation_status", {
      p_id: row.id,
      p_statut: "retiree",
    });
    if (transitionError) {
      setError("Retrait non confirmé. Vérifiez le statut actuel avant de réessayer.");
    } else {
      setMessage("Retrait confirmé pour la réservation " + row.code_paiement + ".");
      setCodeInput("");
      await load();
    }
    setBusyId(null);
  }

  return (
    <section className="carte mb-4 space-y-3">
      <style>{`@media print { body * { visibility: hidden !important; } #naxa-marketplace-receipt, #naxa-marketplace-receipt * { visibility: visible !important; } #naxa-marketplace-receipt { position: absolute; inset: 0 auto auto 0; width: 100%; background: white; color: black; padding: 16px; } }`}</style>
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-lg font-extrabold">Retrait Marketplace · règlement au comptoir</h2>
          <p className="text-sm text-slate-600">Scannez le QR code avec un lecteur compatible ou saisissez le code de paiement. NAXA relie la facture à la pharmacie ; le paiement est reçu et constaté par la pharmacie, jamais par NAXA.</p>
        </div>
        <button type="button" className="btn btn-clair" disabled={loading || !!busyId} onClick={() => void load()}>Actualiser</button>
      </div>
      {!sessionId && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 print:hidden">Ouvrez une session de caisse pour enregistrer un règlement ou confirmer un retrait.</p>}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] print:hidden">
        <label className="text-sm font-semibold">Code de paiement / contenu du QR code
          <input className="champ mt-1 w-full uppercase" value={codeInput} onChange={(event) => { setCodeInput(event.target.value); setError(""); setReceipt(null); }} placeholder="Ex. A1B2C3D4E5F6" autoCapitalize="characters" autoComplete="off" />
        </label>
        <div className="flex flex-wrap gap-2 self-end"><button type="button" className="btn btn-clair" disabled={loading || !!busyId} onClick={() => { setError(""); setCameraOpen((value) => !value); }}>{cameraOpen ? "Fermer le scanner" : "Scanner avec la caméra"}</button><button type="button" className="btn btn-clair" disabled={loading || !codeInput.trim()} onClick={() => void lookupTransaction()}>Retrouver la transaction</button></div>
      </div>
      {cameraOpen && <div className="rounded-xl border p-3 print:hidden"><video ref={videoRef} muted playsInline className="mx-auto max-h-72 w-full rounded-lg bg-black object-contain" /><p className="mt-2 text-xs text-slate-600">Placez le QR dans le cadre. La caméra sert uniquement à lire le code localement.</p></div>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 print:hidden">{message}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900 print:hidden">{error}</p>}
      {loading ? <p role="status" className="text-sm text-slate-600 print:hidden">Chargement des réservations…</p> : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-slate-600 print:hidden">Aucune réservation Marketplace en attente.</p>
      ) : (
        <ul className="space-y-3 print:hidden">
          {rows.map((row) => {
            const expired = new Date(row.expires_at).getTime() <= Date.now() && row.statut !== "payee";
            const isSelected = selected?.id === row.id;
            const assurance=assuranceByReservation[row.id]??null;
            const clientDue=assurance?Number(assurance.montant_client_fcfa):row.total;
            const assuranceReady=!assurance||(assurance.valide_client&&assurance.controle_documents_statut==="conforme"&&["accepte","clos"].includes(assurance.statut_dossier??""));
            const canPay = !row.credit_request_id && row.statut === "confirmee" && row.paiement_statut !== "effectue" && !expired && assuranceReady;
            const canCredit = Boolean(row.credit_request_id) && row.statut === "confirmee" && row.paiement_statut !== "effectue" && !expired;
            const paid = row.statut === "payee" && (row.paiement_statut === "effectue" || Boolean(row.credit_request_id));
            return (
              <li key={row.id} className={`rounded-xl border p-3 ${isSelected ? "border-emerald-600 ring-1 ring-emerald-600" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">Transaction {row.code_paiement}</p>
                    {row.credit_request_id && <p className="mt-1 inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-900">Crédit Marketplace approuvé · aucun paiement comptant</p>}
                    <p className="text-xs text-slate-500">Créée le {new Date(row.created_at).toLocaleString("fr-FR")} · expire le {new Date(row.expires_at).toLocaleString("fr-FR")}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold">{expired ? "Expirée" : row.credit_request_id && row.statut === "payee" ? "Crédit enregistré · retrait à confirmer" : statusLabel[row.statut] ?? row.statut}</span>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  {(row.reservation_items ?? []).map((item, index) => (
                    <p key={index}>{item.quantite} × {item.produits?.nom ?? "Produit"}{item.produits?.dosage ? " · " + item.produits.dosage : ""} — {fcfa(item.quantite * item.prix_unitaire)}</p>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-extrabold">{row.credit_request_id ? "Montant du crédit approuvé : " : "Total produits : "}{fcfa(row.total)}</p>
                    {assurance&&<div className="mt-1 text-xs text-slate-700"><p>Assureur · {assurance.assureur} : {fcfa(assurance.montant_assureur_fcfa)} (créance non encaissée)</p><p>Reste à payer client : <strong>{fcfa(clientDue)}</strong></p>{!assuranceReady&&<p className="mt-1 font-semibold text-amber-800">Paiement bloqué : accord client, contrôle documentaire conforme et confirmation de prise en charge requis.</p>}</div>}
                    <p className="text-xs text-slate-600">Canal enregistré : {row.paiement_mode ?? "à sélectionner au retrait"}</p>
                  </div>
                  {canCredit && isSelected && <button type="button" className="btn btn-vert" disabled={!sessionId || !!busyId || !normalizedCode} onClick={() => void validerRetraitCredit(row)}>{busyId === row.id ? "Enregistrement…" : "Valider le retrait à crédit"}</button>}
                  {paid && <button type="button" className="btn btn-vert" disabled={!!busyId || !sessionId} onClick={() => void confirmerRetrait(row)}>{busyId === row.id ? "Confirmation…" : "Confirmer la remise des produits"}</button>}
                </div>
                {canPay && isSelected && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-semibold">Canal déclaré par le client
                      <select className="champ mt-1 w-full" value={channel} onChange={(event) => setChannel(event.target.value)} disabled={!!busyId}>
                        {channels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-semibold">Montant réellement reçu (FCFA)
                      <input className="champ mt-1 w-full" type="number" min={clientDue} step="1" inputMode="numeric" value={received[row.id] ?? String(clientDue)} onChange={(event) => setReceived((current) => ({ ...current, [row.id]: event.target.value }))} disabled={!sessionId || !!busyId} />
                    </label>
                    <div className="rounded-xl bg-slate-50 p-3 text-sm sm:col-span-2">
                      <p>Montant du reçu : <strong>{fcfa(row.total)}</strong></p>
                      <p>Monnaie à rendre : <strong>{fcfa(channel === "especes" ? Math.max(Number(received[row.id] ?? row.total) - row.total, 0) : 0)}</strong></p>
                      <p className="mt-1 text-xs text-slate-600">Pour Mobile Money, carte ou autre canal, cochez uniquement après avoir vérifié que la pharmacie a réellement reçu le montant. Aucun appel d’API de paiement n’est effectué par NAXA.</p>
                    </div>
                    <button type="button" className="btn btn-vert sm:col-span-2" disabled={!sessionId || !!busyId || !normalizedCode} onClick={() => void encaisser(row)}>
                      {busyId === row.id ? "Enregistrement…" : "Confirmer le règlement reçu et préparer le reçu"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {receipt && (
        <section id="naxa-marketplace-receipt" className="rounded-xl border border-slate-300 bg-white p-5 text-slate-950">
          <TicketPharmacyLogo pharmacieId={pharmacieId} />
          <div className="text-center">
            <h2 className="text-xl font-extrabold">NAXA · Reçu de retrait Marketplace</h2>
            <p className="text-sm">Paiement reçu et confirmé par la pharmacie — NAXA ne collecte pas les fonds</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <p>Transaction : <strong>{receipt.transactionId}</strong></p>
            <p>Code paiement : <strong>{receipt.code}</strong></p>
            <p>Ticket caisse : <strong>{receipt.numero}</strong></p>
            <p>Date/heure : <strong>{receipt.date}</strong></p>
            <p>Canal : <strong>{receipt.canal}</strong></p>
            <p>Statut : <strong>PAYÉ</strong></p>
          </div>
          <div className="mt-4 border-t border-b py-3 text-sm">
            {receipt.items.map((item, index) => <p key={index}>{item.quantite} × {item.produits?.nom ?? "Produit"} {item.produits?.dosage ?? ""} — {fcfa(item.quantite * item.prix_unitaire)}</p>)}
          </div>
          <div className="mt-3 space-y-1 text-sm">
            <p>Total achat : <strong>{fcfa(receipt.total)}</strong></p>
            <p>Montant perçu : <strong>{fcfa(receipt.montantRecu)}</strong></p>
            <p>Monnaie à rendre : <strong>{fcfa(receipt.monnaie)}</strong></p>
          </div>
          <p className="mt-4 text-xs">Conservez ce reçu. La réservation et son historique sont mis à jour par NAXA après confirmation par la pharmacie.</p>
          <div className="mt-4 flex gap-2 print:hidden">
            <button type="button" className="btn btn-vert" onClick={() => void printAfterImagesLoaded(document.getElementById("naxa-marketplace-receipt") ?? document)}>Imprimer le reçu</button>
            <button type="button" className="btn btn-clair" onClick={() => setReceipt(null)}>Fermer</button>
          </div>
        </section>
      )}
    </section>
  );
}
