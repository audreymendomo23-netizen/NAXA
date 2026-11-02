import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

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

const ADMIN_ACCOUNT_METRICS_LABELS: Record<string, string> = {
  clients_avec_reservation: "Clients avec réservation",
  reservations: "Réservations",
  ventes_marketplace: "Ventes Marketplace",
  ca_marketplace_fcfa: "CA Marketplace (FCFA)",
  ventes_pos_payees: "Ventes POS payées",
  ca_pos_fcfa: "CA POS (FCFA)",
  references_stock: "Références en stock",
  stocks_bas: "Stocks bas (≤ 5)",
  ruptures_stock: "Ruptures de stock",
  lots_a_controler: "Lots à contrôler",
  inventaires_ouverts: "Inventaires ouverts",
  consultations_pharmaceutiques: "Consultations pharmaceutiques",
  prescriptions: "Prescriptions",
  preparations_prescriptions: "Préparations de prescriptions",
  evenements_audit_pharmacien: "Événements d'audit Pharmacien",
  caisses_actives: "Caisses actives",
  sessions_caisse: "Sessions de caisse",
  ecarts_caisse_a_verifier: "Écarts de caisse à vérifier",
  depenses: "Dépenses enregistrées",
  montant_depenses_fcfa: "Montant des dépenses (FCFA)",
  mouvements_tresorerie: "Mouvements de trésorerie",
  montant_tresorerie_brut_fcfa: "Trésorerie brute (FCFA)",
  dossiers_assurance: "Dossiers assurance",
  montant_prise_en_charge_fcfa: "Prise en charge assurance (FCFA)",
  services_pharmacien_pointes: "Services Pharmacien pointés",
  services_stock_pointes: "Services Stock pointés",
  affectations_professionnelles_actives: "Affectations professionnelles actives",
  controles_comptables_a_traiter: "Contrôles comptables à traiter",
  evenements_comptables_a_traiter: "Événements comptables à traiter",
  periodes_comptables_ouvertes: "Périodes comptables ouvertes",
  ecritures_comptables: "Écritures comptables",
};


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
  const payload = {
    model: "",
    temperature: 0.1,
    messages: [
      { role: "system", content: "Tu es l'analyste BI de NAXA. Analyse uniquement les chiffres fournis. Ne fabrique aucun historique, aucune comparaison ni causalité. Distingue faits, signaux et hypothèses. Si les données ne permettent pas d'expliquer une variation, dis-le. Réponds en français, en 5 points maximum." },
      { role: "user", content: JSON.stringify({ role, period, metrics, comparison: "Aucune comparaison N-1 n'est fournie." }) },
    ],
  };
  const providers = [
    process.env.GROQ_API_KEY
      ? { name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", key: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile" }
      : null,
    process.env.AI_GATEWAY_API_KEY
      ? { name: "Vercel AI Gateway", url: "https://ai-gateway.vercel.sh/v1/chat/completions", key: process.env.AI_GATEWAY_API_KEY, model: process.env.AI_GATEWAY_MODEL || "openai/gpt-4.1-mini" }
      : null,
  ].filter((provider): provider is { name: string; url: string; key: string; model: string } => Boolean(provider));

  if (!providers.length) {
    return { status: "indisponible", texte: "Analyse IA non configurée. Les indicateurs chiffrés restent disponibles." };
  }

  for (const provider of providers) {
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, model: provider.model }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) continue;
      const json = await response.json();
      const texte = json?.choices?.[0]?.message?.content;
      if (typeof texte === "string" && texte.trim()) {
        return { status: "disponible", texte: texte.trim() };
      }
    } catch {
      // Le fournisseur suivant est essayé sans interrompre le rapport chiffré.
    }
  }

  return { status: "erreur", texte: "Analyse IA temporairement indisponible chez les fournisseurs configurés. Les indicateurs chiffrés restent disponibles." };
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
  add("Affectations accordées / reçues sur la période", stats.affectations_periode);
  add("Affectations actives à la génération", stats.affectations_actives_a_generation);
  add("Fonctions couvertes par affectation", stats.fonctions_affectees);
  add("Membres concernés par affectation (Promoteur)", stats.staff_concernes_par_affectation);
  add("Pharmacies concernées par affectation (Promoteur)", stats.pharmacies_concernees_par_affectation);
  if (stats.affectations_par_fonction && typeof stats.affectations_par_fonction === "object") {
    Object.entries(stats.affectations_par_fonction).forEach(([fonction, count]) => add("Affectations · " + fonction, count));
  }
  add("Services pointés sur la période", stats.services_pointes);
  add("Services clôturés", stats.services_clotures);
  add("Services encore ouverts à la génération", stats.services_ouverts);
  add("Durée cumulée des services (heures)", stats.duree_services_heures);
  if (Array.isArray(stats.details_affectations)) stats.details_affectations.forEach((assignment: any) => {
    const identity = assignment.personnel + " · " + assignment.pharmacie + " · " + assignment.fonction;
    add("Affectation " + identity + " · début", assignment.debut);
    add("Affectation " + identity + " · fin prévue", assignment.fin_prevue);
    add("Affectation " + identity + " · statut", assignment.statut);
    add("Affectation " + identity + " · accordée le", assignment.accordee_le);
    if (assignment.revoquee_le) add("Affectation " + identity + " · révoquée le", assignment.revoquee_le);
  });
  if (Array.isArray(stats.details_services)) stats.details_services.forEach((session: any) => {
    const who = session.personnel ? " · " + session.personnel : "";
    add("Service " + session.poste + who + " · début", session.debut);
    add("Service " + session.poste + who + " · fin", session.fin ?? "En cours à la génération");
    add("Service " + session.poste + who + " · durée (heures)", session.duree_heures);
  });

  if (Array.isArray(stats.comptes_globaux)) {
    for (const group of stats.comptes_globaux) {
      add(
        `Comptes globaux · ${group.role} · ${group.fonction_interne} · ${group.actif ? "actifs" : "inactifs"}`,
        group.total
      );
    }
  }

  if (stats.totaux && typeof stats.totaux === "object") {
    add("Clients actifs", stats.totaux.clients_actifs);
    add("Clients total", stats.totaux.clients_total);
    add("Promoteurs actifs", stats.totaux.promoteurs_actifs);
    add("Promoteurs total", stats.totaux.promoteurs_total);
    add("Comptes professionnels", stats.totaux.comptes_professionnels);
    add("Pharmacies du réseau (hors démo)", stats.totaux.pharmacies_total);
    add("Pharmacies actives (hors démo)", stats.totaux.pharmacies_actives);
    for (const [key, label] of Object.entries(ADMIN_ACCOUNT_METRICS_LABELS)) {
      const value = stats.totaux[key];
      add(label + " · Total réseau", value === null || value === undefined ? "Indisponible" : value);
    }
  }

  const addAccountDetails = (prefix: string, entity: Record<string, any>) => {
    const name = String(entity.nom ?? "Périmètre");
    if (typeof entity.pharmacies_total === "number") add(`${prefix} · ${name} · Pharmacies rattachées`, entity.pharmacies_total);
    if (Array.isArray(entity.comptes)) {
      for (const group of entity.comptes) {
        add(
          `${prefix} · ${name} · Compte ${group.role} · ${group.fonction_interne} · ${group.actif ? "actif" : "inactif"}`,
          group.total
        );
      }
    }
    if (entity.indicateurs && typeof entity.indicateurs === "object") {
      for (const [key, label] of Object.entries(ADMIN_ACCOUNT_METRICS_LABELS)) {
        const value = entity.indicateurs[key];
        add(`${prefix} · ${name} · ${label}`, value === null || value === undefined ? "Indisponible" : value);
      }
    }
  };

  if (Array.isArray(stats.par_pharmacie)) {
    for (const pharmacy of stats.par_pharmacie) addAccountDetails("Détail pharmacie", pharmacy);
  }
  if (Array.isArray(stats.par_promoteur)) {
    for (const promoter of stats.par_promoteur) addAccountDetails("Détail Promoteur", promoter);
  }

  return rows;
}

