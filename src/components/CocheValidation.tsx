import type { CSSProperties } from "react";
export function CocheValidation({couleur="#FFE33D",visible=true,label="Information valide",right="14px"}:{couleur?:string;visible?:boolean;label?:string;right?:string}) {
 return <span className="naxa-check" data-visible={visible?"true":"false"} style={{backgroundColor:couleur,right} as CSSProperties} aria-label={label}><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8 3 3 7-7" stroke={couleur==="#FFE33D"?"#064B2A":"#fff"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>;
}
