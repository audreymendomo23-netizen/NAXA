"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createClient}=require("@supabase/supabase-js");
const {createServerClient}=require("@supabase/ssr");
const {chromium}=require("playwright");
const PROJECT_REF="pwfftcsjyeibxxqhwysw";
const PROJECT_URL="https://"+PROJECT_REF+".supabase.co";
const BASE_URL=(process.env.NAXA_E2E_WEB_BASE_URL||"http://127.0.0.1:3000").replace(/\/+$/,"");
const STATE_FILE=path.join(process.env.RUNNER_TEMP||"/tmp","naxa-professional-support-e2e.json");
const ADMIN_USERNAME="e2e_admin_261104";
const PROFESSIONALS=[
 {username:"naxa_e2e_promoteur",profileRole:"promoteur",role:"promoteur",route:"/pharmacie/promoteur",category:"gestion_espace"},
 {username:"naxa_e2e_responsable",profileRole:"client",role:"responsable",route:"/pharmacie/responsable/credits",category:"personnel"},
 {username:"naxa_e2e_pharmacien",profileRole:"client",role:"pharmacien",route:"/pharmacie/pharmacien",category:"personnel"},
 {username:"naxa_e2e_gestionnaire_stock",profileRole:"client",role:"gestionnaire_stock",route:"/pharmacie/gestionnaire-stock",category:"stock"},
 {username:"naxa_e2e_stock",profileRole:"client",role:"gestionnaire_stock",route:"/pharmacie/gestionnaire-stock",category:"stock"},
 {username:"naxa_e2e_comptable",profileRole:"client",role:"comptable",route:"/pharmacie/comptable",category:"caisse"},
 {username:"naxa_e2e_caisse",profileRole:"client",role:"caisse",route:"/pharmacie/caisse",category:"caisse"},
 {username:"naxa_e2e_livreur",profileRole:"client",role:"livreur",route:"/pharmacie/livreur",category:"livraison"}
];
function required(value,name){assert.ok(value&&String(value).trim(),"Secret Replay manquant : "+name);return value;}
const supabaseUrl=required(process.env.NAXA_STORAGE_E2E_URL,"NAXA_STORAGE_E2E_URL");
const anonKey=required(process.env.NAXA_STORAGE_E2E_ANON_KEY,"NAXA_STORAGE_E2E_ANON_KEY");
const adminKey=required(process.env.NAXA_STORAGE_E2E_ADMIN_KEY,"NAXA_STORAGE_E2E_ADMIN_KEY");
assert.equal(new URL(supabaseUrl).origin,PROJECT_URL,"Sécurité : recette limitée à Replay.");
const admin=createClient(PROJECT_URL,adminKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
let state={tickets:[]};
function saveState(){fs.writeFileSync(STATE_FILE,JSON.stringify(state),{mode:0o600});}
async function cleanup(){
 if(fs.existsSync(STATE_FILE)){try{state=JSON.parse(fs.readFileSync(STATE_FILE,"utf8"));}catch{}}
 const ids=new Set((state.tickets||[]).map(x=>x.ticketId).filter(Boolean));
 for(const item of state.tickets||[]){if(item.ticketId||!item.subject||!item.userId)continue;
  const {data,error}=await admin.from("tickets_support").select("id").eq("auteur_profile_id",item.userId).eq("sujet",item.subject).eq("type","support_naxa").limit(2);
  if(error)throw error;assert.ok((data||[]).length<=1,"Plusieurs tickets pour une fixture.");if(data?.[0]?.id)ids.add(data[0].id);}
 for(const id of ids){
  const {data:messages,error:readError}=await admin.from("messages_support").select("piece_jointe_path").eq("ticket_id",id);if(readError)throw readError;
  const files=(messages||[]).map(x=>x.piece_jointe_path).filter(Boolean);
  if(files.length){const {error}=await admin.storage.from("naxa-support-attachments").remove(files);if(error)throw error;}
  const {error:notificationsError}=await admin.from("notifications").delete().eq("related_entity_id",id);if(notificationsError)throw notificationsError;
  const {error:messagesError}=await admin.from("messages_support").delete().eq("ticket_id",id);if(messagesError)throw messagesError;
  const {error:ticketError}=await admin.from("tickets_support").delete().eq("id",id);if(ticketError)throw ticketError;
  const {data:remaining,error:verifyError}=await admin.from("tickets_support").select("id").eq("id",id);if(verifyError)throw verifyError;
  assert.equal((remaining||[]).length,0,"Ticket professionnel non nettoyé.");
 }
 try{fs.unlinkSync(STATE_FILE);}catch{}
 console.log("CLEANUP PASS — tickets, messages, notifications et fichiers professionnels supprimés de Replay.");
}
async function sessionFor(username,profileRole,activeRole){
 const {data:profile,error:profileError}=await admin.from("profiles").select("id,username,role,actif").eq("username",username).single();if(profileError)throw profileError;
 assert.equal(profile.role,profileRole);assert.equal(profile.actif,true);
 const {data:authData,error:authError}=await admin.auth.admin.getUserById(profile.id);if(authError)throw authError;
 const user=authData.user;assert.ok(user?.email&&user.email_confirmed_at);
 const fixtureMarker=user.user_metadata?.naxa_e2e_fixture;assert.ok(fixtureMarker===true||String(fixtureMarker||"").startsWith("NAXA-E2E-"));
 const {data:generated,error:linkError}=await admin.auth.admin.generateLink({type:"magiclink",email:user.email});if(linkError)throw linkError;
 const tokenHash=generated?.properties?.hashed_token;assert.ok(tokenHash);
 const jar=new Map();const ssr=createServerClient(PROJECT_URL,anonKey,{cookies:{getAll:()=>Array.from(jar.values()).map(({name,value})=>({name,value})),setAll:cs=>{for(const c of cs)jar.set(c.name,c);}}});
 const {data:verified,error:verifyError}=await ssr.auth.verifyOtp({token_hash:tokenHash,type:"magiclink"});if(verifyError)throw verifyError;
 assert.ok(verified.session?.access_token&&jar.size);
 const client=createClient(PROJECT_URL,anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:"Bearer "+verified.session.access_token}}});
 const [{data:authUser,error:getError},{data:role,error:roleError}]=await Promise.all([client.auth.getUser(verified.session.access_token),client.rpc("naxa_business_function")]);
 if(getError)throw getError;if(roleError)throw roleError;assert.equal(authUser.user.id,profile.id);assert.equal(role,activeRole);
 return {profile,accessToken:verified.session.access_token,cookies:Array.from(jar.values())};
}
function cookieList(session){const host=new URL(BASE_URL).hostname;return session.cookies.map(c=>{const o=c.options||{};const same=String(o.sameSite||"lax").toLowerCase();return {name:c.name,value:c.value,domain:host,path:"/",httpOnly:Boolean(o.httpOnly),secure:new URL(BASE_URL).protocol==="https:",sameSite:same==="strict"?"Strict":same==="none"?"None":"Lax"};});}
async function contextFor(browser,session,viewport){const ctx=await browser.newContext({viewport});await ctx.addCookies(cookieList(session));return ctx;}
async function run(){
 const adminSession=await sessionFor(ADMIN_USERNAME,"admin","admin");
 const sessions=[];for(const fixture of PROFESSIONALS)sessions.push({fixture,session:await sessionFor(fixture.username,fixture.profileRole,fixture.role)});
 let browser,adminContext,adminPage;const contexts=[];
 try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  adminContext=await contextFor(browser,adminSession,{width:1440,height:1000});adminPage=await adminContext.newPage();
  await adminPage.goto(BASE_URL+"/admin/messagerie",{waitUntil:"domcontentloaded"});
  await adminPage.getByRole("heading",{name:"Messagerie"}).waitFor({state:"visible",timeout:30000});
  console.log("PASS — boîte Admin accessible.");
  for(const {fixture,session} of sessions){
   const ctx=await contextFor(browser,session,{width:390,height:844});contexts.push(ctx);const page=await ctx.newPage();
   await page.goto(BASE_URL+fixture.route,{waitUntil:"domcontentloaded"});
   const trigger=page.getByRole("button",{name:"Ouvrir le livechat NAXA"});await trigger.waitFor({state:"visible",timeout:30000});await trigger.click();
   const dialog=page.getByRole("dialog",{name:"Livechat avec l’équipe NAXA"});await dialog.waitFor({state:"visible"});
   await dialog.getByRole("link",{name:"Consulter la FAQ NAXA"}).waitFor({state:"visible"});
   console.log("PASS — widget professionnel et raccourci FAQ visibles pour "+fixture.role+".");
   const subject="E2E Support "+fixture.role+" "+Date.now();const first="Demande directe "+fixture.role;const reply="Réponse NAXA "+fixture.role;
   const item={userId:session.profile.id,subject,ticketId:null};state.tickets.push(item);saveState();
   await dialog.getByRole("button",{name:"+ Nouveau"}).click();
   await dialog.getByLabel("Catégorie").selectOption(fixture.category);
   await dialog.getByLabel("Sujet").fill(subject);await dialog.getByLabel("Ton premier message").fill(first);
   const rpcPromise=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith("/rest/v1/rpc/open_naxa_support_ticket"),{timeout:30000});
   await dialog.getByRole("button",{name:"Démarrer la conversation"}).click();const rpc=await rpcPromise;const payload=await rpc.json().catch(()=>null);
   assert.equal(rpc.status(),200,"RPC refusée pour "+fixture.role+" : "+JSON.stringify(payload));
   const row=Array.isArray(payload)?payload[0]:payload;assert.ok(row?.ticket_id);item.ticketId=String(row.ticket_id);saveState();
   const {data:ticket,error:ticketError}=await admin.from("tickets_support").select("id,auteur_profile_id,type,pharmacie_id,categorie").eq("id",item.ticketId).single();if(ticketError)throw ticketError;
   assert.equal(ticket.auteur_profile_id,session.profile.id);assert.equal(ticket.type,"support_naxa");assert.equal(ticket.pharmacie_id,null);assert.equal(ticket.categorie,fixture.category);
   await dialog.getByText(first,{exact:true}).waitFor({state:"visible",timeout:20000});
   await dialog.getByText("Temps réel actif",{exact:false}).waitFor({state:"visible",timeout:30000});
   console.log("PASS — création du dossier individuel "+fixture.role+" et abonnement Realtime.");
   await adminPage.reload({waitUntil:"domcontentloaded"});await adminPage.getByText(subject,{exact:true}).waitFor({state:"visible",timeout:20000});
   await adminPage.getByText(fixture.role,{exact:false}).waitFor({state:"visible",timeout:20000});
   const response=await adminPage.request.post(BASE_URL+"/api/admin/messagerie",{headers:{"Content-Type":"application/json"},data:{ticket_id:item.ticketId,contenu:reply}});
   assert.equal(response.status(),201,"Réponse Admin refusée pour "+fixture.role+".");
   await dialog.getByText(reply,{exact:true}).waitFor({state:"visible",timeout:30000});
   console.log("PASS — réponse Admin reçue en direct par "+fixture.role+".");
   const {data:notifications,error:notificationError}=await admin.from("notifications").select("user_id,type,related_entity_id").eq("related_entity_id",item.ticketId);if(notificationError)throw notificationError;
   assert.ok((notifications||[]).some(n=>n.user_id===session.profile.id&&n.type==="support_naxa_reponse"));
   console.log("PASS — notification de réponse privée "+fixture.role+".");
   await page.goto(BASE_URL+"/assistance",{waitUntil:"domcontentloaded"});
   await page.getByRole("heading",{name:"Écrire à l’équipe NAXA"}).waitFor({state:"visible",timeout:20000});
   await page.getByText(subject,{exact:true}).waitFor({state:"visible",timeout:20000});
   console.log("PASS — suivi complet /assistance pour "+fixture.role+".");
   await ctx.close();contexts.pop();
  }
  console.log("RÉSULTAT — assistance professionnelle Promoteur + Livreur ↔ Admin : PASS sur Replay.");
 }finally{
  for(const ctx of contexts)await ctx.close().catch(()=>{});if(adminContext)await adminContext.close().catch(()=>{});if(browser)await browser.close().catch(()=>{});await cleanup();
 }
}
if(process.argv.includes("--cleanup"))cleanup().catch(e=>{console.error("CLEANUP FAIL — "+e.message);process.exitCode=1;});
else run().catch(e=>{console.error("PRO SUPPORT E2E FAIL — "+(e.stack||e.message));process.exitCode=1;});