/**
 * Frontière de confidentialité IA : ne transmettre que des métriques
 * numériques agrégées. Les libellés détaillés (personnes, affectations,
 * sessions, horodatages) restent hors du prompt.
 */
function buildAiMetrics(stats: Record<string, any>, rows: ReportRow[]) {
  const indicateurs: Record<string, number> = {};
  for (const row of rows) {
    if (
      typeof row.valeur === "number" &&
      Number.isFinite(row.valeur) &&
      !row.indicateur.startsWith("Affectation ") &&
      !row.indicateur.startsWith("Service ") &&
      !row.indicateur.startsWith("Détail ")
    ) {
      indicateurs[row.indicateur] = row.valeur;
    }
  }

  const serie = Array.isArray(stats.serie)
    ? stats.serie.map((point: Record<string, unknown>) => ({
        jour: String(point.jour ?? point.date ?? point.label ?? ""),
        recherches: Number(point.recherches ?? 0),
        reservations: Number(point.reservations ?? 0),
        ventes: Number(point.ventes ?? 0),
      })).filter((point: { jour: string; recherches: number; reservations: number; ventes: number }) =>
        point.jour &&
        Number.isFinite(point.recherches) &&
        Number.isFinite(point.reservations) &&
        Number.isFinite(point.ventes)
      )
    : [];

  return { indicateurs, serie };
}

