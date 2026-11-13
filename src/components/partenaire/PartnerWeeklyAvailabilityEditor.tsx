"use client";

import { useEffect,useMemo,useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Day={weekday:number;label:string;is_open:boolean;opens_at:string;closes_at:string};
const defaults:Day[]=[
  {weekday:1,label:"Lundi",is_open:false,opens_at:"08:00",closes_at:"17:00"},
  {weekday:2,label:"Mardi",is_open:false,opens_at:"08:00",closes_at:"17:00"},
  {weekday:3,label:"Mercredi",is_open:false,opens_at:"08:00",closes_at:"17:00"},
  {weekday:4,label:"Jeudi",is_open:false,opens_at:"08:00",closes_at:"17:00"},
  {weekday:5,label:"Vendredi",is_open:false,opens_at:"08:00",closes_at:"17:00"},
  {weekday:6,label:"Samedi",is_open:false,opens_at:"08:00",closes_at:"13:00"},
  {weekday:7,label:"Dimanche",is_open:false,opens_at:"08:00",closes_at:"13:00"},
];

export function PartnerWeeklyAvailabilityEditor({partnerId,partnerName}:{partnerId:string;partnerName:string}){
  const sb=useMemo(()=>supabaseBrowser(),[]);
  const [days,setDays]=useState<Day[]>(defaults);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [failed,setFailed]=useState(false);
  const [loadFailed,setLoadFailed]=useState(false);
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    let active=true;
    void(async()=>{
      const {data:auth}=await sb.auth.getUser();
      if(!active)return;
      if(!auth.user){
        setFailed(true);setLoadFailed(true);setNotice("Session invalide. Reconnectez-vous pour consulter le planning.");setLoading(false);return;
      }
      const {data,error}=await sb.from("partner_weekly_availability")
        .select("weekday,is_open,opens_at,closes_at")
        .eq("partner_id",partnerId).order("weekday");
      if(!active)return;
      if(error){
        setFailed(true);setLoadFailed(true);
        setNotice("Planning inaccessible. Seul le titulaire disposant d’une convention NAXA active peut le modifier.");
        setLoading(false);return;
      }
      setDays(defaults.map(day=>{
        const row=(data??[]).find((item:any)=>item.weekday===day.weekday);
        return row?{...day,is_open:!!row.is_open,opens_at:String(row.opens_at??"08:00").slice(0,5),closes_at:String(row.closes_at??"17:00").slice(0,5)}:day;
      }));
      setLoading(false);
    })();
    return()=>{active=false;};
  },[sb,partnerId]);

  function updateDay(weekday:number,patch:Partial<Day>){
    setDays(current=>current.map(day=>day.weekday===weekday?{...day,...patch}:day));
  }

  async function save(){
    setSaving(true);setNotice("");setFailed(false);
    const invalid=days.find(day=>day.is_open&&(!day.opens_at||!day.closes_at||day.opens_at>=day.closes_at));
    if(invalid){setNotice("Vérifiez les heures : la fermeture doit être postérieure à l’ouverture pour "+invalid.label+".");setFailed(true);setSaving(false);return;}
    const {data:auth}=await sb.auth.getUser();
    if(!auth.user){setNotice("Session expirée. Reconnectez-vous.");setFailed(true);setSaving(false);return;}
    const rows=days.map(day=>({
      partner_id:partnerId,weekday:day.weekday,is_open:day.is_open,
      opens_at:day.is_open?day.opens_at:null,
      closes_at:day.is_open?day.closes_at:null,
      timezone:"Africa/Douala",updated_at:new Date().toISOString()
    }));
    const {error}=await sb.from("partner_weekly_availability").upsert(rows,{onConflict:"partner_id,weekday"});
    setSaving(false);
    if(error){setFailed(true);setNotice("Le planning n’a pas été enregistré. Vérifiez la convention du Partenaire et vos droits.");return;}
    setNotice("Planning du Partenaire enregistré. Les recherches clients et l’annuaire indépendant utiliseront ces horaires.");
  }

  return <section className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">Africa/Douala</p><h4 className="mt-1 font-extrabold">Planning de {partnerName}</h4><p className="mt-1 text-xs leading-5 text-slate-600">Ce planning appartient au Partenaire. Il n’est pas déduit des horaires personnels de ses salariés.</p></div>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-900">7 jours</span>
    </div>
    {notice&&<p role="status" className={"mt-3 rounded-lg p-3 text-sm "+(failed?"border border-amber-200 bg-amber-50 text-amber-950":"border border-emerald-200 bg-emerald-50 text-emerald-900")}>{notice}</p>}
    {loading?<p className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-600">Chargement du planning…</p>:<div className="mt-3 space-y-2">
      {days.map(day=><div key={day.weekday} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_1fr_1fr] sm:items-center">
        <label className="flex items-center gap-3 text-sm font-bold text-slate-900"><input type="checkbox" checked={day.is_open} onChange={event=>updateDay(day.weekday,{is_open:event.target.checked})} className="h-5 w-5 rounded border-slate-300"/>{day.label}<span className="text-xs font-medium text-slate-500">{day.is_open?"Ouvert":"Fermé"}</span></label>
        <label className="text-xs font-semibold text-slate-600">Ouverture<input type="time" value={day.opens_at} disabled={!day.is_open} onChange={event=>updateDay(day.weekday,{opens_at:event.target.value})} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm text-slate-900 disabled:bg-slate-100"/></label>
        <label className="text-xs font-semibold text-slate-600">Fermeture<input type="time" value={day.closes_at} disabled={!day.is_open} onChange={event=>updateDay(day.weekday,{closes_at:event.target.value})} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm text-slate-900 disabled:bg-slate-100"/></label>
      </div>)}
    </div>}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-5 text-slate-500">Un créneau continu maximum par jour.</p><button type="button" disabled={loading||saving||loadFailed} onClick={()=>void save()} className="min-h-10 rounded-lg bg-[#123D68] px-4 font-bold text-white disabled:opacity-50">{saving?"Enregistrement…":"Enregistrer le planning du Partenaire"}</button></div>
  </section>;
}
