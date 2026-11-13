"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Day = { weekday:number; label:string; is_open:boolean; opens_at:string; closes_at:string };
const defaults:Day[]=[
  {weekday:1,label:"Lundi",is_open:false,opens_at:"08:00",closes_at:"17:00"},
  {weekday:2,label:"Mardi",is_open:false,opens_at:"08:00",closes_at:"17:00"},
  {weekday:3,label:"Mercredi",is_open:false,opens_at:"08:00",closes_at:"17:00"},
  {weekday:4,label:"Jeudi",is_open:false,opens_at:"08:00",closes_at:"17:00"},
  {weekday:5,label:"Vendredi",is_open:false,opens_at:"08:00",closes_at:"17:00"},
  {weekday:6,label:"Samedi",is_open:false,opens_at:"08:00",closes_at:"13:00"},
  {weekday:7,label:"Dimanche",is_open:false,opens_at:"08:00",closes_at:"13:00"},
];

export function SuiviProfessionalAvailabilityEditor({userId}:{userId:string}){
  const sb=useMemo(()=>supabaseBrowser(),[]);
  const [days,setDays]=useState<Day[]>(defaults);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  const [failed,setFailed]=useState(false);

  useEffect(()=>{
    let active=true;
    void(async()=>{
      const {data:auth}=await sb.auth.getUser();
      if(!active)return;
      if(!auth.user||auth.user.id!==userId){setFailed(true);setNotice("Session invalide. Reconnectez-vous pour modifier votre planning.");setLoading(false);return;}
      const {data,error}=await sb.from("suivi_professional_weekly_availability")
        .select("weekday,is_open,opens_at,closes_at")
        .eq("user_id",userId).order("weekday");
      if(!active)return;
      if(error){setFailed(true);setNotice("Le planning n’est pas disponible. Vérifiez la migration des disponibilités.");setLoading(false);return;}
      if(data?.length){
        setDays(defaults.map(day=>{
          const row=data.find(item=>item.weekday===day.weekday);
          return row?{...day,is_open:!!row.is_open,opens_at:String(row.opens_at??"08:00").slice(0,5),closes_at:String(row.closes_at??"17:00").slice(0,5)}:day;
        }));
      }
      setLoading(false);
    })();
    return()=>{active=false;};
  },[sb,userId]);

  function updateDay(weekday:number,patch:Partial<Day>){
    setDays(current=>current.map(day=>day.weekday===weekday?{...day,...patch}:day));
  }

  async function save(){
    setSaving(true);setNotice("");setFailed(false);
    const invalid=days.find(day=>day.is_open&&(!day.opens_at||!day.closes_at||day.opens_at>=day.closes_at));
    if(invalid){setNotice("Vérifiez les heures : la fermeture doit être postérieure à l’ouverture pour "+invalid.label+".");setFailed(true);setSaving(false);return;}
    const {data:auth}=await sb.auth.getUser();
    if(!auth.user||auth.user.id!==userId){setNotice("Session expirée. Reconnectez-vous.");setFailed(true);setSaving(false);return;}
    const rows=days.map(day=>({
      user_id:userId,weekday:day.weekday,is_open:day.is_open,
      opens_at:day.is_open?day.opens_at:null,
      closes_at:day.is_open?day.closes_at:null,
      timezone:"Africa/Douala",updated_at:new Date().toISOString()
    }));
    const {error}=await sb.from("suivi_professional_weekly_availability").upsert(rows,{onConflict:"user_id,weekday"});
    setSaving(false);
    if(error){setFailed(true);setNotice("Le planning n’a pas été enregistré. Aucune disponibilité n’est annoncée comme modifiée.");return;}
    setNotice("Planning enregistré. Les disponibilités et horaires du jour sont mis à jour dans les recherches clients.");
  }

  return <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">Disponibilités · Africa/Douala</p><h2 className="mt-1 text-xl font-black text-slate-900">Mon planning hebdomadaire</h2><p className="mt-1 max-w-2xl text-sm leading-5 text-slate-600">Définissez vos heures d’ouverture pour chaque jour. Les clients verront uniquement les horaires du jour consulté ; le filtre « Disponible » tiendra compte de ce planning.</p></div>
      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900">7 jours</span>
    </div>
    {notice&&<p role="status" className={"mt-4 rounded-xl p-3 text-sm "+(failed?"border border-amber-200 bg-amber-50 text-amber-950":"border border-emerald-200 bg-emerald-50 text-emerald-900")}>{notice}</p>}
    {loading?<p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Chargement du planning…</p>:<div className="mt-4 space-y-2">
      {days.map(day=><div key={day.weekday} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_1fr] sm:items-center">
        <label className="flex items-center gap-3 text-sm font-bold text-slate-900"><input type="checkbox" checked={day.is_open} onChange={event=>updateDay(day.weekday,{is_open:event.target.checked})} className="h-5 w-5 rounded border-slate-300"/>{day.label}<span className="text-xs font-medium text-slate-500">{day.is_open?"Ouvert":"Fermé"}</span></label>
        <label className="text-xs font-semibold text-slate-600">Ouverture<input type="time" value={day.opens_at} disabled={!day.is_open} onChange={event=>updateDay(day.weekday,{opens_at:event.target.value})} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm text-slate-900 disabled:bg-slate-100"/></label>
        <label className="text-xs font-semibold text-slate-600">Fermeture<input type="time" value={day.closes_at} disabled={!day.is_open} onChange={event=>updateDay(day.weekday,{closes_at:event.target.value})} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm text-slate-900 disabled:bg-slate-100"/></label>
      </div>)}
    </div>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-5 text-slate-500">Un seul créneau continu par jour. Modifiez le planning à tout moment ; la prochaine recherche client utilisera immédiatement les nouvelles heures.</p><button type="button" disabled={loading||saving||failed&&days.length===0} onClick={()=>void save()} className="min-h-11 rounded-xl bg-[#123D68] px-5 font-bold text-white disabled:opacity-50">{saving?"Enregistrement…":"Enregistrer le planning"}</button></div>
  </section>;
}
