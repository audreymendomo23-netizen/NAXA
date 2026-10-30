import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PERIODS = {
  quotidien: { days: 1, label: "Quotidien" },
  hebdomadaire: { days: 7, label: "Hebdomadaire" },
  mensuel: { days: 30, label: "Mensuel" },
  trimestriel: { days: 90, label: "Trimestriel" },
  semestriel: { days: 180, label: "Semestriel" },
  annuel: { days: 365, label: "Annuel" },
} as const;

type Period = keyof typeof PERIODS;
type ReportRow = { indicateur: string; valeur: string | number };

function csvEscape(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[=+@-]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function toPdf(report: {
  periode_label: string; jours: number; du: string; au: string; genere_le: string;
  indicateurs: ReportRow[]; analyse_ia: { status: string; texte: string };
  comparaison: { disponible: boolean; motif: string }; note_periode?: string | null; serie: unknown[];
}) {
  const W=595,H=842,M=42,CW=W-2*M;
  const clean=(v:unknown)=>String(v??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7E]/g," ").replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
  const wrap=(v:unknown,max=86)=>{const out:string[]=[];let line="";for(const word of String(v??"").split(/\s+/)){const next=line?line+" "+word:word;if(next.length>max&&line){out.push(line);line=word;}else line=next;}if(line)out.push(line);return out.length?out:[""];};
  const pages:string[][]=[];let cmds:string[]=[];let y=0;
  const add=(s:string)=>cmds.push(s);
  const rect=(x:number,t:number,w:number,h:number,fill:string,stroke?:string)=>{if(fill)add(fill+" rg");if(stroke)add(stroke+" RG 0.7 w");add(x+" "+(H-t-h)+" "+w+" "+h+" re "+(fill&&stroke?"B":fill?"f":"S"));};
  const rule=(x1:number,t1:number,x2:number,t2:number,color="0.86 0.89 0.93")=>add(color+" RG 0.7 w "+x1+" "+(H-t1)+" m "+x2+" "+(H-t2)+" l S");
  const txt=(v:unknown,x:number,t:number,size=9,bold=false,color="0.16 0.20 0.26")=>add(color+" rg BT /"+(bold?"F2":"F1")+" "+size+" Tf 1 0 0 1 "+x+" "+(H-t-size)+" Tm ("+clean(v)+") Tj ET");
  const para=(v:unknown,x:number,t:number,max=86,size=8,lead=12)=>{const ls=wrap(v,max);ls.forEach((s,i)=>txt(s,x,t+i*lead,size));return t+ls.length*lead;};
  const footer=()=>{rule(M,808,W-M,808);txt("Document interne NAXA · "+report.genere_le.slice(0,16).replace("T"," "),M,817,7,false,"0.45 0.49 0.55");txt("Page "+(pages.length+1),W-M-42,817,7,true,"0.45 0.49 0.55");};
  const newPage=()=>{if(cmds.length){pages.push(cmds);cmds=[];}rect(0,0,W,9,"0.02 0.28 0.73");txt("NAXA  /  INTELLIGENCE OPERATIONNELLE",M,22,8,true,"0.02 0.28 0.73");rule(M,42,W-M,42);y=55;};
  const ensure=(h:number)=>{if(y+h>790){footer();newPage();}};
  const section=(s:string)=>{ensure(32);y+=7;txt(s.toUpperCase(),M,y,9,true,"0.02 0.28 0.73");y+=16;rule(M,y,W-M,y,"0.78 0.83 0.90");y+=9;};
  const num=report.indicateurs.filter(r=>typeof r.valeur==="number"&&Number.isFinite(r.valeur)).slice(0,6);
  const groups=new Map<string,ReportRow[]>();
  const classify=(s:string)=>{const v=s.toLowerCase();if(/stock|produit|lot|inventaire|reference|rupture|reservation/.test(v))return "Stock & approvisionnement";if(/chiffre|vente|depense|tresorerie|paiement|assurance|compta|panier|montant/.test(v))return "Finance & ventes";if(/consultation|prescription|preparation|audit|fiche|recherche|conversion|retrait|operation|annulation/.test(v))return "Activite metier";if(/pharmacie|alerte|perimetre/.test(v))return "Reseau & perimetre";return "Pilotage & performance";};
  report.indicateurs.forEach(r=>{const k=classify(r.indicateur);groups.set(k,[...(groups.get(k)||[]),r]);});
  newPage();
  txt("RAPPORT BI",M,62,22,true,"0.08 0.13 0.22");txt("Synthese de pilotage",M,90,11,false,"0.38 0.43 0.50");
  txt(report.periode_label+" · "+report.jours+" jour(s) glissant(s)",M,116,9,true);txt("Du "+report.du+" au "+report.au,M,132,9);txt("Genere le "+report.genere_le.slice(0,16).replace("T"," "),M,147,8,false,"0.42 0.46 0.52");
  rect(M,170,CW,53,"0.94 0.96 0.99");txt("PERIMETRE AUTORISE",M+12,180,7,true,"0.38 0.43 0.50");para(report.indicateurs[0]?.valeur??"Utilisateur habilite",M+12,194,90,9,12);
  y=240;section("Indicateurs cles");
  const gap=9,cw=(CW-gap*2)/3,ch=67;
  if(!num.length){y=para("Aucun indicateur numerique exploitable pour les cartes de synthese.",M,y)+8;}
  num.forEach((r,i)=>{const x=M+(i%3)*(cw+gap),t=y+Math.floor(i/3)*(ch+8);rect(x,t,cw,ch,"0.97 0.98 1.00","0.86 0.89 0.93");para(r.indicateur,x+9,t+8,28,7,9);txt(Number(r.valeur).toLocaleString("fr-FR"),x+9,t+34,15,true,"0.02 0.28 0.73");});
  y+=Math.ceil(num.length/3)*(ch+8)+7;
  if(report.note_periode){ensure(52);rect(M,y,CW,43,"1.00 0.97 0.90","0.94 0.82 0.55");para(report.note_periode,M+10,y+9,94,8,11);y+=53;}
  const series=report.serie.map((p:any)=>({label:String(p?.date??p?.label??p?.periode??p?.x??""),value:Number(p?.valeur??p?.value??p?.total??p?.y)})).filter(p=>p.label&&Number.isFinite(p.value));
  if(series.length>=2){ensure(130);section("Evolution temporelle");const x=M+18,t=y+5,w=CW-36,h=70;rule(x,t+h,x+w,t+h,"0.55 0.60 0.67");const min=Math.min(...series.map(p=>p.value)),max=Math.max(...series.map(p=>p.value)),span=max-min||1;const pts=series.map((p,i)=>({x:x+i/(series.length-1)*w,y:t+h-(p.value-min)/span*(h-8)}));for(let i=0;i<pts.length-1;i++)rule(pts[i].x,pts[i].y,pts[i+1].x,pts[i+1].y,"0.02 0.38 0.82");pts.forEach(p=>rect(p.x-2,p.y-2,4,4,"0.02 0.38 0.82"));txt(series[0].label,x,t+h+7,7);txt(series[series.length-1].label,x+w-55,t+h+7,7);y=t+h+24;}
  footer();newPage();txt("DETAIL DES INDICATEURS",M,62,17,true,"0.08 0.13 0.22");y=94;
  for(const group of ["Finance & ventes","Activite metier","Stock & approvisionnement","Pilotage & performance","Reseau & perimetre"]){const items=groups.get(group);if(!items?.length)continue;section(group);for(const r of items){const ls=wrap(r.indicateur,62);ensure(Math.max(24,ls.length*11+8));ls.forEach((s,i)=>txt(s,M+2,y+i*11,8));txt(typeof r.valeur==="number"?r.valeur.toLocaleString("fr-FR"):r.valeur,W-M-145,y,8,true);y+=Math.max(21,ls.length*11+5);rule(M,y-3,W-M,y-3,"0.91 0.93 0.95");}y+=4;}
  section("Analyse J'IA");y=para("Statut : "+report.analyse_ia.status,M,y,90,8,11)+5;
  for(const s of wrap(report.analyse_ia.texte,92)){ensure(14);txt(s,M,y,8);y+=12;}
  section("Comparaison & limites");y=para(report.comparaison.disponible?"Comparaison disponible.":report.comparaison.motif,M,y,92,8,11)+8;ensure(30);para("Les indicateurs refletent les donnees accessibles au poste connecte. Les hypotheses de l'analyse IA ne constituent pas des causalites prouvees.",M,y,92,7,10);
  footer();pages.push(cmds);
  const objects:string[]=[];const pageIds:number[]=[];objects[0]="<< /Type /Catalog /Pages 2 0 R >>";objects[1]="";objects[2]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";objects[3]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  pages.forEach((list,i)=>{const pid=5+i*2,sid=pid+1;pageIds.push(pid);const stream=list.join("\n");objects[pid-1]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+W+" "+H+"] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents "+sid+" 0 R >>";objects[sid-1]="<< /Length "+Buffer.byteLength(stream,"ascii")+" >>\nstream\n"+stream+"\nendstream";});
  objects[1]="<< /Type /Pages /Kids ["+pageIds.map(id=>id+" 0 R").join(" ")+"] /Count "+pageIds.length+" >>";
  let output="%PDF-1.4\n";const offsets=[0];objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(output,"ascii"));output+=(i+1)+" 0 obj\n"+obj+"\nendobj\n";});const xref=Buffer.byteLength(output,"ascii");output+="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";offsets.slice(1).forEach(n=>output+=String(n).padStart(10,"0")+" 00000 n \n");output+="trailer\n<< /Size "+(objects.length+1)+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF";return Buffer.from(output,"ascii");
}

