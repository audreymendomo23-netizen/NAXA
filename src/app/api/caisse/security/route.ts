import { NextRequest, NextResponse } from "next/server";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const err=(error:string,status=400)=>NextResponse.json({error},{status});
const rp=(r:NextRequest)=>new URL(process.env.NEXT_PUBLIC_APP_URL||r.url).hostname;
const origin=(r:NextRequest)=>new URL(process.env.NEXT_PUBLIC_APP_URL||r.url).origin;
async function authUser(){const {data,error}=await supabaseServer().auth.getUser();return !error?data.user:null;}
async function sessionOK(userId:string,sessionId:string){
 const sb=supabaseServer(),db=supabaseAdmin();
 const {data:auth,error:authError}=await sb.auth.getUser();
 if(authError||auth.user?.id!==userId)return false;
 const [{data:s,error:sessionError},{data:p,error:profileError},{data:activeRole,error:roleError}]=await Promise.all([
  db.from("caisses_sessions").select("id,ouvert_par,statut,caisses!inner(pharmacie_id,actif)")
   .eq("id",sessionId).eq("ouvert_par",userId).eq("statut","ouverte").eq("caisses.actif",true).maybeSingle(),
  sb.from("profiles").select("id,actif,pharmacie_id").eq("id",userId).maybeSingle(),
  sb.rpc("naxa_business_function")
 ]);
 if(sessionError||profileError||roleError||!s||!p||p.actif!==true||activeRole!=="caisse")return false;
 const ph=(s.caisses as unknown as {pharmacie_id:string}).pharmacie_id;
 return p.pharmacie_id===ph;
}
async function grant(userId:string,sessionId:string,method:"pin"|"biometric"){const {data,error}=await supabaseAdmin().from("caisse_decaissement_auth_grants").insert({user_id:userId,session_id:sessionId,method,expires_at:new Date(Date.now()+90_000).toISOString()}).select("id").single();if(error||!data)throw new Error("Grant unavailable");return data.id;}
export async function POST(request:NextRequest){
 const user=await authUser();if(!user)return err("Connexion requise.",401);
 const b=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!b||typeof b.action!=="string")return err("Action invalide.");
 const db=supabaseAdmin();
 try{
 if(b.action==="configure-pin"){
  const targetId=typeof b.targetUserId==="string"?b.targetUserId:"",pin=typeof b.pin==="string"?b.pin:"";
  if(!/^\d{6,8}$/.test(pin))return err("Le PIN doit contenir 6 à 8 chiffres.");
  const sb=supabaseServer();
  const {data:managerProfile,error:managerError}=await sb.from("profiles").select("id,actif").eq("id",user.id).maybeSingle();
  const {data:target}=await db.from("profiles").select("id,actif,pharmacie_id,role").eq("id",targetId).eq("actif",true).maybeSingle();
  if(managerError||managerProfile?.actif!==true||!target?.pharmacie_id)return err("Caisse hors de votre équipe ou gestionnaire inactif.",403);
  const [{data:canCreate,error:createError},{data:canManage,error:manageError},{data:assignments,error:assignmentError}]=await Promise.all([
   sb.rpc("naxa_can",{p_privilege:"CREATE_CAISSE",p_pharmacie:target.pharmacie_id,p_target:null}),
   sb.rpc("naxa_can_manage_team_member",{p_target:targetId,p_pharmacie:target.pharmacie_id}),
   db.from("naxa_professional_assignments").select("id,commence_at,expire_at").eq("profile_id",targetId)
    .eq("pharmacie_id",target.pharmacie_id).eq("role_code","caisse").eq("statut","active")
  ]);
  const now=Date.now();
  const hasActiveAssignment=(assignments??[]).some(a=>new Date(a.commence_at).getTime()<=now
    &&(a.expire_at===null||new Date(a.expire_at).getTime()>now));
  const isLegacyCashier=target.role==="caisse";
  if(createError||manageError||assignmentError||canCreate!==true||canManage!==true||(!hasActiveAssignment&&!isLegacyCashier))
   return err("Cette Caisse n’est pas attribuée à une pharmacie que vous pouvez gérer.",403);
  const salt=randomBytes(16).toString("hex"),hash=scryptSync(pin,salt,64).toString("hex");
  const {data:old}=await db.from("caisse_security_credentials").select("webauthn_credential_id,webauthn_public_key,webauthn_counter,webauthn_transports,webauthn_enabled").eq("user_id",targetId).maybeSingle();
  const {error}=await db.from("caisse_security_credentials").upsert({user_id:targetId,...(old||{}),pin_salt:salt,pin_hash:hash,updated_at:new Date().toISOString()});
  if(error)throw error;return NextResponse.json({ok:true,message:"PIN configuré pour cette Caisse."});
 }
 if(b.action==="authorize-pin"){
  const sid=typeof b.sessionId==="string"?b.sessionId:"",pin=typeof b.pin==="string"?b.pin:"";
  if(!sid||!/^\d{6,8}$/.test(pin)||!(await sessionOK(user.id,sid)))return err("Session ou PIN invalide.",403);
  const {data:c}=await db.from("caisse_security_credentials").select("pin_salt,pin_hash,pin_failed_attempts,pin_locked_until").eq("user_id",user.id).maybeSingle();
  if(!c?.pin_salt||!c.pin_hash)return err("PIN non configuré par le Promoteur.",403);
  if(c.pin_locked_until && new Date(c.pin_locked_until).getTime()>Date.now())return err("PIN temporairement bloqué après plusieurs échecs. Réessayez plus tard.",429);
  const got=Uint8Array.from(Array.from(scryptSync(pin,c.pin_salt,64))),expected=Uint8Array.from(Array.from(Buffer.from(c.pin_hash,"hex")));
  if(got.length!==expected.length||!timingSafeEqual(got,expected)){
   const {data:failure,error:failureError}=await db.rpc("caisse_pin_register_failure",{p_user_id:user.id});
   if(failureError)throw failureError;
   const state=Array.isArray(failure)?failure[0] as {attempts?:number;locked_until?:string|null}|undefined:undefined;
   const attempts=Number(state?.attempts||0);
   return err(attempts>=5?"PIN bloqué pendant 15 minutes après 5 échecs.":"PIN incorrect.",403);
  }
  const {error:resetError}=await db.rpc("caisse_pin_reset_failures",{p_user_id:user.id});
  if(resetError)throw resetError;
  return NextResponse.json({grantId:await grant(user.id,sid,"pin"),method:"pin"});
 }
 if(b.action==="registration-options"){
  const sid=typeof b.sessionId==="string"?b.sessionId:"",pin=typeof b.pin==="string"?b.pin:"";
  if(!sid||!(await sessionOK(user.id,sid))||!/^[0-9]{6,8}$/.test(pin))return err("Session Caisse ou PIN Promoteur requis pour enregistrer la biométrie.",403);
  const {data:credential}=await db.from("caisse_security_credentials").select("pin_salt,pin_hash,pin_locked_until").eq("user_id",user.id).maybeSingle();
  if(!credential?.pin_salt||!credential.pin_hash)return err("PIN non configuré par le Promoteur.",403);
  if(credential.pin_locked_until&&new Date(credential.pin_locked_until).getTime()>Date.now())return err("PIN temporairement bloqué après plusieurs échecs.",429);
  const got=Uint8Array.from(Array.from(scryptSync(pin,credential.pin_salt,64))),expected=Uint8Array.from(Array.from(Buffer.from(credential.pin_hash,"hex")));
  if(got.length!==expected.length||!timingSafeEqual(got,expected)){
   const {data:failure,error:failureError}=await db.rpc("caisse_pin_register_failure",{p_user_id:user.id});
   if(failureError)throw failureError;
   const state=Array.isArray(failure)?failure[0] as {attempts?:number}|undefined:undefined;
   return err(Number(state?.attempts||0)>=5?"PIN bloqué pendant 15 minutes après 5 échecs.":"PIN incorrect. Enrôlement biométrique refusé.",403);
  }
  const {error:resetError}=await db.rpc("caisse_pin_reset_failures",{p_user_id:user.id});
  if(resetError)throw resetError;
  const {data:p}=await db.from("profiles").select("username,first_name,last_name").eq("id",user.id).maybeSingle();
  const options=await generateRegistrationOptions({rpName:"NAXA Caisse",rpID:rp(request),userID:new TextEncoder().encode(user.id),userName:user.email||p?.username||user.id,userDisplayName:[p?.first_name,p?.last_name].filter(Boolean).join(" ")||p?.username||"Compte Caisse",attestationType:"none",authenticatorSelection:{residentKey:"preferred",userVerification:"required"},timeout:60000});
  const {error}=await db.from("caisse_security_challenges").upsert({user_id:user.id,challenge:options.challenge,purpose:"registration",expires_at:new Date(Date.now()+300000).toISOString()});if(error)throw error;return NextResponse.json(options);
 }
 if(b.action==="registration-verify"){
  const sid=typeof b.sessionId==="string"?b.sessionId:"";if(!sid||!(await sessionOK(user.id,sid)))return err("Session Caisse invalide ou expirée.",403);
  const response=b.response as Parameters<typeof verifyRegistrationResponse>[0]["response"]|undefined;if(!response)return err("Preuve biométrique absente.");
  const {data:ch,error:challengeError}=await db.from("caisse_security_challenges").delete().eq("user_id",user.id).eq("purpose","registration").gt("expires_at",new Date().toISOString()).select("challenge").maybeSingle();
  if(challengeError)throw challengeError;if(!ch)return err("Demande expirée ou déjà consommée.",410);
  const v=await verifyRegistrationResponse({response,expectedChallenge:ch.challenge,expectedOrigin:origin(request),expectedRPID:rp(request),requireUserVerification:true});if(!v.verified||!v.registrationInfo)return err("Enregistrement biométrique refusé.",403);
  const i=v.registrationInfo, {data:old}=await db.from("caisse_security_credentials").select("pin_salt,pin_hash").eq("user_id",user.id).maybeSingle();
  const {error}=await db.from("caisse_security_credentials").upsert({user_id:user.id,pin_salt:old?.pin_salt??null,pin_hash:old?.pin_hash??null,webauthn_credential_id:i.credential.id,webauthn_public_key:Buffer.from(i.credential.publicKey).toString("base64url"),webauthn_counter:i.credential.counter,webauthn_transports:((response as {response?:{transports?:string[]}}).response?.transports||[]),webauthn_enabled:true,updated_at:new Date().toISOString()});if(error)throw error;return NextResponse.json({ok:true,message:"Biométrie de cet appareil enregistrée. NAXA ne stocke pas l’empreinte elle-même."});
 }
 if(b.action==="authentication-options"){
  const sid=typeof b.sessionId==="string"?b.sessionId:"";if(!sid||!(await sessionOK(user.id,sid)))return err("Session Caisse invalide.",403);
  const {data:c}=await db.from("caisse_security_credentials").select("webauthn_credential_id,webauthn_transports").eq("user_id",user.id).eq("webauthn_enabled",true).maybeSingle();if(!c?.webauthn_credential_id)return err("Biométrie non configurée.",404);
  const options=await generateAuthenticationOptions({rpID:rp(request),allowCredentials:[{id:c.webauthn_credential_id,transports:c.webauthn_transports as AuthenticatorTransport[]}],userVerification:"required",timeout:60000});
  const {error}=await db.from("caisse_security_challenges").upsert({user_id:user.id,challenge:options.challenge,purpose:"authentication",expires_at:new Date(Date.now()+300000).toISOString()});if(error)throw error;return NextResponse.json(options);
 }
 if(b.action==="authentication-verify"){
  const sid=typeof b.sessionId==="string"?b.sessionId:"",response=b.response as Parameters<typeof verifyAuthenticationResponse>[0]["response"]|undefined;
  if(!sid||!response||!(await sessionOK(user.id,sid)))return err("Session invalide.",403);
  const {data:ch,error:challengeError}=await db.from("caisse_security_challenges").delete().eq("user_id",user.id).eq("purpose","authentication").gt("expires_at",new Date().toISOString()).select("challenge").maybeSingle();
  if(challengeError)throw challengeError;
  const {data:c}=await db.from("caisse_security_credentials").select("*").eq("user_id",user.id).eq("webauthn_enabled",true).maybeSingle();
  if(!ch||!c?.webauthn_credential_id||!c.webauthn_public_key)return err("Biométrie non configurée ou demande expirée/déjà consommée.",403);
  const v=await verifyAuthenticationResponse({response,expectedChallenge:ch.challenge,expectedOrigin:origin(request),expectedRPID:rp(request),requireUserVerification:true,credential:{id:c.webauthn_credential_id,publicKey:Uint8Array.from(Array.from(Buffer.from(c.webauthn_public_key,"base64url"))),counter:Number(c.webauthn_counter||0),transports:(c.webauthn_transports||[]) as AuthenticatorTransport[]}});
  if(!v.verified)return err("Vérification biométrique refusée.",403);
  const {error:counterError}=await db.from("caisse_security_credentials").update({webauthn_counter:v.authenticationInfo.newCounter,updated_at:new Date().toISOString()}).eq("user_id",user.id);if(counterError)throw counterError;
  return NextResponse.json({grantId:await grant(user.id,sid,"biometric"),method:"biometric"});
 }
 return err("Action inconnue.");
 }catch(e){console.error("NAXA_CAISSE_SECURITY",e instanceof Error?e.message:"unknown");return err("Service de sécurité de caisse indisponible.",503);}
}
