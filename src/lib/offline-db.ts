"use client";

const DB_NAME = "naxa-offline-v1";
const DB_VERSION = 1;
const META = "meta";
const QUEUE = "queue";
const REF = "reference";
export type PendingOperation = { id: string; type: string; payload: unknown; createdAt: number; attempts: number; status: "pending"|"failed" };
type Encrypted = { iv: number[]; cipher: number[] };
type Meta = { id: "device"; salt: number[]; pinHash: number[]; deviceId: string; pharmacyId: string; pharmacyName: string; tokenCipher: Encrypted; lastSync: number; pinFailures?: number; pinBlockedUntil?: number; pinBlockSeconds?: number };
let activeUnlocked: {deviceId:string;pharmacyId:string;pharmacyName:string;token:string;aes:CryptoKey;lastSync:number}|null=null;
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{ const r=indexedDB.open(DB_NAME,DB_VERSION); r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(META))d.createObjectStore(META,{keyPath:"id"});if(!d.objectStoreNames.contains(QUEUE))d.createObjectStore(QUEUE,{keyPath:"id"});if(!d.objectStoreNames.contains(REF))d.createObjectStore(REF,{keyPath:"id"});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
function tx<T>(store:string,mode:IDBTransactionMode,fn:(s:IDBObjectStore)=>IDBRequest<T>):Promise<T>{return openDb().then(d=>new Promise<T>((resolve,reject)=>{const t=d.transaction(store,mode);const r=fn(t.objectStore(store));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);t.oncomplete=()=>d.close();t.onerror=()=>{d.close();reject(t.error)};}));}
async function derive(pin:string,salt:Uint8Array){const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveKey","deriveBits"]);const aes=await crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:310000,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:310000,hash:"SHA-256"},material,256);return {aes,hash:Array.from(new Uint8Array(bits))};}
async function encrypt(key:CryptoKey,value:string):Promise<Encrypted>{const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(value));return {iv:Array.from(iv),cipher:Array.from(new Uint8Array(cipher))};}
async function decrypt(key:CryptoKey,value:Encrypted){const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:new Uint8Array(value.iv)},key,new Uint8Array(value.cipher));return new TextDecoder().decode(plain);}
export async function hasLocalDevice(){try{return Boolean(await tx<Meta|undefined>(META,"readonly",s=>s.get("device")))}catch{return false}}\nexport async function getLocalInstallationId(){let m=await tx<{id:string;value:string}|undefined>(META,"readonly",s=>s.get("installation"));if(m?.value)return m.value;const value=crypto.randomUUID();await tx(META,"readwrite",s=>s.put({id:"installation",value}));return value}
export async function activateLocalDevice(input:{pin:string;deviceId:string;pharmacyId:string;pharmacyName:string;token:string;reference?:unknown}) {
 if(!/^\d{4,6}$/.test(input.pin))throw new Error("Le PIN doit contenir 4 à 6 chiffres");
 const salt=crypto.getRandomValues(new Uint8Array(16));const {aes,hash}=await derive(input.pin,salt);
 const meta:Meta={id:"device",salt:Array.from(salt),pinHash:hash,deviceId:input.deviceId,pharmacyId:input.pharmacyId,pharmacyName:input.pharmacyName,tokenCipher:await encrypt(aes,input.token),lastSync:Date.now(),pinFailures:0,pinBlockedUntil:0,pinBlockSeconds:30};
 await tx(META,"readwrite",s=>s.put(meta));
 if(input.reference!==undefined)await saveReference(input.reference);
}
export async function unlockLocalDevice(pin:string) {
 const meta=await tx<Meta|undefined>(META,"readonly",s=>s.get("device"));if(!meta)throw new Error("Aucun appareil activé sur cet appareil");
 const {aes,hash}=await derive(pin,new Uint8Array(meta.salt));
 if(hash.length!==meta.pinHash.length||hash.some((v,i)=>v!==meta.pinHash[i]))throw new Error("PIN incorrect");
 if(Date.now()-meta.lastSync>7*24*60*60*1000)throw new Error("Appareil expiré après 7 jours sans synchronisation. Reconnectez-vous en ligne.");
 const token=await decrypt(aes,meta.tokenCipher);
 return {deviceId:meta.deviceId,pharmacyId:meta.pharmacyId,pharmacyName:meta.pharmacyName,token,aes,lastSync:meta.lastSync};
}
export function getUnlockedDevice(){return activeUnlocked}\nexport async function saveReference(data:unknown){await tx(REF,"readwrite",s=>s.put({id:"snapshot",value:data,savedAt:Date.now()}))}
export async function readReference(){return tx<{id:string;value:unknown;savedAt:number}|undefined>(REF,"readonly",s=>s.get("snapshot"))}
export async function enregistrerOperation(type:string,payload:unknown):Promise<string>{
 const id=crypto.randomUUID();const operation:PendingOperation={id,type,payload,createdAt:Date.now(),attempts:0,status:"pending"};await tx(QUEUE,"readwrite",s=>s.add(operation));return id;
}
export async function listPendingOperations(){return (await tx<PendingOperation[]>(QUEUE,"readonly",s=>s.getAll())).filter(x=>x.status==="pending").sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id))}
export async function markOperationAttempt(id:string,failed:boolean){const d=await openDb();await new Promise<void>((resolve,reject)=>{const t=d.transaction(QUEUE,"readwrite"),s=t.objectStore(QUEUE),r=s.get(id);r.onsuccess=()=>{if(r.result){r.result.attempts++;r.result.status=failed?"failed":"pending";s.put(r.result)}};t.oncomplete=()=>{d.close();resolve()};t.onerror=()=>{d.close();reject(t.error)}})}
export async function removeOperation(id:string){await tx(QUEUE,"readwrite",s=>s.delete(id))}
export async function pendingCount(){return (await listPendingOperations()).length}
export async function clearLocalDevice(){const d=await openDb();await new Promise<void>((resolve,reject)=>{const t=d.transaction([META,QUEUE,REF],"readwrite");t.objectStore(META).clear();t.objectStore(QUEUE).clear();t.objectStore(REF).clear();t.oncomplete=()=>{d.close();resolve()};t.onerror=()=>{d.close();reject(t.error)}})}
export async function saveTokenEncryptedForSession(pin:string,token:string){const m=await tx<Meta|undefined>(META,"readonly",s=>s.get("device"));if(!m)throw new Error("Appareil absent");const {aes}=await derive(pin,new Uint8Array(m.salt));m.tokenCipher=await encrypt(aes,token);await tx(META,"readwrite",s=>s.put(m))}