async function explainWithAi(metrics: Record<string, unknown>, role: string, period: string) {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) return { status: "indisponible", texte: "Analyse IA non configurée. Les indicateurs chiffrés restent disponibles." };
  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_GATEWAY_MODEL || "openai/gpt-4.1-mini",
        temperature: 0.1,
        messages: [
          { role: "system", content: "Tu es l'analyste BI de NAXA. Analyse uniquement les chiffres fournis. Ne fabrique aucun historique, aucune comparaison ni causalité. Distingue faits, signaux et hypothèses. Si les données ne permettent pas d'expliquer une variation, dis-le. Réponds en français, en 5 points maximum." },
          { role: "user", content: JSON.stringify({ role, period, metrics, comparison: "Aucune comparaison N-1 n'est fournie par le moteur actuel. Ne pas en inventer." }) },
        ],
      }),
      cache: "no-store",
    });
    if (!response.ok) return { status: "erreur", texte: "Analyse IA temporairement indisponible. Les indicateurs chiffrés restent disponibles." };
    const payload = await response.json();
    const texte = payload.choices?.[0]?.message?.content;
    return typeof texte === "string" && texte.trim()
      ? { status: "disponible", texte: texte.trim().slice(0, 7000) }
      : { status: "erreur", texte: "L'analyse IA n'a pas renvoyé de contenu exploitable." };
  } catch {
    return { status: "erreur", texte: "Analyse IA temporairement indisponible. Les indicateurs chiffrés restent disponibles." };
  }
}

