"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
const N=8;
export function Luciole(){
 const {night}=useTheme(),path=usePathname(),el=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!night||path==="/scanner")return;
  const node=el.current;if(!node)return;
  const reduced=matchMedia("(prefers-reduced-motion: reduce)"),vv=window.visualViewport;
  let x=innerWidth*.5,y=innerHeight*.4,bx=x,by=y,vx=0,vy=0,last=0,id=0,lastAction=0,lastFrame=0,slow=false,slowSince=0;
  let target:Element|null=null,active=false,flane=true;
  const sparks=Array.from(node.querySelectorAll<HTMLElement>(".luciole-spark"));
  const bounds=()=>({w:vv?.width??innerWidth,h:vv?.height??innerHeight,top:vv?.offsetTop??0});
  const aim=(e:Event)=>{const t=e.target as Element|null;const a=t?.closest("input,textarea,select,button,a,[role=tab],[role=button],[role=option],label") as HTMLElement|null;if(!a)return;target=a;const r=a.getBoundingClientRect();bx=r.left+(a.matches("input,textarea,select")?18:r.width/2);by=r.top+(a.matches("input,textarea,select")?r.height/2:r.height/2);lastAction=performance.now();flane=false;active=true;if(reduced.matches){x=bx;y=by;paint()}else start();if(e.type==="pointerdown"&&/^(Chercher|Ajouter|Commander|Réserver|Se connecter|Confirmer)$/i.test((a.innerText||a.getAttribute("aria-label")||"").trim()))burst();};
  const paint=()=>{const b=bounds();x=Math.max(24,Math.min(b.w-24,x));y=Math.max(b.top+24,Math.min(b.top+b.h-24,y));node.style.transform=`translate3d(${x-24}px,${y-24}px,0)`;};
  const burst=()=>{const count=slow?4:8; sparks.forEach((s,i)=>{s.style.animation="none";s.style.opacity=i<count?"1":"0";s.style.setProperty("--sx",Math.cos(i*Math.PI/4)*(30+(i%3)*15)+"px");s.style.setProperty("--sy",Math.sin(i*Math.PI/4)*(30+(i%3)*15)+"px");void s.offsetWidth;if(i<count)s.style.animation="luciole-spark 700ms ease-out forwards";});};
  const frame=(now:number)=>{id=0;if(document.hidden)return;const dt=lastFrame?now-lastFrame:0;lastFrame=now;if(dt>24){if(!slowSince)slowSince=now;if(now-slowSince>1000)slow=true}else{slowSince=0;slow=false}
   const b=bounds();if(target?.isConnected&&now-lastAction<4000){const r=target.getBoundingClientRect();bx=r.left+(target.matches("input,textarea,select")?18:r.width/2);by=r.top+r.height/2;}else if(now-lastAction>=4000){flane=true;bx=Math.max(24,Math.min(b.w-24,bx+Math.sin(now/1900)*.28));by=Math.max(b.top+24,Math.min(b.top+b.h-24,by+Math.cos(now/2200)*.22));}
   if(reduced.matches){x=bx;y=by;paint();return}
   vx=(vx+(bx-x)*.04)*.76;vy=(vy+(by-y)*.04)*.76;x+=vx;y+=vy;paint();
   const settled=Math.abs(bx-x)<.6&&Math.abs(by-y)<.6&&Math.abs(vx)+Math.abs(vy)<.3;
   if(!settled||flane){if(flane&&now-lastAction>=4000&&now-last<33){id=requestAnimationFrame(frame);return}last=now;id=requestAnimationFrame(frame)}else active=false;
  };
  const start=()=>{if(!id&&!document.hidden){lastFrame=0;id=requestAnimationFrame(frame)}};
  const wake=()=>{lastAction=performance.now();flane=false;active=true;start()};
  const visibility=()=>{if(document.hidden){if(id)cancelAnimationFrame(id);id=0}else if(active||flane)start()};
  const viewport=()=>{wake();paint()};
  document.addEventListener("focusin",aim,true);document.addEventListener("pointerdown",aim,true);addEventListener("scroll",wake,{passive:true,capture:true});vv?.addEventListener("resize",viewport);vv?.addEventListener("scroll",viewport);document.addEventListener("visibilitychange",visibility);reduced.addEventListener?.("change",wake);
  paint();if(reduced.matches){node.style.opacity="1"}else start();
  return()=>{if(id)cancelAnimationFrame(id);document.removeEventListener("focusin",aim,true);document.removeEventListener("pointerdown",aim,true);removeEventListener("scroll",wake,true);vv?.removeEventListener("resize",viewport);vv?.removeEventListener("scroll",viewport);document.removeEventListener("visibilitychange",visibility);reduced.removeEventListener?.("change",wake);sparks.forEach(s=>{s.style.animation="none";s.style.opacity="0"})};
 },[night,path]);
 if(!night||path==="/scanner")return null;
 return <div ref={el} className="naxa-luciole" aria-hidden="true"><span className="luciole-core"/>{Array.from({length:N},(_,i)=><i key={i} className="luciole-spark" />)}</div>;
}