export async function GET() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  const { data: profile } = await sb.from("profiles").select("role,fonction_interne,pharmacie_id,actif").eq("id", auth.user.id).single();
  const isComptable = profile?.fonction_interne === "comptable";
  if (!profile?.actif || !(["admin", "promoteur", "pharmacie", "caisse"].includes(profile.role) || isComptable)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (profile.role === "pharmacie" && profile.fonction_interne !== "responsable" && !isComptable) {
    return NextResponse.json({ error: "Historique réservé au Responsable ou Comptable habilité." }, { status: 403 });
  }
  if (isComptable) {
    if (!profile.pharmacie_id) return NextResponse.json({ error: "Pharmacie de rattachement introuvable." }, { status: 403 });
    const { data: allowed, error: permissionError } = await sb.rpc("compta_scope_autorise", { p_pharmacie: profile.pharmacie_id });
    if (permissionError || allowed !== true) return NextResponse.json({ error: "Privilège comptable requis." }, { status: 403 });
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
  return NextResponse.json(
    { rapports: (data ?? []).map((r: any) => ({ ...r, pharmacie_nom: r.pharmacies?.nom ?? null })) },
    { headers: { "Cache-Control": "no-store" } }
  );
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
  let hasActiveStockAssignment = false;
  if (profile.role === "pharmacie" && !["gestionnaire_stock", "magasinier"].includes(fonction)) {
    const { data: stockAssignments, error: stockAssignmentError } = await sb.from("naxa_professional_assignments")
      .select("commence_at,expire_at").eq("profile_id", auth.user.id).eq("statut", "active")
      .in("fonction", ["gestionnaire_stock", "magasinier"]);
    if (stockAssignmentError) return NextResponse.json({ error: "Les affectations de service Stock sont indisponibles." }, { status: 503 });
    const now = Date.now();
    hasActiveStockAssignment = (stockAssignments ?? []).some(a => new Date(a.commence_at).getTime() <= now && new Date(a.expire_at).getTime() > now);
  }

  if (profile.role === "admin") {
    const [{ data: pilotage, error: pilotageError }, { data: comptes, error: comptesError }] = await Promise.all([
      sb.rpc("stats_pilotage_scope", { p_jours: config.days }),
      sb.rpc("admin_comptes_indicateurs", { p_jours: config.days }),
    ]);
    if (pilotageError || comptesError) {
      return NextResponse.json({ error: "La consolidation Admin des comptes et indicateurs est indisponible. Aucun rapport incomplet n'est généré." }, { status: 503 });
    }
    const pilotageData = (Array.isArray(pilotage) ? pilotage[0] : pilotage) as Record<string, any>;
    const comptesData = (Array.isArray(comptes) ? comptes[0] : comptes) as Record<string, any>;
    if (!pilotageData || !comptesData || !comptesData.totaux || !Array.isArray(comptesData.par_pharmacie) || !Array.isArray(comptesData.par_promoteur)) {
      return NextResponse.json({ error: "La consolidation Admin a renvoyé un résultat incomplet." }, { status: 502 });
    }
    stats = { ...pilotageData, ...comptesData, role: "admin" };
  } else if (fonction === "pharmacien") {
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
    const { data: allowed, error: permissionError } = await sb.rpc("compta_scope_autorise", { p_pharmacie: profile.pharmacie_id });
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
  } else if (["gestionnaire_stock", "magasinier"].includes(fonction) || hasActiveStockAssignment) {
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

  // Affectations : lecture sous RLS, sans service-role ni exposition de noms/profils tiers.
  // Un membre ne voit que ses affectations; un Promoteur ne voit que celles qu'il a accordées.
  const assignmentSince = new Date(Date.now() - config.days * 86400000).toISOString();
  let assignmentRows: Array<{
    id: string; profile_id: string; pharmacie_id: string; fonction: string; statut: string;
    commence_at: string; expire_at: string; accorde_at: string; revoque_at: string | null;
  }> = [];
  if (profile.role === "promoteur" || profile.role === "pharmacie") {
    const [ownAssignmentsResult, grantedAssignmentsResult] = await Promise.all([
      sb.from("naxa_professional_assignments")
        .select("id,profile_id,pharmacie_id,fonction,statut,commence_at,expire_at,accorde_at,revoque_at")
        .eq("profile_id", auth.user.id)
        .gte("accorde_at", assignmentSince),
      profile.role === "promoteur"
        ? sb.from("naxa_professional_assignments")
            .select("id,profile_id,pharmacie_id,fonction,statut,commence_at,expire_at,accorde_at,revoque_at")
            .eq("accorde_par", auth.user.id)
            .gte("accorde_at", assignmentSince)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (ownAssignmentsResult.error || grantedAssignmentsResult.error) {
      return NextResponse.json({ error: "Le journal des affectations est indisponible. Aucun rapport partiel n'est présenté comme complet." }, { status: 503 });
    }
    assignmentRows = [...(ownAssignmentsResult.data ?? []), ...(grantedAssignmentsResult.data ?? [])]
      .filter((row, index, all) => all.findIndex(candidate => candidate.id === row.id) === index);
  }
  const assignmentNow = Date.now();
  const assignmentActive = assignmentRows.filter(row =>
    row.statut === "active" &&
    new Date(row.commence_at).getTime() <= assignmentNow &&
    new Date(row.expire_at).getTime() > assignmentNow
  );
  const assignmentFunctions = assignmentRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.fonction] = (acc[row.fonction] ?? 0) + 1;
    return acc;
  }, {});
  if (profile.role === "admin") {
    stats.affectations_periode = null;
    stats.affectations_actives_a_generation = null;
    stats.fonctions_affectees = null;
    stats.affectations_par_fonction = null;
  } else {
    stats.affectations_periode = assignmentRows.length;
    stats.affectations_actives_a_generation = assignmentActive.length;
    stats.fonctions_affectees = Object.keys(assignmentFunctions).length;
    stats.affectations_par_fonction = assignmentFunctions;
  }
  let assignmentNames = new Map<string, string>();
  let assignmentPharmacies = new Map<string, string>();
  if (profile.role === "promoteur" && assignmentRows.length) {
    const adminDb = supabaseAdmin();
    const profileIds = [...new Set(assignmentRows.map(row => row.profile_id))];
    const pharmacyIds = [...new Set(assignmentRows.map(row => row.pharmacie_id))];
    const [{ data: people, error: peopleError }, { data: pharmacies, error: pharmacyError }] = await Promise.all([
      adminDb.from("profiles").select("id,first_name,last_name,username").in("id", profileIds),
      adminDb.from("pharmacies").select("id,nom").in("id", pharmacyIds),
    ]);
    if (peopleError || pharmacyError) return NextResponse.json({ error: "Le détail nominatif des affectations est indisponible." }, { status: 503 });
    assignmentNames = new Map((people ?? []).map(person => [person.id, [person.first_name, person.last_name].filter(Boolean).join(" ") || person.username || "Personnel non identifié"]));
    assignmentPharmacies = new Map((pharmacies ?? []).map(pharmacy => [pharmacy.id, pharmacy.nom ?? "Pharmacie"]));
    stats.staff_concernes_par_affectation = new Set(assignmentRows.map(row => row.profile_id)).size;
    stats.pharmacies_concernees_par_affectation = new Set(assignmentRows.map(row => row.pharmacie_id)).size;
  }
  stats.details_affectations = assignmentRows.map(row => ({
    personnel: assignmentNames.get(row.profile_id) ?? (profile.role === "promoteur" ? "Personnel non identifié" : "Mon compte"),
    pharmacie: assignmentPharmacies.get(row.pharmacie_id) ?? "Pharmacie autorisée",
    fonction: row.fonction,
    statut: row.statut,
    debut: row.commence_at,
    fin_prevue: row.expire_at,
    accordee_le: row.accorde_at,
    revoquee_le: row.revoque_at,
  }));
  stats.note_affectations = profile.role === "admin" && stats.sources?.affectations_professionnelles === false
    ? "La source des affectations professionnelles n’est pas déployée sur cet environnement; les chiffres correspondants sont indisponibles et ne sont pas assimilés à zéro."
    : "Les affectations décrivent des autorisations temporaires, pas une présence. Les heures de service ci-dessous proviennent uniquement des sessions horodatées effectivement enregistrées; elles ne représentent pas les horaires planifiés ni les gardes publiées de la pharmacie.";

  // Pointages réels disponibles : Pharmacien, Gestionnaire de stock et sessions de caisse.
  // Les membres ordinaires ne lisent que leurs propres sessions sous RLS.
  const sinceSessions = new Date(Date.now() - config.days * 86400000).toISOString();
  let serviceRows: Array<{ poste: string; personnel?: string; debut: string; fin: string | null; duree_heures: number }> = [];
  if (fonction === "pharmacien") {
    const sessions = await fetchAllRows<{ id: string; started_at: string; ended_at: string | null }>((from, to) => sb.from("pharmacien_service_sessions")
      .select("id,started_at,ended_at").eq("pharmacien_id", auth.user.id)
      .gte("started_at", sinceSessions).order("started_at", { ascending: false }).range(from, to));
    if (sessions.error) return NextResponse.json({ error: "Le journal de service Pharmacien est indisponible." }, { status: 503 });
    serviceRows = sessions.data.map(s => ({ poste: "Pharmacien", debut: s.started_at, fin: s.ended_at, duree_heures: Math.round((Math.max(0, new Date(s.ended_at ?? new Date().toISOString()).getTime() - new Date(s.started_at).getTime()) / 3600000) * 100) / 100 }));
  } else if (["gestionnaire_stock", "magasinier"].includes(fonction)) {
    const sessions = await fetchAllRows<{ id: string; opened_at: string; closed_at: string | null }>((from, to) => sb.from("stock_service_sessions")
      .select("id,opened_at,closed_at").eq("gestionnaire_id", auth.user.id)
      .gte("opened_at", sinceSessions).order("opened_at", { ascending: false }).range(from, to));
    if (sessions.error) return NextResponse.json({ error: "Le journal de service Stock est indisponible." }, { status: 503 });
    serviceRows = sessions.data.map(s => ({ poste: "Gestionnaire de stock", debut: s.opened_at, fin: s.closed_at, duree_heures: Math.round((Math.max(0, new Date(s.closed_at ?? new Date().toISOString()).getTime() - new Date(s.opened_at).getTime()) / 3600000) * 100) / 100 }));
  } else if (fonction === "comptable") {
    const sessions = await fetchAllRows<{ id: string; started_at: string; ended_at: string | null }>((from, to) => sb.from("comptable_service_sessions")
      .select("id,started_at,ended_at").eq("comptable_id", auth.user.id)
      .gte("started_at", sinceSessions).order("started_at", { ascending: false }).range(from, to));
    if (sessions.error) return NextResponse.json({ error: "Le journal de service Comptable est indisponible." }, { status: 503 });
    serviceRows = sessions.data.map(s => ({ poste: "Comptable", debut: s.started_at, fin: s.ended_at, duree_heures: Math.round((Math.max(0, new Date(s.ended_at ?? new Date().toISOString()).getTime() - new Date(s.started_at).getTime()) / 3600000) * 100) / 100 }));
  } else if (profile.role === "caisse") {
    const sessions = await fetchAllRows<{ id: string; ouvert_at: string; cloture_at: string | null }>((from, to) => sb.from("caisses_sessions")
      .select("id,ouvert_at,cloture_at").eq("ouvert_par", auth.user.id)
      .gte("ouvert_at", sinceSessions).order("ouvert_at", { ascending: false }).range(from, to));
    if (sessions.error) return NextResponse.json({ error: "Le journal des sessions de caisse est indisponible." }, { status: 503 });
    serviceRows = sessions.data.map(s => ({ poste: "Caisse (session de caisse, pas présence générale)", debut: s.ouvert_at, fin: s.cloture_at, duree_heures: Math.round((Math.max(0, new Date(s.cloture_at ?? new Date().toISOString()).getTime() - new Date(s.ouvert_at).getTime()) / 3600000) * 100) / 100 }));
  } else if (profile.role === "promoteur") {
    const { data: rawIds, error: scopeError } = await sb.rpc("my_pharmacies");
    if (scopeError) return NextResponse.json({ error: "Le périmètre du réseau Promoteur est indisponible pour le rapport de service." }, { status: 503 });
    const ids = [...new Set(Array.isArray(rawIds) ? rawIds.filter((id): id is string => typeof id === "string") : [])];
    if (ids.length) {
      const adminDb = supabaseAdmin();
      const [{ data: pharmacies, error: pharmaciesError }, { data: pharmacists, error: pharmacistError }, { data: stock, error: stockError }, { data: profiles, error: profilesError }, { data: caisses, error: caissesError }, comptables] = await Promise.all([
        adminDb.from("pharmacies").select("id").in("id", ids).eq("actif", true),
        fetchAllRows<{ id: string; pharmacie_id: string; pharmacien_id: string; started_at: string; ended_at: string | null }>((from, to) => adminDb.from("pharmacien_service_sessions").select("id,pharmacie_id,pharmacien_id,started_at,ended_at").in("pharmacie_id", ids).gte("started_at", sinceSessions).order("started_at", { ascending: false }).range(from, to)),
        fetchAllRows<{ id: string; pharmacie_id: string; gestionnaire_id: string; opened_at: string; closed_at: string | null }>((from, to) => adminDb.from("stock_service_sessions").select("id,pharmacie_id,gestionnaire_id,opened_at,closed_at").in("pharmacie_id", ids).gte("opened_at", sinceSessions).order("opened_at", { ascending: false }).range(from, to)),
        adminDb.from("profiles").select("id,first_name,last_name,username").in("pharmacie_id", ids),
        adminDb.from("caisses").select("id,pharmacie_id,nom").in("pharmacie_id", ids),
        fetchAllRows<{ id: string; pharmacie_id: string; comptable_id: string; started_at: string; ended_at: string | null }>((from, to) => adminDb.from("comptable_service_sessions").select("id,pharmacie_id,comptable_id,started_at,ended_at").in("pharmacie_id", ids).gte("started_at", sinceSessions).order("started_at", { ascending: false }).range(from, to)),
      ]);
      if ([pharmaciesError, pharmacistError, stockError, profilesError, caissesError, comptables.error].some(Boolean)) return NextResponse.json({ error: "Une source du journal de service Promoteur est indisponible." }, { status: 503 });
      const activeIds = new Set((pharmacies ?? []).map(p => p.id));
      const names = new Map((profiles ?? []).map(p => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || p.username || "Personnel"]));
      const pushSession = (poste: string, userId: string, debut: string, fin: string | null) => {
        const elapsed = Math.max(0, new Date(fin ?? new Date().toISOString()).getTime() - new Date(debut).getTime());
        serviceRows.push({ poste, personnel: names.get(userId) ?? "Personnel non identifié", debut, fin, duree_heures: Math.round(elapsed / 36000) / 100 });
      };
      for (const s of pharmacists ?? []) if (activeIds.has(s.pharmacie_id)) pushSession("Pharmacien", s.pharmacien_id, s.started_at, s.ended_at);
      for (const s of stock ?? []) if (activeIds.has(s.pharmacie_id)) pushSession("Gestionnaire de stock", s.gestionnaire_id, s.opened_at, s.closed_at);
      for (const s of comptables.data ?? []) if (activeIds.has(s.pharmacie_id)) pushSession("Comptable", s.comptable_id, s.started_at, s.ended_at);
      const caisseIds = (caisses ?? []).filter(x => activeIds.has(x.pharmacie_id)).map(x => x.id);
      if (caisseIds.length) {
        const tills = await fetchAllRows<{ id: string; ouvert_par: string; ouvert_at: string; cloture_at: string | null; caisse_id: string }>((from, to) => adminDb.from("caisses_sessions")
          .select("id,ouvert_par,ouvert_at,cloture_at,caisse_id").in("caisse_id", caisseIds)
          .gte("ouvert_at", sinceSessions).order("ouvert_at", { ascending: false }).range(from, to));
        if (tills.error) return NextResponse.json({ error: "Les sessions de caisse du réseau sont indisponibles." }, { status: 503 });
        for (const s of tills.data) pushSession("Caisse", s.ouvert_par, s.ouvert_at, s.cloture_at);
      }
    }
  }
  if (serviceRows.length) {
    stats.services_pointes = serviceRows.length;
    stats.services_clotures = serviceRows.filter(s => s.fin !== null).length;
    stats.services_ouverts = serviceRows.filter(s => s.fin === null).length;
    stats.duree_services_heures = Math.round(serviceRows.reduce((sum, s) => sum + s.duree_heures, 0) * 100) / 100;
    stats.details_services = serviceRows.sort((a, b) => b.debut.localeCompare(a.debut));
  } else {
    stats.services_pointes = 0;
    stats.services_clotures = 0;
    stats.services_ouverts = 0;
    stats.duree_services_heures = 0;
    stats.details_services = [];
  }

  const now = new Date();
  const start = new Date(now.getTime() - config.days * 86400000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = now.toISOString().slice(0, 10);
  const rows = rowsFromStats(stats);
  const aiMetrics = buildAiMetrics(stats, rows);
  const ai = await explainWithAi(aiMetrics, profile.role, config.label);
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
    note_periode: [stats.role === "gestionnaire_stock" ? "Les indicateurs Stock présentés sont des états courants à la date de génération. La période sélectionnée ne les transforme pas en mouvements historiques." : null, stats.note_affectations, "Les durées de service sont calculées à partir des horodatages serveur des sessions ouvertes/clôturées. Une session encore ouverte est calculée jusqu’à l’heure de génération et reste provisoire. Les sessions de caisse décrivent l’ouverture/fermeture du tiroir, pas une présence générale. Les gardes de pharmacie publiées ne sont pas des gardes individuelles effectuées."].filter(Boolean).join(" "),
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
    const pdf = toPdf(report);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="naxa-rapport-${periode}-${endDate}.pdf"`, "Cache-Control": "no-store" } });
  }
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