async function fetchAllRows<T>(buildQuery: (from: number, to: number) => any): Promise<{ data: T[]; error: any }> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) return { data: [], error };
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}

function rowsFromStats(stats: Record<string, any>): ReportRow[] {
  const rows: ReportRow[] = [];
  const add = (label: string, value: unknown) => {
    if (typeof value === "number" || typeof value === "string") rows.push({ indicateur: label, valeur: value });
  };
  add("Périmètre", stats.role === "admin" ? "Réseau NAXA" : stats.role === "promoteur" ? "Réseau Promoteur autorisé" : stats.role === "caisse" ? "Activité de caisse personnelle" : stats.role === "pharmacien" ? "Activité du poste Pharmacien · pharmacie rattachée" : stats.role === "comptable" ? "Comptabilité · pharmacie autorisée" : stats.role === "gestionnaire_stock" ? "Stock · pharmacies affectées" : "Pharmacie autorisée");
  add("Pharmacies du périmètre", stats.pharmacies?.total);
  add("Pharmacies actives", stats.pharmacies?.actives);
  add("Pharmacies inactives", stats.pharmacies?.inactives);
  add("Recherches", stats.recherches?.total);
  add("Recherches sans résultat", stats.recherches?.sans_resultat);
  add("Fiches consultées", stats.entonnoir?.fiches_vues);
  add("Ajouts au panier", stats.entonnoir?.paniers);
  add("Réservations", stats.entonnoir?.reservations);
  add("Ventes", stats.entonnoir?.ventes);
  add("Chiffre d'affaires (FCFA)", stats.ca);
  add("Produits disponibles", stats.stock?.produits_en_stock);
  add("Ruptures de stock", stats.stock?.ruptures);
  add("Alertes non lues", stats.alertes);
  add("Taux de conversion vente (%)", stats.performance?.taux_conversion_vente);
  add("Taux de retrait (%)", stats.performance?.taux_retrait);
  add("Panier moyen (FCFA)", stats.performance?.panier_moyen);
  add("Âge moyen du stock (heures)", stats.performance?.stock_age_heures);
  add("Opérations réservation", stats.evenements_reservation);
  add("Paiements traités", stats.paiements);
  add("Retraits traités", stats.retraits);
  add("Annulations", stats.annulations);
  add("Consultations pharmaceutiques", stats.consultations);
  add("Prescriptions", stats.prescriptions);
  add("Prescriptions en attente", stats.prescriptions_en_attente);
  add("Préparations", stats.preparations);
  add("Événements d'audit Pharmacien", stats.evenements_audit);
  add("Ventes payées", stats.ventes_payees);
  add("Chiffre d'affaires comptable (FCFA)", stats.chiffre_affaires);
  add("Dépenses enregistrées", stats.depenses);
  add("Montant des dépenses (FCFA)", stats.montant_depenses);
  add("Mouvements de trésorerie", stats.mouvements_tresorerie);
  add("Montant brut de trésorerie (FCFA)", stats.montant_tresorerie_brut);
  add("Dossiers assurance", stats.dossiers_assurance);
  add("Contrôles comptables à traiter", stats.controles_a_traiter);
  add("Pharmacies affectées", stats.pharmacies);
  add("Références en stock (état actuel)", stats.references_stock);
  add("Stocks bas (état actuel, ≤ 5)", stats.stocks_bas);
  add("Lots à contrôler (état actuel)", stats.lots_a_controler);
  add("Réservations en attente (état actuel)", stats.reservations_a_traiter);
  add("Inventaires ouverts (état actuel)", stats.inventaires_ouverts);
  return rows;
}

