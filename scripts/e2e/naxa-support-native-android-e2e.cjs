"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {createClient}=require("@supabase/supabase-js"),{createServerClient}=require("@supabase/ssr"),{chromium}=require("playwright");
const REF="pwfftcsjyeibxxqhwysw",SUPABASE_URL="https://"+REF+".supabase.co";
const BASE=(process.env.NAXA_E2E_WEB_BASE_URL||"http://127.0.0.1:3000").replace(/\/+$/,"");
const STATE=path.join(process.env.RUNNER_TEMP||"/tmp","naxa-support-native-android-e2e.json");
const ANON=process.env.NAXA_STORAGE_E2E_ANON_KEY,ADMIN_KEY=process.env.NAXA_STORAGE_E2E_ADMIN_KEY;
const required=(v,n)=>{if(!v)throw Error("Variable manquante : "+n);return v;};
function adminClient(){
 const configured=required(process.env.NAXA_STORAGE_E2E_URL,"NAXA_STORAGE_E2E_URL");
 assert.equal(new globalThis.URL(configured).origin,SUPABASE_URL,"Replay uniquement.");
 return createClient(SUPABASE_URL,required(ADMIN_KEY,"NAXA_STORAGE_E2E_ADMIN_KEY"),{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
async function sessionFor(username,role){
 const admin=adminClient(),p=await admin.from("profiles").select("id,role,actif").eq("username",username).single();
 if(p.error)throw p.error;assert.equal(p.data.role,role);assert.equal(p.data.actif,true);
 const u=await admin.auth.admin.getUserById(p.data.id);if(u.error)throw u.error;
 assert.ok(u.data.user.email&&u.data.user.email_confirmed_at);
 const link=await admin.auth.admin.generateLink({type:"magiclink",email:u.data.user.email});if(link.error)throw link.error;
 const jar=new Map(),ssr=createServerClient(SUPABASE_URL,required(ANON,"NAXA_STORAGE_E2E_ANON_KEY"),{
  cookies:{getAll:()=>[...jar.values()].map(({name,value})=>({name,value})),setAll:cs=>cs.forEach(c=>jar.set(c.name,c))}
 });
 const verify=await ssr.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:"magiclink"});if(verify.error)throw verify.error;
 assert.ok(verify.data.session?.access_token&&verify.data.session?.refresh_token);
 return {profile:p.data,access:verify.data.session.access_token,refresh:verify.data.session.refresh_token,cookies:[...jar.values()]};
}
async function contextFor(browser,session){
 const ctx=await browser.newContext({viewport:{width:1365,height:920}});
 await ctx.grantPermissions(["microphone"],{origin:BASE});
 if(session)await ctx.addCookies(session.cookies.map(c=>({name:c.name,value:c.value,domain:new URL(BASE).hostname,path:"/",httpOnly:!!c.options?.httpOnly,secure:false,sameSite:"Lax"})));
 await ctx.addCookies([{name:"naxa-age-status-v2",value:"adult",domain:new URL(BASE).hostname,path:"/",httpOnly:false,secure:false,sameSite:"Lax"}]);
 await ctx.addInitScript(()=>{
  try{localStorage.setItem("naxa-age-declaration-v1",JSON.stringify({confirmed:true,at:Date.now()}));}catch{}
  const peers=[],Native=window.RTCPeerConnection;
  Object.defineProperty(window,"__naxaE2EPeerConnections",{value:peers,configurable:false});
  window.RTCPeerConnection=class extends Native{constructor(config,...args){super({...config,iceTransportPolicy:"relay"},...args);peers.push(this);}};
 });
 return ctx;
}
const save=s=>fs.writeFileSync(STATE,JSON.stringify(s),{mode:0o600});
const load=()=>fs.existsSync(STATE)?JSON.parse(fs.readFileSync(STATE,"utf8")):null;
async function prepare(){
 const clientSession=await sessionFor("naxa_e2e_acheteur","client"),adminSession=await sessionFor("e2e_admin_261104","admin");
 const client=createClient(SUPABASE_URL,required(ANON,"NAXA_STORAGE_E2E_ANON_KEY"),{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const set=await client.auth.setSession({access_token:clientSession.access,refresh_token:clientSession.refresh});if(set.error)throw set.error;
 const auth=await client.auth.getUser();if(auth.error)throw auth.error;assert.equal(auth.data.user.id,clientSession.profile.id);
 const tag=String(process.env.GITHUB_RUN_ID||Date.now()).slice(-8)+Math.random().toString(36).slice(2,6),subject="NAXA Android Support "+tag;
 const ticket=await client.rpc("open_naxa_support_ticket",{p_categorie:"technique",p_sujet:subject,p_message:"Recette E2E Android native et partage MediaProjection."});
 if(ticket.error)throw ticket.error;
 const ticketRow=Array.isArray(ticket.data)?ticket.data[0]:ticket.data;assert.ok(ticketRow?.ticket_id);
 const state={tag,subject,ticketId:String(ticketRow.ticket_id),requesterId:clientSession.profile.id,access:clientSession.access,refresh:clientSession.refresh,agent:null,callId:null};save(state);
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const ctx=await contextFor(browser,adminSession);
  try{
   const page=await ctx.newPage();await page.goto(BASE+"/admin/support-agents",{waitUntil:"domcontentloaded"});
   await page.getByRole("heading",{name:"Agents du service client"}).waitFor({timeout:30000});
   const username="e2eandroid"+tag;
   const r=await page.evaluate(async p=>{
    const response=await fetch("/api/admin/support-agents",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)});
    return {status:response.status,data:await response.json()};
   },{username,email:"naxa-android-agent-"+tag+"@example.com",first_name:"E2E",last_name:"AndroidAgent",date_of_birth:"1990-01-01",permissions:["queue_view","ticket_view_assigned","ticket_reply","ticket_internal_note","audio_call"]});
   assert.equal(r.status,201,JSON.stringify(r.data));state.agent={id:r.data.agent.user_id,username,password:r.data.temporary_password};save(state);
  }finally{await ctx.close();}
 }finally{if(browser)await browser.close();}
 if(process.env.GITHUB_ENV){
  for(const [key,value] of Object.entries({NAXA_SUPPORT_E2E_ACCESS_TOKEN:state.access,NAXA_SUPPORT_E2E_REFRESH_TOKEN:state.refresh,NAXA_SUPPORT_E2E_SUBJECT:state.subject})){
   if(key.endsWith("TOKEN"))process.stdout.write("::add-mask::"+value+"\n");
   fs.appendFileSync(process.env.GITHUB_ENV,key+"="+String(value).replace(/[\r\n]/g,"")+"\n");
  }
 }
 console.log("PASS — Client authentifié, ticket "+state.ticketId+" et Agent Replay temporaire créés.");
}
async function loginAgent(browser,agent){
 const ctx=await contextFor(browser,null),page=await ctx.newPage();
 await page.goto(BASE+"/connexion",{waitUntil:"domcontentloaded"});
 await page.getByLabel("Nom d'utilisateur").fill(agent.username);await page.getByLabel("Mot de passe").fill(agent.password);
 await page.getByRole("button",{name:"Connexion",exact:true}).click();
 await page.waitForURL(u=>u.pathname==="/activation-agent",{timeout:30000});
 const password="NaxaAndroid"+String(Date.now()).slice(-6)+"!";
 await page.getByLabel("Nouveau mot de passe").fill(password);await page.getByLabel("Confirmer le mot de passe").fill(password);
 await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Sécuriser mon compte"}).click();
 await page.waitForURL(u=>u.pathname==="/equipe-support",{timeout:30000});
 await page.getByRole("heading",{name:"Tableau de bord support"}).waitFor({timeout:30000});
 const response=page.waitForResponse(r=>r.url().endsWith("/api/support-agent/presence")&&r.request().method()==="PATCH",{timeout:15000});
 await page.getByRole("button",{name:"Me rendre disponible"}).click();assert.equal((await response).status(),200);
 const presence=await adminClient().from("support_agents").select("status,presence").eq("user_id",agent.id).single();if(presence.error)throw presence.error;
 assert.equal(presence.data.status,"active");assert.equal(presence.data.presence,"available");
 return {context:ctx,page};
}
async function waitCall(admin,ticketId){
 const until=Date.now()+120000;let last=null;
 while(Date.now()<until){
  const r=await admin.from("support_calls").select("id,requester_user_id,agent_user_id,status").eq("ticket_id",ticketId).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(r.error)throw r.error;last=r.data;if(last?.status==="ringing")return last;await new Promise(resolve=>setTimeout(resolve,500));
 }
 throw Error("L’appel Android n’est pas arrivé pour acceptation : "+JSON.stringify(last));
}
async function waitHeartbeats(admin,callId){
 const until=Date.now()+60000;let last=null;
 while(Date.now()<until){
  const r=await admin.from("support_calls").select("requester_heartbeat_at,agent_heartbeat_at").eq("id",callId).single();
  if(r.error)throw r.error;last=r.data;if(last.requester_heartbeat_at&&last.agent_heartbeat_at)return last;await new Promise(resolve=>setTimeout(resolve,500));
 }
 throw Error("Heartbeats incomplets : "+JSON.stringify(last));
}
async function proveAudio(page){
 await page.waitForFunction(async()=>{
  const pc=window.__naxaE2EPeerConnections.at(-1);if(!pc||pc.connectionState!=="connected")return false;
  const rows=Array.from((await pc.getStats()).values()),audio=s=>s.kind==="audio"||s.mediaType==="audio";
  return rows.some(s=>s.type==="inbound-rtp"&&audio(s)&&(s.packetsReceived||0)>0)&&rows.some(s=>s.type==="outbound-rtp"&&audio(s)&&(s.packetsSent||0)>0);
 },null,{timeout:45000});
 return page.evaluate(async()=>{
  const pc=window.__naxaE2EPeerConnections.at(-1),rows=Array.from((await pc.getStats()).values()),audio=s=>s.kind==="audio"||s.mediaType==="audio";
  return {connection:pc.connectionState,inbound:rows.filter(s=>s.type==="inbound-rtp"&&audio(s)).reduce((n,s)=>n+(s.packetsReceived||0),0),outbound:rows.filter(s=>s.type==="outbound-rtp"&&audio(s)).reduce((n,s)=>n+(s.packetsSent||0),0)};
 });
}
async function proveVideo(page){
 await page.getByLabel("Écran partagé par le demandeur").waitFor({state:"visible",timeout:45000});
 await page.waitForFunction(async()=>{
  const v=document.querySelector('video[aria-label="Écran partagé par le demandeur"]'),pc=window.__naxaE2EPeerConnections.at(-1);
  if(!v||v.videoWidth<1||v.videoHeight<1||v.readyState<2||!pc)return false;
  return Array.from((await pc.getStats()).values()).some(s=>s.type==="inbound-rtp"&&(s.kind==="video"||s.mediaType==="video")&&(s.packetsReceived||0)>0);
 },null,{timeout:45000});
 return page.evaluate(async()=>{
  const v=document.querySelector('video[aria-label="Écran partagé par le demandeur"]'),pc=window.__naxaE2EPeerConnections.at(-1);
  const rows=Array.from((await pc.getStats()).values()).filter(s=>s.type==="inbound-rtp"&&(s.kind==="video"||s.mediaType==="video"));
  return {width:v.videoWidth,height:v.videoHeight,packets:rows.reduce((n,s)=>n+(s.packetsReceived||0),0),bytes:rows.reduce((n,s)=>n+(s.bytesReceived||0),0)};
 });
}
async function runAgent(){
 const state=load();if(!state?.agent)throw Error("État de recette/Agent absent.");const admin=adminClient();let browser,agentCtx;
 try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream","--autoplay-policy=no-user-gesture-required"]});
  const agent=await loginAgent(browser,state.agent);agentCtx=agent.context;const page=agent.page;
  const card=page.locator("article").filter({hasText:state.subject}).first();
  await card.waitFor({state:"visible",timeout:30000});await card.getByRole("button",{name:"Prendre ce dossier"}).click();
  await card.getByRole("link",{name:"Ouvrir le dossier"}).waitFor({timeout:20000});
  console.log("AGENT READY — ticket pris par l’Agent "+state.agent.id);
  const call=await waitCall(admin,state.ticketId);
  assert.equal(call.requester_user_id,state.requesterId);assert.equal(call.agent_user_id,state.agent.id);
  state.callId=call.id;save(state);
  await page.getByRole("button",{name:"Accepter l’appel"}).waitFor({timeout:45000});
  await page.getByRole("button",{name:"Accepter l’appel"}).click();
  await page.waitForURL(u=>u.pathname==="/equipe-support/dossiers/"+state.ticketId&&u.searchParams.get("callId")===call.id,{timeout:30000});
  await page.getByText("Canal sécurisé connecté",{exact:true}).waitFor({timeout:45000});
  const heartbeat=await waitHeartbeats(admin,call.id),audio=await proveAudio(page);
  assert.ok(audio.inbound>0&&audio.outbound>0);console.log("PASS — audio Android ↔ Agent RTP : "+JSON.stringify(audio));
  const video=await proveVideo(page);assert.ok(video.width>0&&video.height>0&&video.packets>0&&video.bytes>0);
  console.log("PASS — MediaProjection Android ↔ Agent : "+JSON.stringify(video));
  const until=Date.now()+45000;let status=null;
  while(Date.now()<until){const r=await admin.from("support_calls").select("status").eq("id",call.id).single();if(r.error)throw r.error;status=r.data.status;if(status==="completed")break;await new Promise(resolve=>setTimeout(resolve,500));}
  assert.equal(status,"completed","L’appel doit être raccroché par le Client Android.");
  const events=await admin.from("support_call_events").select("actor_user_id,event_code").eq("call_id",call.id);if(events.error)throw events.error;
  assert.ok(events.data.some(e=>e.actor_user_id===state.requesterId&&e.event_code==="screen_share_started"));
  assert.ok(events.data.some(e=>e.actor_user_id===state.requesterId&&e.event_code==="screen_share_stopped"));
  assert.ok(heartbeat.requester_heartbeat_at&&heartbeat.agent_heartbeat_at);
  console.log("PASS GLOBAL — audio/vidéo natifs, arrêt explicite, raccrochage, heartbeat et audit Replay.");
 }finally{if(agentCtx)await agentCtx.close().catch(()=>{});if(browser)await browser.close().catch(()=>{});}
}
async function cleanup(){
 const state=load();if(!state){console.log("CLEANUP — aucune fixture.");return;}const admin=adminClient();
 if(state.callId){
  const call=await admin.from("support_calls").select("status").eq("id",state.callId).maybeSingle();if(call.error)throw call.error;
  if(call.data&&["queued","ringing"].includes(call.data.status)){const r=await admin.rpc("naxa_support_call_transition",{p_actor_user_id:state.requesterId,p_call_id:state.callId,p_action:"cancel"});if(r.error)throw r.error;}
  else if(call.data?.status==="accepted"){const r=await admin.rpc("naxa_support_call_transition",{p_actor_user_id:state.requesterId,p_call_id:state.callId,p_action:"end"});if(r.error)throw r.error;}
 }
 if(state.ticketId){
  for(const r of [await admin.from("notifications").delete().eq("related_entity_id",state.ticketId),await admin.from("messages_support").delete().eq("ticket_id",state.ticketId),await admin.from("tickets_support").delete().eq("id",state.ticketId)])if(r.error)throw r.error;
 }
 if(state.agent?.id){
  const d=await admin.auth.admin.deleteUser(state.agent.id);if(d.error&&!/not found|does not exist/i.test(d.error.message||""))throw d.error;
  const remaining=await admin.from("support_agents").select("user_id").eq("user_id",state.agent.id);if(remaining.error)throw remaining.error;assert.equal((remaining.data||[]).length,0);
 }
 fs.unlinkSync(STATE);console.log("CLEANUP PASS — ticket et Agent temporaire supprimés de Replay.");
}
const mode=process.argv[2]||"--prepare",actions={"--prepare":prepare,"--agent":runAgent,"--cleanup":cleanup};
if(!actions[mode])throw Error("Mode invalide : "+mode);
actions[mode]().catch(e=>{console.error("NAXA NATIVE SUPPORT ANDROID E2E FAIL — "+(e.stack||e.message));process.exitCode=1;});
