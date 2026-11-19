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
let state={agents:[],tickets:[],calls:[]};
const save=()=>fs.writeFileSync(STATE,JSON.stringify(state),{mode:0o600});

async function cleanup(){
 if(fs.existsSync(STATE)){try{state={...state,...JSON.parse(fs.readFileSync(STATE,"utf8"))};}catch{}}
 for(const call of (state.calls??[])){
  const {data:current,error:readError}=await admin.from("support_calls").select("status").eq("id",call.id).maybeSingle();
  if(readError)throw readError;
  if(current&&["queued","ringing"].includes(current.status)){
   const result=await admin.rpc("naxa_support_call_transition",{p_actor_user_id:call.requesterId,p_call_id:call.id,p_action:"cancel"});
   if(result.error)throw result.error;
  }else if(current?.status==="accepted"){
   const result=await admin.rpc("naxa_support_call_transition",{p_actor_user_id:call.requesterId,p_call_id:call.id,p_action:"end"});
   if(result.error)throw result.error;
  }
 }
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
 await c.grantPermissions(["microphone"],{origin:BASE});
 if(session)await c.addCookies(cookieList(session));
 await c.addCookies([{name:"naxa-age-status-v2",value:"adult",domain:new URL(BASE).hostname,path:"/",httpOnly:false,secure:false,sameSite:"Lax"}]);
 await c.addInitScript(()=>{
  try{localStorage.setItem("naxa-age-declaration-v1",JSON.stringify({confirmed:true,at:Date.now()}));}catch{}
  const peerConnections=[];
  Object.defineProperty(window,"__naxaE2EPeerConnections",{value:peerConnections,configurable:false});
  const NativePeerConnection=window.RTCPeerConnection;
  window.RTCPeerConnection=class extends NativePeerConnection{
   constructor(configuration,...args){
    super({...configuration,iceTransportPolicy:"relay"},...args);
    peerConnections.push(this);
   }
  };
  const nativeGetUserMedia=navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  const audioContexts=[];
  Object.defineProperty(window,"__naxaE2EAudioContexts",{value:audioContexts,configurable:false});
  if(nativeGetUserMedia){
   navigator.mediaDevices.getUserMedia=async constraints=>{
    const captured=await nativeGetUserMedia(constraints);
    if(!constraints?.audio||!window.AudioContext)return captured;
    const audioContext=new window.AudioContext();
    await audioContext.resume();
    const oscillator=audioContext.createOscillator();
    oscillator.type="sine";
    oscillator.frequency.value=440;
    const gain=audioContext.createGain();
    gain.gain.value=0.04;
    const destination=audioContext.createMediaStreamDestination();
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start();
    audioContexts.push({audioContext,oscillator,gain});
    captured.getTracks().forEach(track=>track.stop());
    return destination.stream;
   };
  }
 });
 return c;
}
async function createAgent(adminPage,tag,letter){
 const username="e2eagent"+letter+tag;
 const r=await adminPage.evaluate(async x=>{const r=await fetch("/api/admin/support-agents",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(x)});return {status:r.status,data:await r.json()};},{
  username,email:"naxa-agent-"+letter+"-"+tag+"@example.com",first_name:"E2E",last_name:"Agent"+letter,
  date_of_birth:"1990-01-01",permissions:["queue_view","ticket_view_assigned","ticket_reply","ticket_internal_note","audio_call"],
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
 const presenceResponsePromise=p.waitForResponse(r=>r.url().endsWith("/api/support-agent/presence")&&r.request().method()==="PATCH",{timeout:15000});
 await p.getByRole("button",{name:"Me rendre disponible"}).click();
 const presenceResponse=await presenceResponsePromise;
 assert.equal(presenceResponse.status(),200,"L’API doit confirmer le passage en disponibilité.");
 const presenceProof=await admin.from("support_agents").select("presence,status").eq("user_id",agent.id).single();
 if(presenceProof.error)throw presenceProof.error;
 assert.equal(presenceProof.data.status,"active");
 assert.equal(presenceProof.data.presence,"available","La présence doit être persistée avant de poursuivre la recette.");
 await p.getByRole("button",{name:"Passer indisponible"}).waitFor({timeout:20000});
 console.log("PASS — login Agent "+letter+", rotation initiale et présence disponible.");return {context:c,page:p,email:agent.email,password:next};
}
async function waitForCallHeartbeat(callId,column,label,timeoutMs=15000){
 const deadline=Date.now()+timeoutMs;
 let lastValue=null;
 while(Date.now()<deadline){
  const {data,error}=await admin.from("support_calls").select(column).eq("id",callId).maybeSingle();
  if(error)throw error;
  lastValue=data?.[column]??null;
  if(lastValue)return lastValue;
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw new Error(label+" non persisté après "+timeoutMs+" ms (valeur finale : "+String(lastValue)+").");
}
async function rtcAudioProof(page,label){
 await page.waitForFunction(()=>Array.isArray(window.__naxaE2EPeerConnections)&&window.__naxaE2EPeerConnections.length>0,
  null,{timeout:10000});
 await page.waitForFunction(()=>{
  const peers=window.__naxaE2EPeerConnections||[];
  const pc=peers[peers.length-1];
  return !pc||["connected","failed","closed"].includes(pc.connectionState)
    ||["connected","completed","failed","closed"].includes(pc.iceConnectionState);
 },null,{timeout:30000}).catch(()=>undefined);
 const proof=await page.evaluate(async()=>{
  const peers=window.__naxaE2EPeerConnections||[];
  const pc=peers[peers.length-1];
  if(!pc)return {error:"RTCPeerConnection absent"};
  const report=await pc.getStats();
  const rows=Array.from(report.values());
  const isAudio=stat=>stat.kind==="audio"||stat.mediaType==="audio";
  const inbound=rows.filter(stat=>stat.type==="inbound-rtp"&&isAudio(stat));
  const outbound=rows.filter(stat=>stat.type==="outbound-rtp"&&isAudio(stat));
  const transport=rows.find(stat=>stat.type==="transport"&&stat.selectedCandidatePairId);
  const pair=(transport&&report.get(transport.selectedCandidatePairId))
   ||rows.find(stat=>stat.type==="candidate-pair"&&stat.state==="succeeded"&&stat.nominated);
  const local=pair&&report.get(pair.localCandidateId);
  const remote=pair&&report.get(pair.remoteCandidateId);
  const audio=document.querySelector('section[aria-label="Appel audio NAXA"] audio');
  const remoteTracks=audio?.srcObject?.getAudioTracks?.()??[];
  const candidateTypes=rows.filter(stat=>stat.type==="local-candidate"||stat.type==="remote-candidate")
   .map(stat=>({type:stat.type,candidateType:stat.candidateType,protocol:stat.protocol}));
  return {
   connectionState:pc.connectionState,
   iceConnectionState:pc.iceConnectionState,
   iceGatheringState:pc.iceGatheringState,
   signalingState:pc.signalingState,
   senders:pc.getSenders().filter(sender=>sender.track?.kind==="audio"&&sender.track.readyState==="live").length,
   receivers:pc.getReceivers().filter(receiver=>receiver.track?.kind==="audio"&&receiver.track.readyState==="live").length,
   outboundPackets:outbound.reduce((sum,stat)=>sum+(stat.packetsSent||0),0),
   inboundPackets:inbound.reduce((sum,stat)=>sum+(stat.packetsReceived||0),0),
   localCandidateType:local?.candidateType??null,
   remoteCandidateType:remote?.candidateType??null,
   selectedPairState:pair?.state??null,
   localProtocol:local?.protocol??null,
   remoteProtocol:remote?.protocol??null,
   candidateTypes,
   remoteAudioTracks:remoteTracks.length,
   remoteAudioTrackStates:remoteTracks.map(track=>track.readyState),
   remoteAudioReadyState:audio?.readyState??0,
   remoteAudioPaused:audio?.paused??true,
   audioContextStates:(window.__naxaE2EAudioContexts||[]).map(item=>item.audioContext?.state??"unknown"),
  };
 });
 console.log("TRACE — diagnostic WebRTC "+label+" "+JSON.stringify(proof));
 assert.ok(!proof.error,label+" : "+JSON.stringify(proof));
 assert.equal(proof.connectionState,"connected",label+" : RTCPeerConnection doit être connecté : "+JSON.stringify(proof));
 assert.ok(["connected","completed"].includes(proof.iceConnectionState),label+" : ICE doit être connecté : "+JSON.stringify(proof));
 await page.waitForFunction(()=>{
  const peers=window.__naxaE2EPeerConnections||[];
  const pc=peers[peers.length-1];
  if(!pc||pc.connectionState!=="connected")return false;
  return pc.getSenders().some(sender=>sender.track?.kind==="audio"&&sender.track.readyState==="live")
   &&pc.getReceivers().some(receiver=>receiver.track?.kind==="audio"&&receiver.track.readyState==="live");
 },null,{timeout:10000});
 const withPackets=await page.waitForFunction(async()=>{
  const peers=window.__naxaE2EPeerConnections||[];
  const pc=peers[peers.length-1];
  if(!pc||pc.connectionState!=="connected")return false;
  const rows=Array.from((await pc.getStats()).values());
  const isAudio=stat=>stat.kind==="audio"||stat.mediaType==="audio";
  const inbound=rows.filter(stat=>stat.type==="inbound-rtp"&&isAudio(stat));
  const outbound=rows.filter(stat=>stat.type==="outbound-rtp"&&isAudio(stat));
  return inbound.reduce((sum,stat)=>sum+(stat.packetsReceived||0),0)>0
   &&outbound.reduce((sum,stat)=>sum+(stat.packetsSent||0),0)>0;
 },null,{timeout:15000}).then(()=>true).catch(()=>false);
 const finalProof=await page.evaluate(async()=>{
  const peers=window.__naxaE2EPeerConnections||[];
  const pc=peers[peers.length-1];
  const report=await pc.getStats();
  const rows=Array.from(report.values());
  const isAudio=stat=>stat.kind==="audio"||stat.mediaType==="audio";
  const inbound=rows.filter(stat=>stat.type==="inbound-rtp"&&isAudio(stat));
  const outbound=rows.filter(stat=>stat.type==="outbound-rtp"&&isAudio(stat));
  const transport=rows.find(stat=>stat.type==="transport"&&stat.selectedCandidatePairId);
  const pair=(transport&&report.get(transport.selectedCandidatePairId))
   ||rows.find(stat=>stat.type==="candidate-pair"&&stat.state==="succeeded"&&stat.nominated);
  const local=pair&&report.get(pair.localCandidateId);
  const remote=pair&&report.get(pair.remoteCandidateId);
  const audio=document.querySelector('section[aria-label="Appel audio NAXA"] audio');
  const remoteTracks=audio?.srcObject?.getAudioTracks?.()??[];
  return {
   connectionState:pc.connectionState,
   iceConnectionState:pc.iceConnectionState,
   senders:pc.getSenders().filter(sender=>sender.track?.kind==="audio"&&sender.track.readyState==="live").length,
   receivers:pc.getReceivers().filter(receiver=>receiver.track?.kind==="audio"&&receiver.track.readyState==="live").length,
   outboundPackets:outbound.reduce((sum,stat)=>sum+(stat.packetsSent||0),0),
   inboundPackets:inbound.reduce((sum,stat)=>sum+(stat.packetsReceived||0),0),
   localCandidateType:local?.candidateType??null,
   remoteCandidateType:remote?.candidateType??null,
   selectedPairState:pair?.state??null,
   remoteAudioTracks:remoteTracks.length,
   remoteAudioTrackStates:remoteTracks.map(track=>track.readyState),
   remoteAudioReadyState:audio?.readyState??0,
   remoteAudioPaused:audio?.paused??true,
  };
 });
 console.log("TRACE — preuve finale WebRTC "+label+" "+JSON.stringify(finalProof));
 assert.ok(withPackets,label+" : aucun paquet RTP audio dans les deux sens : "+JSON.stringify(finalProof));
 assert.ok(finalProof.senders>0,label+" : aucune piste audio sortante : "+JSON.stringify(finalProof));
 assert.ok(finalProof.receivers>0,label+" : aucune piste audio entrante : "+JSON.stringify(finalProof));
 assert.ok(finalProof.outboundPackets>0,label+" : aucun paquet audio RTP sortant : "+JSON.stringify(finalProof));
 assert.ok(finalProof.inboundPackets>0,label+" : aucun paquet audio RTP entrant : "+JSON.stringify(finalProof));
 assert.equal(finalProof.localCandidateType,"relay",label+" : candidat local non TURN : "+JSON.stringify(finalProof));
 assert.equal(finalProof.remoteCandidateType,"relay",label+" : candidat distant non TURN : "+JSON.stringify(finalProof));
 assert.ok(finalProof.remoteAudioTracks>0,label+" : aucun flux audio distant attaché : "+JSON.stringify(finalProof));
 assert.ok(finalProof.remoteAudioTrackStates.includes("live"),label+" : piste audio distante non vivante : "+JSON.stringify(finalProof));
 assert.ok(finalProof.remoteAudioReadyState>=2,label+" : le lecteur audio n'a pas reçu de trames : "+JSON.stringify(finalProof));
 assert.equal(finalProof.remoteAudioPaused,false,label+" : lecture audio distante suspendue : "+JSON.stringify(finalProof));
 await page.getByText("Connecté",{exact:true}).waitFor({timeout:5000});
 console.log("PASS — WebRTC "+label+" : TURN relay, pistes audio bidirectionnelles et RTP confirmé.");
 return finalProof;
}
async function createTicket(client,subject){
 const r=await client.rpc("open_naxa_support_ticket",{p_categorie:"technique",p_sujet:subject,p_message:"Demande E2E "+subject});if(r.error)throw r.error;
 const row=Array.isArray(r.data)?r.data[0]:r.data;assert.ok(row.ticket_id);state.tickets.push(row.ticket_id);save();return row.ticket_id;
}
async function run(){
 let browser,adminContext,clientContext,queueClientContext,a,b,callId=null,clientPage=null,queueClientPage=null;
 try{
  const [clientSession,adminSession]=await Promise.all([sessionFor("naxa_e2e_acheteur","client"),sessionFor("e2e_admin_261104","admin")]);
  const client=createClient(SUPABASE_URL,ANON,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {error:clientSessionError}=await client.auth.setSession({access_token:clientSession.accessToken,refresh_token:clientSession.refreshToken});
  if(clientSessionError)throw clientSessionError;
  const {data:clientAuth,error:clientAuthError}=await client.auth.getUser();
  if(clientAuthError)throw clientAuthError;
  assert.equal(clientAuth.user.id,clientSession.profile.id,"Client E2E doit être authentifié avec son propre JWT.");
  browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream","--autoplay-policy=no-user-gesture-required"]});
  adminContext=await contextFor(browser,adminSession);const adminPage=await adminContext.newPage();
  await adminPage.goto(BASE+"/admin/support-agents");await adminPage.getByRole("heading",{name:"Agents du service client"}).waitFor({timeout:30000});
  const tag=Date.now().toString(36);
  const agentA=await createAgent(adminPage,tag,"a");const agentB=await createAgent(adminPage,tag,"b");
  const ticketA=await createTicket(client,"E2E Agent A "+tag);
  const ticketB=await createTicket(client,"E2E Agent B "+tag);
  const ticketRace=await createTicket(client,"E2E Agent Race "+tag);
  const ticketQueue=await createTicket(client,"E2E Agent Central Queue "+tag);
  a=await loginAgent(browser,agentA,"A");b=await loginAgent(browser,agentB,"B");
  const cardA=a.page.locator("article").filter({hasText:"E2E Agent A "+tag}).first();
  await cardA.getByRole("button",{name:"Prendre ce dossier"}).click();
  await cardA.getByRole("link",{name:"Ouvrir le dossier"}).waitFor({timeout:20000});
  const cardB=b.page.locator("article").filter({hasText:"E2E Agent B "+tag}).first();
  await cardB.getByRole("button",{name:"Prendre ce dossier"}).click();
  await cardB.getByRole("link",{name:"Ouvrir le dossier"}).waitFor({timeout:20000});
  console.log("PASS — chaque Agent prend son dossier depuis la file.");

  // Demande d'appel réelle depuis l'espace Client, puis refus des participants non prioritaires.
  clientContext=await contextFor(browser,clientSession);
  clientPage=await clientContext.newPage();
  clientPage.on("close",()=>console.log("TRACE — client assigned-call page closed"));
  clientPage.on("crash",()=>console.log("TRACE — client assigned-call page crashed"));
  clientPage.on("framenavigated",frame=>{
   if(frame===clientPage.mainFrame())console.log("TRACE — client main frame navigated "+frame.url());
  });
  clientPage.on("pageerror",error=>console.log("BROWSER PAGEERROR — "+error.message));
  clientPage.on("console",message=>{if(message.type()==="error")console.log("BROWSER CONSOLE ERROR — "+message.text());});
  clientPage.on("requestfailed",request=>console.log("BROWSER REQUEST FAILED — "+request.method()+" "+request.url()+" :: "+(request.failure()?.errorText??"unknown")));
  clientContext.on("close",()=>console.log("TRACE — assigned-call browser context closed"));
  await clientPage.goto(BASE+"/assistance?ticket="+encodeURIComponent(ticketA));
  await clientPage.getByRole("heading",{name:"E2E Agent A "+tag}).waitFor({timeout:20000});
  const requestResponsePromise=clientPage.waitForResponse(r=>
   r.url().endsWith("/api/support/calls")&&r.request().method()==="POST",
   {timeout:20000}
  );
  await clientPage.getByRole("button",{name:"Demander un appel audio"}).click();
  const requestResponse=await requestResponsePromise;
  const requestData=await requestResponse.json();
  assert.equal(requestResponse.status(),201,JSON.stringify(requestData));
  callId=requestData.call.id;
  assert.equal(requestData.call.status,"ringing");
  assert.equal(requestData.call.agent_user_id,agentA.id,"L'Agent affecté doit être appelé en premier.");
  state.calls.push({id:callId,requesterId:clientSession.profile.id});save();
  await clientPage.getByText("Agent appelé",{exact:true}).waitFor({timeout:10000});
  console.log("PASS — interface Client rend immédiatement l’état ringing après la demande.");
  await waitForCallHeartbeat(callId,"requester_heartbeat_at","Heartbeat automatique du Client");
  console.log("PASS — heartbeat automatique Client persisté dans support_calls.");

  const foreignHeartbeat=await b.page.evaluate(async id=>
   (await fetch("/api/support/calls/"+id+"/heartbeat",{method:"POST"})).status,callId);
  assert.equal(foreignHeartbeat,403,"Un Agent non participant ne doit pas prolonger la session audio.");
  const earlyQueueAccept=await b.page.evaluate(async id=>{
   const r=await fetch("/api/support/calls/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"accept"})});
   return r.status;
  },callId);
  assert.equal(earlyQueueAccept,409,"La file centrale ne doit pas contourner les 20 secondes de priorité.");

  await a.page.getByRole("button",{name:"Accepter l’appel"}).waitFor({timeout:20000});
  clientPage.on("request",request=>{
   if(request.url().includes("/api/support/calls/"+callId)&&request.method()==="GET")
    console.log("TRACE — requester call-state GET "+request.url());
  });
  clientPage.on("response",async response=>{
   if(response.url().includes("/api/support/calls/"+callId)&&response.request().method()==="GET"){
    let payload=null;
    try{payload=await response.json();}catch{}
    console.log("TRACE — requester call-state response "+response.status()+" "+response.url()+" body="+JSON.stringify(payload?.call?{status:payload.call.status,agent_user_id:payload.call.agent_user_id}:payload));
   }
  });
  await a.page.getByRole("button",{name:"Accepter l’appel"}).click();
  await a.page.waitForURL(u=>u.pathname==="/equipe-support/dossiers/"+ticketA&&u.searchParams.get("callId")===callId,{timeout:20000});
  await waitForCallHeartbeat(callId,"agent_heartbeat_at","Heartbeat automatique de l’Agent");
  await a.page.getByRole("heading",{name:"Appel audio NAXA"}).waitFor({timeout:10000});
  const callProof=await admin.from("support_calls")
   .select("status,requester_user_id,agent_user_id,requester_heartbeat_at,agent_heartbeat_at")
   .eq("id",callId).single();
  if(callProof.error)throw callProof.error;
  assert.equal(callProof.data.status,"accepted");
  assert.equal(callProof.data.requester_user_id,clientSession.profile.id);
  assert.equal(callProof.data.agent_user_id,agentA.id);
  assert.ok(callProof.data.requester_heartbeat_at);
  assert.ok(callProof.data.agent_heartbeat_at);
  console.log("PASS — appel Client→Agent affecté, acceptation atomique, refus inter-Agent et deux heartbeats.");
  const requesterStateResult=await clientPage.evaluate(async id=>{
   const response=await fetch("/api/support/calls/"+encodeURIComponent(id),{cache:"no-store"});
   return {status:response.status,data:await response.json()};
  },callId);
  assert.equal(requesterStateResult.status,200,"Le Client doit pouvoir lire l’état de son appel : "+JSON.stringify(requesterStateResult.data));
  assert.equal(requesterStateResult.data.call?.status,"accepted","L’API de lecture doit exposer l’acceptation au demandeur.");
  console.log("PASS — API Client GET explicite : statut accepted confirmé.");
  try{
   await clientPage.waitForFunction(()=>{
    const section=document.querySelector('section[aria-label="Appel audio NAXA"]');
    return !!section&&section.innerText.includes("Appel en cours");
   },null,{timeout:15000});
  }catch(cause){
   const rendered=await clientPage.locator('section[aria-label="Appel audio NAXA"]').innerText().catch(()=>" <section absente>");
   throw new Error("L’API Client expose accepted mais l’interface ne reflète pas cet état. DOM rendu : "+rendered+"; cause : "+(cause instanceof Error?cause.message:String(cause)));
  }
  await clientPage.getByRole("button",{name:"Raccrocher",exact:true}).waitFor({timeout:15000});
  console.log("PASS — interface Client : état accepté et commande Raccrocher rendus.");
  const [clientRtcProof,agentRtcProof]=await Promise.all([
   rtcAudioProof(clientPage,"Client demandeur"),
   rtcAudioProof(a.page,"Agent affecté")
  ]);
  assert.equal(clientRtcProof.localCandidateType,"relay");
  assert.equal(agentRtcProof.localCandidateType,"relay");
  console.log("PASS GLOBAL — audio WebRTC bidirectionnel via TURN, les deux pairs envoient et reçoivent des paquets RTP.");
  const requesterEndPromise=clientPage.waitForResponse(r=>
   r.url().endsWith("/api/support/calls/"+callId)&&r.request().method()==="PATCH",
   {timeout:20000}
  );
  await clientPage.getByRole("button",{name:"Raccrocher"}).click();
  const requesterEnd=await requesterEndPromise;
  assert.equal(requesterEnd.status(),200,"Le demandeur doit pouvoir raccrocher l'appel actif.");
  const endedAssignedCall=await admin.from("support_calls").select("status,ended_at")
   .eq("id",callId).single();
  if(endedAssignedCall.error)throw endedAssignedCall.error;
  assert.equal(endedAssignedCall.data.status,"completed");
  assert.ok(endedAssignedCall.data.ended_at);
  console.log("PASS — raccrochage Client, libération de l'unicité un appel actif par demandeur.");


  // Second appel dans un contexte navigateur isolé pour ne pas réutiliser la page WebRTC précédente.
  queueClientContext=await contextFor(browser,clientSession);
  queueClientPage=await queueClientContext.newPage();
  queueClientPage.on("close",()=>console.log("TRACE — central-queue client page closed"));
  queueClientPage.on("crash",()=>console.log("TRACE — central-queue client page crashed"));
  queueClientContext.on("close",()=>console.log("TRACE — central-queue client context closed"));
  assert.equal(queueClientPage.isClosed(),false);
  await queueClientPage.goto(BASE+"/assistance?ticket="+encodeURIComponent(ticketQueue));
  await queueClientPage.getByRole("heading",{name:"E2E Agent Central Queue "+tag}).waitFor({timeout:20000});
  assert.equal(queueClientPage.isClosed(),false,"La page Client centrale doit rester ouverte après le chargement du dossier.");
  const queuedRequestPromise=queueClientPage.waitForResponse(r=>
   r.url().endsWith("/api/support/calls")&&r.request().method()==="POST",
   {timeout:20000}
  ).then(response=>({response}),error=>({error}));
  await queueClientPage.getByRole("button",{name:"Demander un appel audio"}).click();
  const queuedRequestResult=await queuedRequestPromise;
  if(queuedRequestResult.error) throw queuedRequestResult.error;
  const queuedResponse=queuedRequestResult.response;
  const queuedData=await queuedResponse.json();
  assert.equal(queuedResponse.status(),201,JSON.stringify(queuedData));
  const queueCallId=queuedData.call.id;
  assert.equal(queuedData.call.status,"queued");
  assert.equal(queuedData.call.agent_user_id,null);
  state.calls.push({id:queueCallId,requesterId:clientSession.profile.id});save();
  await waitForCallHeartbeat(queueCallId,"requester_heartbeat_at","Heartbeat automatique du Client en file centrale");
  await b.page.getByRole("button",{name:"Accepter l’appel"}).waitFor({timeout:20000});
  await b.page.getByRole("button",{name:"Accepter l’appel"}).click();
  await b.page.waitForURL(u=>u.pathname==="/equipe-support/dossiers/"+ticketQueue&&u.searchParams.get("callId")===queueCallId,{timeout:20000});
  await waitForCallHeartbeat(queueCallId,"agent_heartbeat_at","Heartbeat automatique de l’Agent en file centrale");
  const queueProof=await admin.from("support_calls")
   .select("status,agent_user_id,requester_heartbeat_at,agent_heartbeat_at")
   .eq("id",queueCallId).single();
  if(queueProof.error)throw queueProof.error;
  assert.equal(queueProof.data.status,"accepted");
  assert.equal(queueProof.data.agent_user_id,agentB.id);
  assert.ok(queueProof.data.requester_heartbeat_at&&queueProof.data.agent_heartbeat_at);
  const finishQueuedCall=await queueClientPage.evaluate(async id=>{
   const r=await fetch("/api/support/calls/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"end"})});
   return {status:r.status,data:await r.json()};
  },queueCallId);
  assert.equal(finishQueuedCall.status,200,JSON.stringify(finishQueuedCall.data));
  console.log("PASS — file centrale : demande queued visible, acceptation Agent autorisé, heartbeats et clôture.");

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
  const internalToggle=a.page.getByLabel("Ajouter une note interne (invisible au demandeur)");
  await internalToggle.uncheck();
  assert.equal(await internalToggle.isChecked(),false,"Le formulaire doit quitter le mode note interne.");
  await a.page.getByPlaceholder("Votre réponse au demandeur…").fill(reply);
  const replyResponsePromise=a.page.waitForResponse(r=>r.url().endsWith("/api/support-agent/ticket")&&r.request().method()==="POST");
  await a.page.getByRole("button",{name:"Envoyer la réponse"}).click();
  const replyResponse=await replyResponsePromise;
  console.log("TRACE POST réponse Agent — HTTP "+replyResponse.status());
  assert.equal(replyResponse.status(),201,"La réponse publique doit être enregistrée par l'API.");
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

  // Cas 1 : suspension pendant un appel effectivement accepté doit terminer la session.
  const suspensionTicket=await createTicket(client,"E2E Agent suspension accepted "+tag);
  const suspensionAssignment=await admin.rpc("support_agent_claim_ticket",{p_agent_user_id:agentA.id,p_ticket_id:suspensionTicket});
  if(suspensionAssignment.error)throw suspensionAssignment.error;
  await clientPage.goto(BASE+"/assistance?ticket="+encodeURIComponent(suspensionTicket));
  await clientPage.getByRole("heading",{name:"E2E Agent suspension accepted "+tag}).waitFor({timeout:20000});
  const suspensionRequestPromise=clientPage.waitForResponse(r=>
   r.url().endsWith("/api/support/calls")&&r.request().method()==="POST",
   {timeout:20000}
  );
  await clientPage.getByRole("button",{name:"Demander un appel audio"}).click();
  const suspensionRequest=await suspensionRequestPromise;
  const suspensionRequestData=await suspensionRequest.json();
  assert.equal(suspensionRequest.status(),201,JSON.stringify(suspensionRequestData));
  const suspensionCallId=suspensionRequestData.call.id;
  state.calls.push({id:suspensionCallId,requesterId:clientSession.profile.id});save();
  assert.equal(suspensionRequestData.call.status,"ringing");
  assert.equal(suspensionRequestData.call.agent_user_id,agentA.id);
  await waitForCallHeartbeat(suspensionCallId,"requester_heartbeat_at","Heartbeat Client avant suspension");

  const suspensionAccept=await a.page.evaluate(async id=>{
   const response=await fetch("/api/support/calls/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"accept"})});
   return {status:response.status,data:await response.json()};
  },suspensionCallId);
  assert.equal(suspensionAccept.status,200,JSON.stringify(suspensionAccept.data));
  const suspensionAgentHeartbeat=await a.page.evaluate(async id=>
   (await fetch("/api/support/calls/"+id+"/heartbeat",{method:"POST"})).status,suspensionCallId);
  assert.equal(suspensionAgentHeartbeat,200,"L'Agent doit être participant actif avant sa suspension.");
  const activeCallProof=await admin.from("support_calls")
   .select("status,agent_user_id,requester_user_id,accepted_at,ended_at")
   .eq("id",suspensionCallId).single();
  if(activeCallProof.error)throw activeCallProof.error;
  assert.equal(activeCallProof.data.status,"accepted","Précondition impérative : appel réellement accepté avant suspension.");
  assert.equal(activeCallProof.data.agent_user_id,agentA.id);
  assert.equal(activeCallProof.data.requester_user_id,clientSession.profile.id);
  assert.ok(activeCallProof.data.accepted_at);
  assert.equal(activeCallProof.data.ended_at,null);

  const suspended=await admin.rpc("support_agent_admin_update",{p_agent_user_id:agentA.id,p_actor_user_id:adminProfile.id,p_status:"suspended",p_presence:"unavailable",p_permissions:null});
  if(suspended.error)throw suspended.error;
  const endedCall=await admin.from("support_calls")
   .select("status,end_reason,ended_at,agent_user_id")
   .eq("id",suspensionCallId).single();
  if(endedCall.error)throw endedCall.error;
  assert.equal(endedCall.data.status,"failed","La suspension de l'Agent doit terminer l'appel qui était accepted.");
  assert.equal(endedCall.data.end_reason,"agent_status_suspended");
  assert.ok(endedCall.data.ended_at);
  console.log("PASS — suspension Agent : appel accepted terminé avec agent_status_suspended.");
  const sessionStatus=await a.page.evaluate(async()=>(await fetch("/api/support-agent/session")).status);
  assert.equal(sessionStatus,403);
  const [{data:ticketState,error:te},{data:suspensionAssignmentState,error:ase}]=await Promise.all([
   admin.from("tickets_support").select("statut").eq("id",ticketA).single(),
   admin.from("support_ticket_assignments").select("released_at,release_reason")
    .eq("ticket_id",suspensionTicket).eq("agent_user_id",agentA.id).single()
  ]);
  if(te)throw te;if(ase)throw ase;
  assert.equal(ticketState.statut,"ouvert");
  assert.ok(suspensionAssignmentState.released_at);
  assert.equal(suspensionAssignmentState.release_reason,"agent_suspended");
  console.log("PASS — suspension révoque la session Agent et libère ses affectations.");

  const reassign=await admin.rpc("support_agent_claim_ticket",{p_agent_user_id:agentB.id,p_ticket_id:ticketA});
  if(reassign.error)throw reassign.error;
  const reactivate=await admin.rpc("support_agent_admin_update",{p_agent_user_id:agentA.id,p_actor_user_id:adminProfile.id,p_status:"active",p_presence:"available",p_permissions:["queue_view","ticket_view_assigned","ticket_reply","ticket_internal_note","audio_call"]});
  if(reactivate.error)throw reactivate.error;
  const reactivated=await a.page.evaluate(async()=>(await fetch("/api/support-agent/session")).status);
  assert.equal(reactivated,200);
  console.log("PASS — réactivation Agent A et restauration contrôlée de ses permissions.");

  // Cas 2 : suspension pendant la sonnerie doit retirer l'Agent et remettre l'appel en file centrale.
  const ringingSuspensionTicket=await createTicket(client,"E2E Agent suspension ringing "+tag);
  const ringingAssignment=await admin.rpc("support_agent_claim_ticket",{p_agent_user_id:agentB.id,p_ticket_id:ringingSuspensionTicket});
  if(ringingAssignment.error)throw ringingAssignment.error;
  await clientPage.goto(BASE+"/assistance?ticket="+encodeURIComponent(ringingSuspensionTicket));
  await clientPage.getByRole("heading",{name:"E2E Agent suspension ringing "+tag}).waitFor({timeout:20000});
  const ringingRequestPromise=clientPage.waitForResponse(r=>
   r.url().endsWith("/api/support/calls")&&r.request().method()==="POST",
   {timeout:20000}
  );
  await clientPage.getByRole("button",{name:"Demander un appel audio"}).click();
  const ringingRequest=await ringingRequestPromise;
  const ringingData=await ringingRequest.json();
  assert.equal(ringingRequest.status(),201,JSON.stringify(ringingData));
  const ringingCallId=ringingData.call.id;
  state.calls.push({id:ringingCallId,requesterId:clientSession.profile.id});save();
  assert.equal(ringingData.call.status,"ringing");
  assert.equal(ringingData.call.agent_user_id,agentB.id);
  const ringingProof=await admin.from("support_calls").select("status,agent_user_id")
   .eq("id",ringingCallId).single();
  if(ringingProof.error)throw ringingProof.error;
  assert.equal(ringingProof.data.status,"ringing");
  assert.equal(ringingProof.data.agent_user_id,agentB.id);

  const suspendRingingAgent=await admin.rpc("support_agent_admin_update",{
   p_agent_user_id:agentB.id,p_actor_user_id:adminProfile.id,p_status:"suspended",p_presence:"unavailable",p_permissions:null
  });
  if(suspendRingingAgent.error)throw suspendRingingAgent.error;
  const requeuedCall=await admin.from("support_calls")
   .select("status,agent_user_id,end_reason,fallback_at,queue_expires_at")
   .eq("id",ringingCallId).single();
  if(requeuedCall.error)throw requeuedCall.error;
  assert.equal(requeuedCall.data.status,"queued","Un appel en sonnerie doit retourner en file centrale à la suspension de son Agent.");
  assert.equal(requeuedCall.data.agent_user_id,null);
  assert.equal(requeuedCall.data.end_reason,"agent_status_suspended");
  assert.ok(requeuedCall.data.fallback_at&&requeuedCall.data.queue_expires_at);
  const bSuspendedSession=await b.page.evaluate(async()=>(await fetch("/api/support-agent/session")).status);
  assert.equal(bSuspendedSession,403);
  const bReactivated=await admin.rpc("support_agent_admin_update",{
   p_agent_user_id:agentB.id,p_actor_user_id:adminProfile.id,p_status:"active",p_presence:"available",
   p_permissions:["queue_view","ticket_view_assigned","ticket_reply","ticket_internal_note","audio_call"]
  });
  if(bReactivated.error)throw bReactivated.error;
  const bSessionAfterReactivate=await b.page.evaluate(async()=>(await fetch("/api/support-agent/session")).status);
  assert.equal(bSessionAfterReactivate,200);
  console.log("PASS — suspension pendant sonnerie : retour en file centrale, Agent B réactivé.");
  console.log("PASS GLOBAL — cycle de vie Agents, appels accepted/ringing, permissions, RLS, Livechat et concurrence."); }finally{
  if(a?.context)await a.context.close().catch(()=>{});if(b?.context)await b.context.close().catch(()=>{});
  if(queueClientContext)await queueClientContext.close().catch(()=>{});if(clientContext)await clientContext.close().catch(()=>{});if(adminContext)await adminContext.close().catch(()=>{});if(browser)await browser.close().catch(()=>{});
  await cleanup();
 }
}
if(process.argv.includes("--cleanup"))cleanup().catch(e=>{console.error(e);process.exitCode=1;});
else run().catch(e=>{console.error(e);process.exitCode=1;});