export async function GET() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  const { data: profile } = await sb.from("profiles").select("role,fonction_interne,pharmacie_id,actif").eq("id", auth.user.id).single();
  if (!profile?.actif || !["admin", "promoteur", "pharmacie", "caisse"].includes(profile.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (profile.role === "pharmacie" && profile.fonction_interne !== "responsable") {
    return NextResponse.json({ error: "Historique réservé au Responsable habilité." }, { status: 403 });
  }
  if (profile.role === "promoteur") return NextResponse.json({ rapports: [] });
  let query = sb.from("rapports")
    .select("id,portee,pharmacie_id,periode,du,au,texte,contenu,created_at,pharmacies(nom)")
    .order("created_at", { ascending: false }).limit(30);
  if (profile.role === "admin") query = query.eq("portee", "admin");
  else if (profile.pharmacie_id) query = query.eq("pharmacie_id", profile.pharmacie_id);
  else return NextResponse.json({ rapports: [] });
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Historique des rapports indisponible." }, { status: 500 });
  return NextResponse.json({ rapports: (data ?? []).map((r: any) => ({ ...r, pharmacie_nom: r.pharmacies?.nom ?? null })) });
}

export async function POST(request: Request) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("role,fonction_interne,pharmacie_id,actif").eq("id", auth.user.id).single();
  if (profileError || !profile?.actif) return NextResponse.json({ error: "Compte inactif ou profil indisponible." }, { status: 403 });

  let body: { periode?: Period; format?: "json" | "csv" | "pdf" };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 }); }
  const periode = body.periode || "hebdomadaire";
  const config = PERIODS[periode];
  if (!config) return NextResponse.json({ error: "Période non prise en charge." }, { status: 400 });

  let stats: Record<string, any>;
  const fonction = String(profile.fonction_interne ?? "").toLowerCase();

  if (fonction === "pharmacien") {
    if (!profile.pharmacie_id) return NextResponse.json({ error: "Pharmacie de rattachement introuvable." }, { status: 403 });
    const { data: pharmacy, error: pharmacyError } = await sb.from("pharmacies").select("id,actif").eq("id", profile.pharmacie_id).maybeSingle();
    if (pharmacyError || !pharmacy?.actif) return NextResponse.json({ error: "Pharmacie inactive ou indisponible." }, { status: 403 });
    const since = new Date(Date.now() - config.days * 86400000).toISOString();
    const [consultations, prescriptions, pendingPrescriptions, preparations, audit] = await Promise.all([
      sb.from("consultations_pharmaceutiques").select("id", { count: "exact", head: true }).eq("pharmacie_id", profile.pharmacie_id).gte("created_at", since),
      sb.from("prescriptions").select("id", { count: "exact", head: true }).eq("pharmacie_id", profile.pharmacie_id).gte("created_at", since),
      sb.from("prescriptions").select("id", { count: "exact", head: true }).eq("pharmacie_id", profile.pharmacie_id).gte("created_at", since).eq("statut", "en_attente"),
      sb.from("prescription_preparations").select("prescription_id", { count: "exact", head: true }).eq("pharmacie_id", profile.pharmacie_id).gte("updated_at", since),
      sb.from("pharmacien_audit_events").select("id", { count: "exact", head: true }).eq("pharmacie_id", profile.pharmacie_id).gte("occurred_at", since),
    ]);
    if ([consultations.error, prescriptions.error, pendingPrescriptions.error, preparations.error, audit.error].some(Boolean)) return NextResponse.json({ error: "Une source du rapport Pharmacien est indisponible. Aucun rapport partiel n'est présenté comme complet." }, { status: 503 });
    stats = { role: "pharmacien", consultations: consultations.count ?? 0, prescriptions: prescriptions.count ?? 0, prescriptions_en_attente: pendingPrescriptions.count ?? 0, preparations: preparations.count ?? 0, evenements_audit: audit.count ?? 0 };
  } else if (fonction === "comptable") {
    if (!profile.pharmacie_id) return NextResponse.json({ error: "Pharmacie de rattachement introuvable." }, { status: 403 });
    const { data: allowed, error: permissionError } = await sb.rpc("naxa_can", { p_privilege: "MANAGE_ACCOUNTING", p_pharmacie: profile.pharmacie_id, p_target: null });
    if (permissionError || allowed !== true) return NextResponse.json({ error: "Privilège comptable requis." }, { status: 403 });
    const since = new Date(Date.now() - config.days * 86400000).toISOString();
    const [sales, expenses, cash, claims, controls] = await Promise.all([
      fetchAllRows<{ id: string; total_net: number | string | null; statut: string }>((from, to) => sb.from("ventes").select("id,total_net,statut").eq("pharmacie_id", profile.pharmacie_id).gte("created_at", since).order("id").range(from, to)),
      fetchAllRows<{ id: string; montant: number | string | null; statut: string }>((from, to) => sb.from("depenses").select("id,montant,statut").eq("pharmacie_id", profile.pharmacie_id).gte("date_depense", since.slice(0,10)).order("id").range(from, to)),
      fetchAllRows<{ id: string; montant: number | string | null; nature: string }>((from, to) => sb.from("tresorerie_mouvements").select("id,montant,nature").eq("pharmacie_id", profile.pharmacie_id).gte("date_operation", since).order("id").range(from, to)),
      fetchAllRows<{ id: string; statut: string; montant_prise_en_charge: number | string | null }>((from, to) => sb.from("dossiers_assurance").select("id,statut,montant_prise_en_charge").eq("pharmacie_id", profile.pharmacie_id).gte("created_at", since).order("id").range(from, to)),
      fetchAllRows<{ id: string; statut: string }>((from, to) => sb.from("compta_controles_cloture").select("id,statut").eq("pharmacie_id", profile.pharmacie_id).order("id").range(from, to)),
    ]);
    if ([sales.error, expenses.error, cash.error, claims.error, controls.error].some(Boolean)) return NextResponse.json({ error: "Une source comptable est indisponible. Aucun rapport partiel n'est présenté comme complet." }, { status: 503 });
    const paid = sales.data.filter(x => x.statut === "payee");
    const total = (items: any[], key: string) => items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0);
    stats = { role: "comptable", ventes_payees: paid.length, chiffre_affaires: total(paid, "total_net"), depenses: expenses.data.length, montant_depenses: total(expenses.data, "montant"), mouvements_tresorerie: cash.data.length, montant_tresorerie_brut: total(cash.data, "montant"), dossiers_assurance: claims.data.length, controles_a_traiter: controls.data.filter(x => x.statut === "a_controler").length };
  } else if (["gestionnaire_stock", "magasinier"].includes(fonction)) {
    const [{ data: assignments, error: assignmentError }, { data: myPharmacies, error: pharmaciesError }] = await Promise.all([
      sb.from("naxa_professional_assignments").select("pharmacie_id,commence_at,expire_at").eq("profile_id", auth.user.id).eq("statut", "active").in("fonction", ["gestionnaire_stock", "magasinier"]),
      sb.rpc("my_pharmacies"),
    ]);
    if (assignmentError || pharmaciesError) return NextResponse.json({ error: "Le périmètre des pharmacies affectées est indisponible." }, { status: 503 });
    const nowMs = Date.now();
    const activeAssignments = (assignments ?? []).filter(x => new Date(x.commence_at).getTime() <= nowMs && new Date(x.expire_at).getTime() > nowMs).map(x => x.pharmacie_id);
    const ids = [...new Set([...(Array.isArray(myPharmacies) ? myPharmacies.filter((id): id is string => typeof id === "string") : []), ...activeAssignments])];
    if (!ids.length) return NextResponse.json({ error: "Aucune affectation de stock active." }, { status: 403 });
    const cutoff = new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10);
    const [stocks, low, lots, reservations, inventories] = await Promise.all([
      sb.from("stocks").select("produit_id", { count: "exact", head: true }).in("pharmacie_id", ids),
      sb.from("stocks").select("produit_id", { count: "exact", head: true }).in("pharmacie_id", ids).lte("quantite", 5),
      sb.from("stocks_lots").select("id", { count: "exact", head: true }).in("pharmacie_id", ids).or("date_peremption.is.null,date_peremption.lte." + cutoff + ",bloque.eq.true"),
      sb.from("reservations").select("id", { count: "exact", head: true }).in("pharmacie_id", ids).eq("mode", "reservation").in("statut", ["en_attente", "confirmee"]),
      sb.from("inventaires").select("id", { count: "exact", head: true }).in("pharmacie_id", ids).in("statut", ["brouillon", "en_cours"]),
    ]);
    if ([stocks.error, low.error, lots.error, reservations.error, inventories.error].some(Boolean)) return NextResponse.json({ error: "Une source de stock est indisponible. Aucun rapport partiel n'est présenté comme complet." }, { status: 503 });
    stats = { role: "gestionnaire_stock", pharmacies: ids.length, references_stock: stocks.count ?? 0, stocks_bas: low.count ?? 0, lots_a_controler: lots.count ?? 0, reservations_a_traiter: reservations.count ?? 0, inventaires_ouverts: inventories.count ?? 0 };
  } else if (profile.role === "caisse") {
    const { data, error } = await sb.rpc("stats_caisse_scope", { p_jours: config.days });
    if (error) return NextResponse.json({ error: "Les statistiques de caisse ne sont pas accessibles pour ce poste." }, { status: 403 });
    stats = (Array.isArray(data) ? data[0] : data) as Record<string, any>;
  } else {
    if (profile.role === "pharmacie" && profile.fonction_interne !== "responsable") {
      return NextResponse.json({ error: "Le rapport est réservé au Responsable de pharmacie habilité." }, { status: 403 });
    }
    if (!["admin", "promoteur", "pharmacie"].includes(profile.role)) return NextResponse.json({ error: "Poste non habilité aux rapports." }, { status: 403 });
    const { data, error } = await sb.rpc("stats_pilotage_scope", { p_jours: config.days });
    if (error) return NextResponse.json({ error: "Le pilotage de ce poste n'est pas autorisé ou ses données sont indisponibles." }, { status: 403 });
    stats = (Array.isArray(data) ? data[0] : data) as Record<string, any>;
  }
  if (!stats || typeof stats !== "object") return NextResponse.json({ error: "Le moteur BI n'a pas renvoyé de données exploitables." }, { status: 502 });

  const now = new Date();
  const start = new Date(now.getTime() - config.days * 86400000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = now.toISOString().slice(0, 10);
  const rows = rowsFromStats(stats);
  const ai = await explainWithAi(stats, profile.role, config.label);
  const report = {
    titre: "Rapport BI NAXA",
    role: profile.role,
    periode,
    periode_label: config.label,
    jours: config.days,
    du: startDate,
    au: endDate,
    genere_le: now.toISOString(),
    comparaison: { disponible: false, motif: "Le moteur de statistiques actuel ne prend pas encore de date de début/fin arbitraire. Aucune comparaison artificielle n'est affichée." },
    note_periode: stats.role === "gestionnaire_stock" ? "Les indicateurs Stock présentés sont des états courants à la date de génération. La période sélectionnée ne les transforme pas en mouvements historiques." : null,
    indicateurs: rows,
    serie: Array.isArray(stats.serie) ? stats.serie : [],
    analyse_ia: ai,
    donnees: stats,
  };

  if (body.format === "csv") {
    const csvRows = [...(report.note_periode ? [{ indicateur: "Périmètre temporel", valeur: report.note_periode }] : []), ...rows, { indicateur: "Statut analyse IA", valeur: ai.status }, { indicateur: "Analyse IA", valeur: ai.texte }];
    const csv = ["indicateur,valeur", ...csvRows.map((row) => [csvEscape(row.indicateur), csvEscape(row.valeur)].join(","))].join("\r\n");
    return new Response("\ufeff" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="naxa-rapport-${periode}-${endDate}.csv"`, "Cache-Control": "no-store" } });
  }
  if (body.format === "pdf") {
    const lines = [
      "NAXA - RAPPORT BI",
      `Periode : ${config.label} (${config.days} jours)`,
      `Du ${startDate} au ${endDate} | Genere le ${now.toISOString()}`,
      `Perimetre : ${String(rows[0]?.valeur ?? "Autorise")}`,
      "",
      ...(report.note_periode ? [report.note_periode, ""] : []),
      "INDICATEURS",
      ...rows.map((row) => `${row.indicateur} : ${row.valeur}`),
      "",
      "ANALYSE IA",
      `Statut : ${ai.status}`,
      ...ai.texte.split("\n"),
      "",
      "COMPARAISON",
      report.comparaison.motif,
      "",
      "NOTE : les hypotheses de l'IA ne constituent pas des causalites prouvees.",
    ];
    const pdf = toPdf(report);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="naxa-rapport-${periode}-${endDate}.pdf"`, "Cache-Control": "no-store" } });
  }
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
