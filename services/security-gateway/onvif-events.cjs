"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { validateTarget } = require("./onvif-inspection.cjs");

const KEY_FILE = "camera-streams.key";
const CONFIG_FILE = "onvif-events.enc";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOAP_LIMIT = 32768;
const ACTION_CREATE = "http://www.onvif.org/ver10/events/wsdl/EventPortType/CreatePullPointSubscription";
const ACTION_PULL = "http://www.onvif.org/ver10/events/wsdl/PullPointSubscription/PullMessagesRequest";
const ACTION_UNSUBSCRIBE = "http://docs.oasis-open.org/wsn/bw-2/SubscriptionManager/UnsubscribeRequest";
const PASSWORD_DIGEST_TYPE = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest";
const NONCE_ENCODING = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary";

function isPrivateIpv4(value) {
  if (typeof value !== "string" || !/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) return false;
  const o = value.split(".").map(Number);
  return !o.some((v) => v < 0 || v > 255) &&
    (o[0] === 10 || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
    (o[0] === 192 && o[1] === 168) || (o[0] === 169 && o[1] === 254));
}

function validateSubscriptionEndpoint(value, sourceAddress) {
  if (!isPrivateIpv4(sourceAddress)) throw new TypeError("IPv4 privée requise.");
  let url;
  try { url = new URL(value); } catch { throw new TypeError("Endpoint Pull-Point invalide."); }
  if (!["http:","https:"].includes(url.protocol) || url.username || url.password ||
    url.hash || url.hostname !== sourceAddress || url.href.length > 512 || url.pathname.length > 256) {
    throw new TypeError("SubscriptionReference hors du périmètre caméra.");
  }
  return url;
}

function xmlEscape(value) {
  return String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

function decodeXml(value) {
  return String(value).replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<")
    .replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'")
    .replace(/&#x([0-9a-f]+);/gi,(_,v)=>String.fromCodePoint(parseInt(v,16)))
    .replace(/&#(\d+);/g,(_,v)=>String.fromCodePoint(Number(v)))
    .replace(/[\u0000-\u001f\u007f<>]/g," ").replace(/\s+/g," ").trim();
}

function extractElement(xml, name) {
  const pattern = new RegExp("<(?:(?:[A-Za-z_][\\w.-]*):)?" + name +
    "\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?" + name + "\\s*>","i");
  const match = pattern.exec(xml);
  return match ? match[1] : null;
}

function extractText(xml, name, limit = 240) {
  const inner = extractElement(xml,name);
  return inner === null ? null : decodeXml(inner).slice(0,limit) || null;
}

function privateDir(dir) {
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  if (process.platform !== "win32") fs.chmodSync(dir,0o700);
}
function privateWrite(file,value) {
  const tmp=file+".tmp-"+crypto.randomBytes(6).toString("hex");
  fs.writeFileSync(tmp,value,{encoding:"utf8",mode:0o600,flag:"wx"});
  if (process.platform !== "win32") fs.chmodSync(tmp,0o600);
  fs.renameSync(tmp,file);
}
function localKey(dir) {
  privateDir(dir);
  const file=path.join(dir,KEY_FILE);
  if (fs.existsSync(file)) {
    if (process.platform !== "win32" && (fs.statSync(file).mode & 0o077)!==0) throw new Error("Permissions clé caméra trop ouvertes.");
    const hex=fs.readFileSync(file,"utf8").trim();
    if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error("Clé locale invalide.");
    return Buffer.from(hex,"hex");
  }
  const key=crypto.randomBytes(32);
  privateWrite(file,key.toString("hex")+"\n");
  return key;
}
function validateConfig(item) {
  if (!item || typeof item!=="object" || !UUID.test(String(item.cameraId||"")) ||
    !isPrivateIpv4(item.sourceAddress)) throw new TypeError("Identité caméra ONVIF invalide.");
  const endpoint=validateTarget(item.endpoint,item.sourceAddress);
  const username=typeof item.username==="string"?item.username:"";
  const password=typeof item.password==="string"?item.password:"";
  if (!username || username.length>128 || /[\u0000-\u001f\u007f]/.test(username) ||
    !password || password.length>256 || /[\u0000-\u001f\u007f]/.test(password)) {
    throw new TypeError("Identifiants ONVIF invalides.");
  }
  return {cameraId:item.cameraId,sourceAddress:item.sourceAddress,endpoint:endpoint.href,username,password};
}
function writeOnvifEventConfigs(dir,items) {
  if (!Array.isArray(items)||items.length>64) throw new TypeError("Maximum 64 caméras ONVIF.");
  const normalized=items.map(validateConfig), key=localKey(dir), iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",key,iv);
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(normalized),"utf8"),cipher.final()]);
  privateWrite(path.join(dir,CONFIG_FILE),JSON.stringify({
    version:1,iv:iv.toString("hex"),tag:cipher.getAuthTag().toString("hex"),ciphertext:ciphertext.toString("hex")
  })+"\n");
}
function readOnvifEventConfigs(dir) {
  const file=path.join(dir,CONFIG_FILE);
  if (!fs.existsSync(file)) return [];
  const keyFile=path.join(dir,KEY_FILE);
  if (process.platform!=="win32" && (fs.statSync(file).mode&0o077)!==0) throw new Error("Permissions config ONVIF trop ouvertes.");
  if (!fs.existsSync(keyFile)) throw new Error("Clé ONVIF locale absente.");
  if (process.platform!=="win32" && (fs.statSync(keyFile).mode&0o077)!==0) throw new Error("Permissions clé ONVIF trop ouvertes.");
  const keyHex=fs.readFileSync(keyFile,"utf8").trim(), env=JSON.parse(fs.readFileSync(file,"utf8"));
  if (!/^[0-9a-f]{64}$/.test(keyHex) || env.version!==1 ||
    !/^[0-9a-f]{24}$/.test(env.iv)||!/^[0-9a-f]{32}$/.test(env.tag)||!/^[0-9a-f]+$/.test(env.ciphertext)) {
    throw new Error("Configuration ONVIF chiffrée invalide.");
  }
  const decipher=crypto.createDecipheriv("aes-256-gcm",Buffer.from(keyHex,"hex"),Buffer.from(env.iv,"hex"));
  decipher.setAuthTag(Buffer.from(env.tag,"hex"));
  const plain=Buffer.concat([decipher.update(Buffer.from(env.ciphertext,"hex")),decipher.final()]).toString("utf8");
  const items=JSON.parse(plain);
  if (!Array.isArray(items)||items.length>64) throw new Error("Inventaire ONVIF local invalide.");
  return items.map(validateConfig);
}

