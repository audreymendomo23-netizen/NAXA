"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createClient}=require("@supabase/supabase-js");
const {createServerClient}=require("@supabase/ssr");
const {chromium}=require("playwright");
const REF="pwfftcsjyeibxxqhwysw";
const SUPABASE_URL="https://"+REF+".supabase.co";
const BASE=(process.env.NAXA_E2E_WEB_BASE_URL||"http://127.0.0.1:3000").replace(/\/+$/,"");
const STATE=path.join(process.env.RUNNER_TEMP||"/tmp","naxa-support-agent-e2e.json");
const ANON=process.env.NAXA_STORAGE_E2E_ANON_KEY;
const ADMIN_KEY=process.env.NAXA_STORAGE_E2E_ADMIN_KEY;
assert.equal(new globalThis.URL(process.env.NAXA_STORAGE_E2E_URL).origin,SUPABASE_URL,"Replay uniquement.");
assert.ok(ANON&&ADMIN_KEY,"Secrets Replay requis.");
const admin=createClient(SUPABASE_URL,ADMIN_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
let state={agents:[],tickets:[]};
const save=()=>fs.writeFileSync(STATE,JSON.stringify(state),{mode:0o600});

async function cleanup(){
 if(fs.existsSync(STATE)){try{state={...state,...JSON.parse(fs.readFileSync(STATE,"utf8"))};}catch{}}
 if(state.tickets.length){
  await admin.from("notifications").delete().in("related_entity_id",state.tickets);
  const m=await admin.from("messages_support").delete().in("ticket_id",state.tickets);if(m.error)throw m.error;
  const t=await admin.from("tickets_support").delete().in("id",state.tickets);if(t.error)throw t.error;
 }
 for(const id of state.agents){const r=await admin.auth.admin.deleteUser(id);if(r.error&&!/not found|does not exist/i.test(r.error.message||""))throw r.error;}
 if(state.agents.length){const r=await admin.from("support_agents").select("user_id").in("user_id",state.agents);if(r.error)throw r.error;assert.equal(r.data.length,0);}
 try{fs.unlinkSync(STATE);}catch{}
 console.log("CLEANUP PASS — comptes Auth Agent et tickets supprimés ; événements d'audit conservés anonymisés.");
}
async function sessionFor(username,role){
 const {data:p,error}=await admin.from("profiles").select("id,username,role,actif,age_verified").eq("username",username).single();if(error)throw error;
 assert.equal(p.role,role);assert.equal(p.actif,true);
 const {data:u,error:ue}=await admin.auth.admin.getUserById(p.id);if(ue)throw ue;
 const {data:g,error:ge}=await admin.auth.admin.generateLink({type:"magiclink",email:u.user.email});if(ge)throw ge;
 const jar=new Map();const ssr=createServerClient(SUPABASE_URL,ANON,{cookies:{getAll:()=>[...jar.values()].map(({name,value})=>({name,value})),setAll:cs=>cs.forEach(c=>jar.set(c.name,c))}});
 const {data:v,error:ve}=await ssr.auth.verifyOtp({token_hash:g.properties.hashed_token,type:"magiclink"});if(ve)throw ve;
 return {profile:p,accessToken:v.session.access_token,refreshToken:v.session.refresh_token,cookies:[...jar.values()]};
}
function cookieList(session){
 return session.cookies.map(c=>({name:c.name,value:c.value,domain:new URL(BASE).hostname,path:"/",httpOnly:!!c.options?.httpOnly,secure:false,sameSite:"Lax"}));
}
async function contextFor(browser,session){
 const c=await browser.newContext({viewport:{width:1280,height:900}});
 if(session)await c.addCookies(cookieList(session));
 await c.addCookies([{name:"naxa-age-status-v2",value:"adult",domain:new URL(BASE).hostname,path:"/",httpOnly:false,secure:false,sameSite:"Lax"}]);
 await c.addInitScript(()=>{try{localStorage.setItem("naxa-age-declaration-v1",JSON.stringify({confirmed:true,at:Date.now()}));}catch{}});
 return c;
}
async function createAgent(adminPage,tag,letter){
 const username="e2eagent"+letter+tag;
 const r=await adminPage.evaluate(async x=>{const r=await fetch("/api/admin/support-agents",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(x)});return {status:r.status,data:await r.json()};},{
  username,email:"naxa-agent-"+letter+"-"+tag+"@example.com",first_name:"E2E",last_name:"Agent"+letter,
  date_of_birth:"1990-01-01",permissions:["queue_view","ticket_view_assigned","ticket_reply","ticket_internal_note"],
 });
 assert.equal(r.status,201,JSON.stringify(r.data));state.agents.push(r.data.agent.user_id);save();
 const invalidPermission=await adminPage.evaluate(async x=>{const r=await fetch("/api/admin/support-agents",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(x)});return r.status;},{user_id:r.data.agent.user_id,status:"active",presence:"unavailable",permissions:["queue_view"]});
 assert.equal(invalidPermission,400,"Une permission dépendante ne doit pas survivre sans accès aux dossiers attribués.");
 const p=await admin.from("profiles").select("id").eq("id",r.data.agent.user_id).maybeSingle();if(p.error)throw p.error;assert.equal(p.data,null);
 return {id:r.data.agent.user_id,username,password:r.data.temporary_password,email:"naxa-agent-"+letter+"-"+tag+"@example.com"};
}
async function loginAgent(browser,agent,letter){
 const c=await contextFor(browser);const p=await c.newPage();await p.goto(BASE+"/connexion");
 await p.getByLabel("Nom d'utilisateur").fill(agent.username);await p.getByLabel("Mot de passe").fill(agent.password);
 const btn=p.getByRole("button",{name:"Connexion",exact:true});await btn.waitFor({state:"visible",timeout:20000});await btn.click();
 await p.waitForURL(u=>u.pathname==="/activation-agent",{timeout:30000});
 const next="NaxaAgent"+letter+"2026!";
 await p.getByLabel("Nouveau mot de passe").fill(next);await p.getByLabel("Confirmer le mot de passe").fill(next);
 await p.getByRole("checkbox").check();
 await p.getByRole("button",{name:"Sécuriser mon compte"}).click();
 await p.waitForURL(u=>u.pathname==="/equipe-support",{timeout:30000});
 await p.getByRole("heading",{name:"Tableau de bord support"}).waitFor({timeout:30000});
 await p.getByRole("button",{name:"Me rendre disponible"}).click();
 await p.getByRole("button",{name:"Passer indisponible"}).waitFor({timeout:10000});
 console.log("PASS — login Agent "+letter+", rotation initiale et présence disponible.");return {context:c,page:p,email:agent.email,password:next};
}
async function createTicket(client,subject){
 const r=await client.rpc("open_naxa_support_ticket",{p_categorie:"technique",p_sujet:subject,p_message:"Demande E2E "+subject});if(r.error)throw r.error;
 const row=Array.isArray(r.data)?r.data[0]:r.data;assert.ok(row.ticket_id);state.tickets.push(row.ticket_id);save();return row.ticket_id;
}
async function run(){
 let browser,adminContext,a,b;
 try{
  const [clientSession,adminSession]=await Promise.all([sessionFor("naxa_e2e_acheteur","client"),sessionFor("e2e_admin_261104","admin")]);
  const client=createClient(SUPABASE_URL,ANON,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {error:clientSessionError}=await client.auth.setSession({access_token:clientSession.accessToken,refresh_token:clientSession.refreshToken});
  if(clientSessionError)throw clientSessionError;
  const {data:clientAuth,error:clientAuthError}=await client.auth.getUser();
  if(clientAuthError)throw clientAuthError;
  assert.equal(clientAuth.user.id,clientSession.profile.id,"Client E2E doit être authentifié avec son propre JWT.");
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  adminContext=await contextFor(browser,adminSession);const adminPage=await adminContext.newPage();
  await adminPage.goto(BASE+"/admin/support-agents");await adminPage.getByRole("heading",{name:"Agents du service client"}).waitFor({timeout:30000});
  const tag=Date.now().toString(36);
  const agentA=await createAgent(adminPage,tag,"a");const agentB=await createAgent(adminPage,tag,"b");
  const ticketA=await createTicket(client,"E2E Agent A "+tag);
  const ticketB=await createTicket(client,"E2E Agent B "+tag);
  const ticketRace=await createTicket(client,"E2E Agent Race "+tag);
  a=await loginAgent(browser,agentA,"A");b=await loginAgent(browser,agentB,"B");
  const cardA=a.page.locator("article").filter({hasText:"E2E Agent A "+tag}).first();
  await cardA.getByRole("button",{name:"Prendre ce dossier"}).click();
  await cardA.getByRole("link",{name:"Ouvrir le dossier"}).waitFor({timeout:20000});
  const cardB=b.page.locator("article").filter({hasText:"E2E Agent B "+tag}).first();
  await cardB.getByRole("button",{name:"Prendre ce dossier"}).click();
  await cardB.getByRole("link",{name:"Ouvrir le dossier"}).waitFor({timeout:20000});
  console.log("PASS — chaque Agent prend son dossier depuis la file.");

  const ca=createClient(SUPABASE_URL,ANON,{auth:{persistSession:false,autoRefreshToken:false}});
  const cb=createClient(SUPABASE_URL,ANON,{auth:{persistSession:false,autoRefreshToken:false}});
  const [sa,sb]=await Promise.all([ca.auth.signInWithPassword({email:agentA.email,password:a.password}),cb.auth.signInWithPassword({email:agentB.email,password:b.password})]);
  if(sa.error)throw sa.error;if(sb.error)throw sb.error;
  const own=await ca.from("tickets_support").select("id").eq("id",ticketA);if(own.error)throw own.error;assert.equal(own.data.length,1);
  const cross=await ca.from("tickets_support").select("id").eq("id",ticketB);if(cross.error)throw cross.error;assert.equal(cross.data.length,0);
  const crossB=await cb.from("tickets_support").select("id").eq("id",ticketA);if(crossB.error)throw crossB.error;assert.equal(crossB.data.length,0);
  console.log("PASS — RLS inter-Agent : aucun accès au ticket de l’autre.");

  await a.page.goto(BASE+"/equipe-support/dossiers/"+ticketA);
  await a.page.getByRole("heading",{name:"E2E Agent A "+tag}).waitFor({timeout:20000});
  const note="Note interne "+tag,reply="Réponse publique "+tag;
  await a.page.getByLabel("Ajouter une note interne (invisible au demandeur)").check();
  await a.page.getByPlaceholder("Note réservée à l’équipe NAXA…").fill(note);
  await a.page.getByRole("button",{name:"Enregistrer la note"}).click();
  await a.page.getByText(note,{exact:true}).waitFor({timeout:20000});
  await a.page.getByLabel("Ajouter une note interne (invisible au demandeur)").uncheck();
  await a.page.getByPlaceholder("Votre réponse au demandeur…").fill(reply);
  await a.page.getByRole("button",{name:"Envoyer la réponse"}).click();
  await a.page.getByText(reply,{exact:true}).waitFor({timeout:20000});
  const [{data:clientMessages,error:cmError},{data:clientTicket,error:ctError},{data:storedMessages,error:smError}]=await Promise.all([
   client.from("messages_support").select("id,contenu,interne,auteur_profile_id,auteur_support_agent_id").eq("ticket_id",ticketA),
   client.from("tickets_support").select("id,auteur_profile_id,type,statut").eq("id",ticketA),
   admin.from("messages_support").select("id,contenu,interne,auteur_profile_id,auteur_support_agent_id").eq("ticket_id",ticketA),
  ]);
  if(cmError)throw cmError;if(ctError)throw ctError;if(smError)throw smError;
  console.log("TRACE — Client RLS ticket/messages:",JSON.stringify({ticket:clientTicket,messages:clientMessages,stored:storedMessages,clientId:clientSession.profile.id,reply,note}));
  assert.ok(clientMessages.some(m=>m.contenu===reply&&!m.interne),"Réponse Agent publique absente de la lecture Client RLS.");
  assert.ok(!clientMessages.some(m=>m.contenu===note),"La note interne est visible au Client.");
  const {data:agentMessages,error:amError}=await ca.from("messages_support").select("contenu,interne").eq("ticket_id",ticketA);
  if(amError)throw amError;assert.ok(agentMessages.some(m=>m.contenu===note&&m.interne));
  console.log("PASS — réponse publique visible Client ; note interne réservée Agent.");

  const clientRealtimeMessage="Réponse Client Realtime "+tag;
  const {error:clientReplyError}=await client.from("messages_support").insert({
   ticket_id:ticketA,auteur_profile_id:clientSession.profile.id,contenu:clientRealtimeMessage,interne:false,
  });
  if(clientReplyError)throw clientReplyError;
  await a.page.getByText(clientRealtimeMessage,{exact:true}).waitFor({timeout:20000});
  console.log("PASS — Realtime transmet une réponse Client à l’Agent affecté.");

  const forbidden=await b.page.evaluate(async id=>(await fetch("/api/support-agent/ticket?ticket_id="+id)).status,ticketA);
  assert.equal(forbidden,404);
  const double=await b.page.evaluate(async id=>(await fetch("/api/support-agent/claim",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ticket_id:id})})).status,ticketA);
  assert.ok([403,409].includes(double));
  const race=await Promise.all([
   admin.rpc("support_agent_claim_ticket",{p_agent_user_id:agentA.id,p_ticket_id:ticketRace}),
   admin.rpc("support_agent_claim_ticket",{p_agent_user_id:agentB.id,p_ticket_id:ticketRace}),
  ]);
  assert.equal(race.filter(x=>!x.error).length,1);
  const {data:assignments,error:ae}=await admin.from("support_ticket_assignments").select("id").eq("ticket_id",ticketRace).is("released_at",null);
  if(ae)throw ae;assert.equal(assignments.length,1);
  console.log("PASS — refus d'accès croisé, double prise refusée et concurrence atomique.");

  const adminProfile=adminSession.profile;
  const suspended=await admin.rpc("support_agent_admin_update",{p_agent_user_id:agentA.id,p_actor_user_id:adminProfile.id,p_status:"suspended",p_presence:"unavailable",p_permissions:null});
  if(suspended.error)throw suspended.error;
  const sessionStatus=await a.page.evaluate(async()=>(await fetch("/api/support-agent/session")).status);
  assert.equal(sessionStatus,403);
  const {data:ticketState,error:te}=await admin.from("tickets_support").select("statut").eq("id",ticketA).single();
  if(te)throw te;assert.equal(ticketState.statut,"ouvert");
  console.log("PASS — suspension révoque l'accès et libère le ticket.");

  const reassign=await admin.rpc("support_agent_claim_ticket",{p_agent_user_id:agentB.id,p_ticket_id:ticketA});
  if(reassign.error)throw reassign.error;
  const reactivate=await admin.rpc("support_agent_admin_update",{p_agent_user_id:agentA.id,p_actor_user_id:adminProfile.id,p_status:"active",p_presence:"available",p_permissions:["queue_view","ticket_view_assigned","ticket_reply","ticket_internal_note"]});
  if(reactivate.error)throw reactivate.error;
  const reactivated=await a.page.evaluate(async()=>(await fetch("/api/support-agent/session")).status);
  assert.equal(reactivated,200);
  console.log("PASS GLOBAL — cycle de vie Agent, login, permissions, RLS, messagerie, file et concurrence.");
 }finally{
  if(a?.context)await a.context.close().catch(()=>{});if(b?.context)await b.context.close().catch(()=>{});
  if(adminContext)await adminContext.close().catch(()=>{});if(browser)await browser.close().catch(()=>{});
  await cleanup();
 }
}
if(process.argv.includes("--cleanup"))cleanup().catch(e=>{console.error(e);process.exitCode=1;});
else run().catch(e=>{console.error(e);process.exitCode=1;});
