"use client";
import type { CSSProperties } from "react";
export function CocheValidation({couleur="#16A34A",visible=true,label="Information valide",right="14px"}:{couleur?:string;visible?:boolean;label?:string;right?:string}) {
 return <span className="naxa-check" data-visible={visible?"true":"false"} style={{position:"absolute",right,top:"50%",transform:"translateY(-50%)",display:"inline-flex",alignItems:"center",justifyContent:"center",width:"22px",height:"22px",borderRadius:"9999px",background:visible?couleur:"#E5E7EB",color:"#FFFFFF",boxShadow:visible?"0 1px 3px rgba(22,163,74,.2)":"none",opacity:visible?1:0,transition:"opacity 160ms ease, background-color 160ms ease",pointerEvents:"none",zIndex:5} as CSSProperties} aria-label={label} role="img">{visible&&<svg aria-hidden="true" viewBox="0 0 20 20" width="13" height="13" fill="none"><path d="m4.5 10.2 3.4 3.3 7.6-7.2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}</span>;
}
