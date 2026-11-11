"use client";

import { useEffect, useRef, useState } from "react";

type Props = { onFinish: () => void };
const A = 8.5;
const HIGH = 11;
const phrases = [
  { main: "BIENVENUE DANS L’ÉCOSYSTÈME NAXA", color: "#FFFFFF" },
  { main: "VOTRE SANTÉ, VOS SERVICES", color: "#FFE33D" },
  { main: "PLUSIEURS UNIVERS", sub: "Une seule application, un seul compte", color: "#FFFFFF" },
  { main: "CHOISISSEZ VOTRE ESPACE", color: "#FFE33D" },
];
function angleAt(t:number) {
  if(t<.6)return -A;
  if(t<1.2)return -A*Math.cos(((t-.6)/.6)*Math.PI/2);
  if(t<1.8)return A*Math.sin(((t-1.2)/.6)*Math.PI/2);
  if(t<2.4)return A*Math.cos(((t-1.8)/.6)*Math.PI/2);
  if(t<3.2)return -HIGH*Math.sin(((t-2.4)/.8)*Math.PI/2);
  if(t<4)return -HIGH*Math.cos(((t-3.2)/.8)*Math.PI/2);
  if(t<4.6)return A*Math.sin(((t-4)/.6)*Math.PI/2);
  if(t<5.2)return A*Math.cos(((t-4.6)/.6)*Math.PI/2);
  return -A*Math.sin(Math.min(1,(t-5.2)/.4)*Math.PI/2);
}
export function IntroNaxa({onFinish}:Props) {
  const finishRef=useRef(onFinish); finishRef.current=onFinish;
  const finished=useRef(false);
  const pendulum=useRef<HTMLDivElement>(null);
  const texts=useRef<Array<HTMLDivElement|null>>([]);
  const logoRef=useRef<HTMLImageElement>(null);
  const footerRef=useRef<HTMLDivElement>(null);
  const cancelledRef=useRef(false);
  const cancelTimer=useRef<number|null>(null);
  const [cancelled,setCancelled]=useState(false);
  useEffect(()=>{
    const motion=window.matchMedia("(prefers-reduced-motion: reduce)");
    if(motion.matches){finished.current=true;finishRef.current();return}
    let frame=0; let start:number|null=null;
    const finish=()=>{if(finished.current)return;finished.current=true;finishRef.current()};
    const cancel=()=>{if(cancelTimer.current!==null||finished.current)return;cancelledRef.current=true;setCancelled(true);cancelTimer.current=window.setTimeout(finish,200)};
    const key=(e:KeyboardEvent)=>{if(e.key==="Escape"||e.key==="Enter"){e.preventDefault();cancel()}};
    const draw=(now:number)=>{
      if(start===null)start=now;
      const t=Math.min(6,(now-start)/1000);
      const a=angleAt(t);
      if(pendulum.current)pendulum.current.style.transform=`rotate(${a}deg)`;
      const x=Math.max(0,Math.min(100,(360+Math.tan(a*Math.PI/180)*(590+980))/720*100));
      const clipLeft=`polygon(0 0,${x}% 0,${x}% 100%,0 100%)`;
      const clipRight=`polygon(${x}% 0,100% 0,100% 100%,${x}% 100%)`;
      const vis=[
        {on:t<1.8,clip:t>=1.2&&t<1.8?clipRight:"none"},
        {on:t>=1.2&&t<3.2,clip:t>=1.2&&t<1.8?clipLeft:t>=2.4&&t<3.2?clipLeft:"none"},
        {on:t>=2.4&&t<4.6,clip:t>=2.4&&t<3.2||t>=4&&t<4.6?clipRight:"none"},
        {on:t>=4,clip:t>=4&&t<4.6?clipLeft:"none"},
      ];
      vis.forEach((s,i)=>{const node=texts.current[i];if(!node)return;node.style.opacity=s.on&&!cancelledRef.current?"1":"0";node.style.clipPath=s.clip});
      const fadeIn=Math.min(1,t/.5);
      if(logoRef.current)logoRef.current.style.opacity=String(fadeIn);
      if(footerRef.current){footerRef.current.style.opacity=String(fadeIn);footerRef.current.style.transform=`translateY(${(1-fadeIn)*20}px)`;}
      const root=document.getElementById("naxa-intro-overlay");
      if(root){root.style.transitionDuration=t>=5.6?"400ms":"200ms";root.style.opacity=cancelledRef.current||t>=5.6?"0":"1";}
      if(t>=6){finish();return}
      frame=window.requestAnimationFrame(draw);
    };
    window.addEventListener("keydown",key);
    frame=window.requestAnimationFrame(draw);
    return()=>{window.cancelAnimationFrame(frame);window.removeEventListener("keydown",key);if(cancelTimer.current!==null)window.clearTimeout(cancelTimer.current)};
  },[]);
  const scale=typeof window==="undefined"?1:Math.min(window.innerWidth/720,window.innerHeight/1280);
  return <div id="naxa-intro-overlay" role="presentation" onClick={()=>{if(cancelTimer.current!==null||finished.current)return;cancelledRef.current=true;setCancelled(true);cancelTimer.current=window.setTimeout(()=>{if(!finished.current){finished.current=true;finishRef.current()}},200)}} style={{position:"fixed",inset:0,zIndex:2147483647,overflow:"hidden",background:"#064B2A",opacity:cancelled?0:1,transition:"opacity 200ms ease",touchAction:"manipulation",cursor:"pointer"}}>
    <div style={{position:"absolute",left:"50%",top:"50%",width:720,height:1280,transform:`translate(-50%,-50%) scale(${scale})`,transformOrigin:"center",overflow:"hidden",background:"#064B2A",fontFamily:"inherit"}}>
      <img ref={logoRef} src="/naxa-logo-officiel.svg" alt="NAXA" style={{position:"absolute",left:245,top:150,width:230,height:61,objectFit:"contain",opacity:0}}/>
      {phrases.map((p,i)=><div key={p.main} ref={n=>{texts.current[i]=n}} style={{position:"absolute",left:72,top:470,width:576,minHeight:220,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",textTransform:"uppercase",fontWeight:900,fontSize:72,lineHeight:.95,letterSpacing:"-.035em",color:p.color,textShadow:"0 4px 10px rgba(6,75,42,.18)",opacity:i===0?1:0,clipPath:"none",pointerEvents:"none"}}><span>{p.main}</span>{p.sub&&<span style={{marginTop:18,fontSize:29,lineHeight:1.1,letterSpacing:0,textTransform:"none"}}>{p.sub}</span>}</div>)}
      <div ref={pendulum} style={{position:"absolute",left:360,top:-980,width:0,height:1650,transform:`rotate(-${A}deg)`,transformOrigin:"0 0",pointerEvents:"none"}}>
        <div style={{position:"absolute",left:-1.5,top:0,width:3,height:1650,background:"#FFE33D",boxShadow:"8px 0 6px rgba(0,0,0,.25)"}}/>
        <div style={{position:"absolute",left:-60,top:1650,width:120,height:120,borderRadius:26,background:"#064B2A",boxShadow:"8px 10px 18px rgba(0,0,0,.22)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
          <svg viewBox="0 0 330 340" width="72" height="74" aria-hidden="true"><path fill="#FFE33D" d="M 305.0,24.0 L 286.0,24.0 L 271.0,31.0 L 247.0,46.0 L 224.0,57.0 L 211.0,69.0 L 204.0,87.0 L 204.0,103.0 L 210.0,117.0 L 215.0,123.0 L 245.0,148.0 L 260.0,163.0 L 271.0,179.0 L 280.0,199.0 L 280.0,206.0 L 283.0,216.0 L 282.0,219.0 L 279.0,219.0 L 274.0,213.0 L 246.0,189.0 L 102.0,53.0 L 86.0,46.0 L 68.0,45.0 L 50.0,50.0 L 34.0,62.0 L 25.0,77.0 L 22.0,87.0 L 22.0,271.0 L 28.0,287.0 L 40.0,302.0 L 56.0,312.0 L 67.0,315.0 L 89.0,314.0 L 103.0,308.0 L 115.0,297.0 L 121.0,287.0 L 124.0,277.0 L 124.0,257.0 L 121.0,250.0 L 114.0,239.0 L 79.0,208.0 L 63.0,189.0 L 55.0,175.0 L 55.0,171.0 L 50.0,160.0 L 50.0,154.0 L 47.0,148.0 L 48.0,141.0 L 53.0,142.0 L 171.0,255.0 L 180.0,262.0 L 215.0,296.0 L 230.0,308.0 L 237.0,312.0 L 247.0,315.0 L 268.0,315.0 L 283.0,309.0 L 297.0,297.0 L 305.0,283.0 L 308.0,274.0 L 309.0,264.0 L 309.0,29.0 Z"/></svg>
        </div>
      </div>
      <div ref={footerRef} style={{position:"absolute",left:0,bottom:0,width:720,height:230,borderRadius:"40px 40px 0 0",background:"#064B2A",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px calc(24px + env(safe-area-inset-bottom))",boxSizing:"border-box",textAlign:"center",fontSize:39,fontWeight:800,lineHeight:1.15,color:"#FFFFFF",opacity:0,transform:"translateY(20px)",transition:"opacity 500ms ease, transform 500ms ease"}}>
        <div>Un seul compte pour vos services</div><div style={{color:"#FFE33D"}}>de santé et de proximité avec NAXA</div>
      </div>
    </div>
  </div>;
}
export default IntroNaxa;
