"use client";
import {useEffect,useState} from "react";
export function AppelerPharmacie({pharmacieId}:{pharmacieId:string}){const [phone,setPhone]=useState("");useEffect(()=>{let active=true;void fetch("/api/pharmacies/contact?pharmacie="+encodeURIComponent(pharmacieId),{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error();const d=await r.json() as {phone?:string};if(active&&d.phone)setPhone(d.phone)}).catch(()=>{});return()=>{active=false}},[pharmacieId]);if(!phone)return null;return <a href={"tel:"+phone} className="btn btn-clair w-full">Appeler la pharmacie</a>;}
