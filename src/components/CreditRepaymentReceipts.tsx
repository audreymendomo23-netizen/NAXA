"use client";

type Repayment={id:string;credit_id:string;pharmacie_id:string;montant:number;reference:string|null;motif:string|null;created_at:string};
export function CreditRepaymentReceipts({repayments,pharmacyNames,error}:{repayments:Repayment[];pharmacyNames:Record<string,string>;error:string|null}){
 return <section className="space-y-3 pt-2">
  <header><h2 className="text-xl font-black">Mes reçus de remboursement</h2><p className="mt-1 text-sm text-slate-600">Chaque reçu correspond à une opération de remboursement enregistrée dans le journal de crédit.</p></header>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">Les reçus de remboursement ne sont pas accessibles pour le moment.</p>}
  {!error&&!repayments.length&&<p className="rounded-xl border bg-white p-4 text-sm">Aucun remboursement enregistré.</p>}
  {repayments.map(r=><article key={r.id} className="credit-repayment-receipt space-y-3 rounded-2xl border-2 border-dashed border-[#0B3D26] bg-white p-4 text-[#0B3D26]">
   <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-widest">NAXA · Reçu de remboursement</p><h3 className="text-lg font-black">{Number(r.montant).toLocaleString("fr-FR")} FCFA reçus</h3><p className="text-sm">{pharmacyNames[r.pharmacie_id]??"Pharmacie"}</p></div><button type="button" className="rounded-xl border px-3 py-2 text-sm font-bold print:hidden" onClick={()=>window.print()}>Imprimer les reçus</button></div>
   <dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Référence du reçu</dt><dd className="break-all font-mono font-bold">{r.id}</dd></div><div><dt className="text-slate-500">Date</dt><dd className="font-semibold">{new Date(r.created_at).toLocaleString("fr-FR")}</dd></div><div><dt className="text-slate-500">Référence de paiement</dt><dd className="break-all">{r.reference||"Non fournie"}</dd></div><div><dt className="text-slate-500">Mode / motif</dt><dd>{r.motif||"Non précisé"}</dd></div><div><dt className="text-slate-500">Crédit concerné</dt><dd className="break-all font-mono">{r.credit_id}</dd></div></dl>
   <p className="border-t border-dashed pt-2 text-xs text-slate-500">Reçu fondé sur l’opération enregistrée. Conservez cette référence pour toute réclamation.</p>
  </article>)}
  <style jsx global>{`@media print { body * { visibility: hidden !important; } .credit-repayment-receipt, .credit-repayment-receipt * { visibility: visible !important; } .credit-repayment-receipt { position: relative; break-inside: avoid; margin-bottom: 12px; } }`}</style>
 </section>;
}
