"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {supabaseBrowser} from "@/lib/supabase/client";

export function AcceptCourierInvitationClient({token}:{token:string}){
  const [email,setEmail]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [accepted,setAccepted]=useState(false);
  const validToken=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);

  useEffect(()=>{
    let alive=true;
    const sb=supabaseBrowser();
    void sb.auth.getUser().then(({data})=>{
      if(alive){setEmail(data.user?.email??null);setLoading(false);}
    });
    const {data:{subscription}}=sb.auth.onAuthStateChange((_event,session)=>{
      if(alive)setEmail(session?.user?.email??null);
    });
    return ()=>{alive=false;subscription.unsubscribe();};
  },[]);

  async function acceptInvite(){
    if(busy||!validToken||!email)return;
    setBusy(true);setError("");
    const {data,error:rpcError}=await supabaseBrowser().rpc("naxa_accept_livreur_invite",{p_token:token});
    if(rpcError){
      setError(rpcError.message||"Cette invitation ne peut pas être acceptée avec ce compte.");
      setBusy(false);
      return;
    }
    if(!data||data.accepted!==true){
      setError("L’acceptation n’a pas été confirmée par NAXA.");
      setBusy(false);
      return;
    }
    setAccepted(true);
    window.location.assign("/pharmacie/livreur");
  }

  const returnUrl="/invitation/livreur?token="+encodeURIComponent(token);
  return <main className="flex min-h-dvh items-center justify-center bg-[#F4F8F5] px-4 py-10 text-slate-900">
    <section className="w-full max-w-lg rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-black uppercase tracking-widest text-emerald-800">NAXA · Recrutement professionnel</p>
      <h1 className="mt-2 text-2xl font-black">Invitation au poste Livreur</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Cette invitation vous permet d’ajouter le poste Livreur à votre identité NAXA. Votre compte conserve une identité Client de base et ne pourra pas recevoir un autre poste professionnel.</p>
      {!validToken&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">Le lien d’invitation est incomplet ou invalide. Demandez un nouveau lien à la pharmacie.</p>}
      {loading?<p className="mt-5 text-sm text-slate-600">Vérification de votre session…</p>:!email&&validToken?
        <div className="mt-5 space-y-3">
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Créez d’abord votre compte NAXA ou connectez-vous avec l’adresse e-mail qui a reçu l’invitation. Après confirmation de votre e-mail, rouvrez ce lien pour accepter l’affectation.</p>
          <Link href="/creation-compte" className="flex min-h-11 items-center justify-center rounded-xl bg-[#0B3D26] px-4 py-3 text-sm font-bold text-white">Créer mon compte NAXA</Link>
          <Link href={"/connexion?retour="+encodeURIComponent(returnUrl)} className="flex min-h-11 items-center justify-center rounded-xl border border-emerald-900/20 px-4 py-3 text-sm font-bold text-emerald-950">J’ai déjà un compte · Me connecter</Link>
        </div>
        :email&&validToken&&!accepted&&
        <div className="mt-5 space-y-3">
          <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">Vous êtes connecté avec <strong>{email}</strong>. Seul le compte destinataire peut accepter cette invitation.</p>
          {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <button type="button" disabled={busy} onClick={()=>void acceptInvite()} className="min-h-12 w-full rounded-xl bg-[#0B3D26] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?"Vérification et activation…":"Accepter l’affectation Livreur"}</button>
          <Link href="/connexion" className="block text-center text-sm font-semibold text-emerald-900 underline">Utiliser une autre adresse e-mail</Link>
        </div>}
      <p className="mt-6 border-t pt-4 text-xs leading-5 text-slate-500">L’invitation expire 7 jours après sa création. L’activation est refusée si le compte n’a pas confirmé son e-mail, n’est pas majeur ou possède déjà un autre poste professionnel.</p>
    </section>
  </main>;
}