function usernameToken(username,password,options={}) {
  const nonce=options.nonce?Buffer.from(options.nonce):crypto.randomBytes(16);
  const created=options.created||new Date().toISOString();
  if (nonce.length<16||nonce.length>32||!Number.isFinite(Date.parse(created))) throw new TypeError("Nonce ou date WS-Security invalide.");
  const digest=crypto.createHash("sha1").update(Buffer.concat([nonce,Buffer.from(created),Buffer.from(password)])).digest("base64");
  return [
    "<wsse:Security s:mustUnderstand=\\"1\\"><wsse:UsernameToken>",
    "<wsse:Username>"+xmlEscape(username)+"</wsse:Username>",
    '<wsse:Password Type="'+PASSWORD_DIGEST_TYPE+'">'+digest+"</wsse:Password>",
    '<wsse:Nonce EncodingType="'+NONCE_ENCODING+'">'+nonce.toString("base64")+"</wsse:Nonce>",
    "<wsu:Created>"+xmlEscape(created)+"</wsu:Created>",
    "</wsse:UsernameToken></wsse:Security>",
  ].join("");
}
function buildSoapEnvelope(options) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://www.w3.org/2005/08/addressing" ',
    'xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" ',
    'xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" ',
    'xmlns:tev="http://www.onvif.org/ver10/events/wsdl" xmlns:wsnt="http://docs.oasis-open.org/wsn/b-2">',
    "<s:Header>",
    '<wsa:Action s:mustUnderstand="1">'+xmlEscape(options.action)+"</wsa:Action>",
    "<wsa:MessageID>urn:uuid:"+crypto.randomUUID()+"</wsa:MessageID>",
    "<wsa:To s:mustUnderstand=\\"1\\">"+xmlEscape(options.to)+"</wsa:To>",
    usernameToken(options.username,options.password,options),
    "</s:Header><s:Body>"+options.body+"</s:Body></s:Envelope>",
  ].join("");
}
async function readBounded(response) {
  const declared=Number(response.headers&&response.headers.get("content-length"));
  if (Number.isFinite(declared)&&declared>SOAP_LIMIT) throw Object.assign(new Error("Réponse SOAP trop volumineuse."),{code:"RESPONSE_TOO_LARGE"});
  const text=await response.text();
  if (Buffer.byteLength(text,"utf8")>SOAP_LIMIT) throw Object.assign(new Error("Réponse SOAP trop volumineuse."),{code:"RESPONSE_TOO_LARGE"});
  return text;
}
async function soapRequest(options) {
  const target=validateSubscriptionEndpoint(options.to,options.sourceAddress);
  const timeout=options.timeoutMs||10000;
  const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout);
  const response=await (options.fetchImpl||fetch)(target.href,{
    method:"POST",
    headers:{
      "Content-Type":'application/soap+xml; charset=utf-8; action="'+options.action+'"',
      "Accept":"application/soap+xml, application/xml, text/xml",
      "Cache-Control":"no-store"
    },
    body:buildSoapEnvelope(options),signal,cache:"no-store",redirect:"error"
  });
  if (response.redirected) throw Object.assign(new Error("Redirection ONVIF refusée."),{code:"REDIRECT_REFUSED"});
  if (response.status===401||response.status===403) throw Object.assign(new Error("Authentification ONVIF requise ou refusée."),{code:"CREDENTIALS_REQUIRED"});
  if (!response.ok) throw Object.assign(new Error("Service ONVIF indisponible."),{code:"HTTP_ERROR",status:response.status});
  const xml=await readBounded(response);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)||!/<(?:[A-Za-z_][\w.-]*:)?Envelope(?:\s|>)/i.test(xml)) throw Object.assign(new Error("SOAP invalide."),{code:"INVALID_SOAP"});
  if (/<(?:[A-Za-z_][\w.-]*:)?Fault(?:\s|>)/i.test(xml)) throw Object.assign(new Error("Fault ONVIF."),{code:"SOAP_FAULT"});
  return xml;
}
function subscriptionAddress(xml,sourceAddress) {
  const ref=extractElement(xml,"SubscriptionReference");
  const address=ref&&extractText(ref,"Address",512);
  if (!address) throw new Error("SubscriptionReference absent.");
  return validateSubscriptionEndpoint(address,sourceAddress).href;
}
async function createPullPointSubscription(options) {
  const endpoint=validateTarget(options.endpoint,options.sourceAddress);
  const body="<tev:CreatePullPointSubscription><tev:InitialTerminationTime>PT10M</tev:InitialTerminationTime></tev:CreatePullPointSubscription>";
  const xml=await soapRequest({...options,to:endpoint.href,action:ACTION_CREATE,body});
  return {endpoint:subscriptionAddress(xml,options.sourceAddress)};
}
function attrs(tag) {
  const out={}, re=/([A-Za-z_:][\w:.-]*)\s*=\s*(["'])(.*?)\2/g;
  let match;
  while ((match=re.exec(tag))) out[match[1].split(":").pop()]=decodeXml(match[3]);
  return out;
}
function eventTypeFor(topic,items) {
  const t=String(topic||"").toLowerCase().replace(/[^a-z0-9]+/g,"");
  const values=Object.fromEntries(items.map((i)=>[i.name.toLowerCase(),i.value.toLowerCase()]));
  const motion=values.ismotion||values.motion||values.state;
  if (t.includes("motion")||t.includes("cellmotion")) return ["false","0","off","inactive"].includes(motion)?null:"motion";
  if (t.includes("linecross")||t.includes("tripwire")||t.includes("fence")) return "line_crossing";
  if (t.includes("tamper")||t.includes("vandal")||t.includes("sabotage")) return "camera_tamper";
  if (t.includes("obstruct")||t.includes("cover")||t.includes("blocked")) return "camera_obstructed";
  if (t.includes("videoloss")||t.includes("signalloss")||t.includes("disconnect")) return "signal_lost";
  if (t.includes("intrusion")||t.includes("persondetected")) return "intrusion";
  if (t.includes("afterhours")||t.includes("presence")) return "after_hours_presence";
  return "other";
}
function parseNotificationMessages(xml) {
  if (typeof xml!=="string"||Buffer.byteLength(xml,"utf8")>SOAP_LIMIT||/<!DOCTYPE|<!ENTITY/i.test(xml)||!/<(?:[A-Za-z_][\w.-]*:)?Envelope(?:\s|>)/i.test(xml)) {
    throw new TypeError("Notification ONVIF invalide ou trop volumineuse.");
  }
  const result=[], re=/<(?:(?:[A-Za-z_][\w.-]*):)?NotificationMessage\b[^>]*>([\s\S]*?)<\/(?:(?:[A-Za-z_][\w.-]*):)?NotificationMessage\s*>/gi;
  let match;
  while ((match=re.exec(xml))) {
    const block=match[1], topic=extractText(block,"Topic",200)||"unknown";
    const message=extractElement(block,"Message")||block;
    const tag=/<(?:[A-Za-z_][\w.-]*:)?Message\b([^>]*)>/i.exec(block);
    const messageAttrs=attrs("<Message "+(tag?tag[1]:"")+">");
    const items=[], itemRe=/<(?:(?:[A-Za-z_][\w.-]*):)?SimpleItem\b([^>]*)\/?>/gi;
    let item;
    while ((item=itemRe.exec(message))) {
      const a=attrs("<SimpleItem "+item[1]+">");
      if (a.Name&&a.Value!==undefined) items.push({name:a.Name.slice(0,80),value:a.Value.slice(0,120)});
    }
    const eventType=eventTypeFor(topic,items);
    if (!eventType) continue;
    const time=messageAttrs.UtcTime||extractText(message,"UtcTime",80);
    const parsed=time?Date.parse(time):NaN;
    const detectedAt=Number.isFinite(parsed)&&parsed>=Date.now()-7*86400000&&parsed<=Date.now()+120000
      ?new Date(parsed).toISOString():new Date().toISOString();
    const summaries={
      motion:"Mouvement signalé par la caméra ONVIF.",
      intrusion:"Événement d’intrusion signalé par la caméra ONVIF.",
      line_crossing:"Franchissement de ligne signalé par la caméra ONVIF.",
      camera_tamper:"Signal de sabotage caméra reçu via ONVIF.",
      camera_obstructed:"Obstruction caméra signalée via ONVIF.",
      signal_lost:"Perte de signal signalée par la caméra ONVIF.",
      after_hours_presence:"Présence hors horaires signalée par la caméra ONVIF.",
      other:"Événement ONVIF reçu."
    };
    result.push({
      eventType,sourceType:"onvif",summary:summaries[eventType],confidence:null,detectedAt,
      metadata:{event_code:topic.replace(/[\u0000-\u001f\u007f]/g," ").slice(0,120)||"unknown"}
    });
    if (result.length>=32) break;
  }
  return result;
}
async function pullMessages(options) {
  const target=validateSubscriptionEndpoint(options.subscriptionEndpoint,options.sourceAddress);
  const body="<tev:PullMessages><tev:Timeout>PT5S</tev:Timeout><tev:MessageLimit>10</tev:MessageLimit></tev:PullMessages>";
  const xml=await soapRequest({...options,to:target.href,action:ACTION_PULL,body,timeoutMs:10000});
  return parseNotificationMessages(xml);
}
async function unsubscribePullPoint(options) {
  const target=validateSubscriptionEndpoint(options.subscriptionEndpoint,options.sourceAddress);
  return soapRequest({...options,to:target.href,action:ACTION_UNSUBSCRIBE,body:"<wsnt:Unsubscribe/>",signal:undefined,timeoutMs:3000});
}
async function runPullPointCollector(options) {
  if (typeof options.onEvent!=="function") throw new TypeError("onEvent doit être une fonction.");
  const config=validateEventConfig(options);
  let subscription=null;
  try {
    subscription=await createPullPointSubscription({...config,fetchImpl:options.fetchImpl,signal:options.signal});
    // Recréer le pull-point avant son expiration évite de dépendre d'une durée annoncée par le modèle.
    const renewAt=Date.now()+8*60*1000;
    while (!options.signal||!options.signal.aborted) {
      if (Date.now()>=renewAt) break;
      const events=await pullMessages({
        ...config,subscriptionEndpoint:subscription.endpoint,
        fetchImpl:options.fetchImpl,signal:options.signal
      });
      for (const event of events) {
        if (options.signal&&options.signal.aborted) break;
        await options.onEvent({...event,cameraId:config.cameraId});
      }
    }
  } finally {
    if (subscription) {
      try { await unsubscribePullPoint({...config,subscriptionEndpoint:subscription.endpoint,fetchImpl:options.fetchImpl}); }
      catch {}
    }
  }
}

module.exports={
  SOAP_LIMIT,ACTION_CREATE,ACTION_PULL,ACTION_UNSUBSCRIBE,
  validateSubscriptionEndpoint,buildUsernameToken,buildSoapEnvelope,createPullPointSubscription,
  parseNotificationMessages,pullMessages,unsubscribePullPoint,runPullPointCollector,
  writeOnvifEventConfigs,readOnvifEventConfigs,validateEventConfig
};
