import type { CSSProperties } from "react";
export function CocheValidation({couleur="#FFE33D",visible=true,label="Information valide",right="14px"}:{couleur?:string;visible?:boolean;label?:string;right?:string}) {
 return <span className="naxa-check naxa-pill-validation" data-visible={visible?"true":"false"} style={{background:"linear-gradient(105deg, #FFE33D 0 48%, #2D9CFF 52% 100%)",right, width:"26px",height:"12px",borderRadius:"999px",boxShadow:"0 1px 3px rgba(6,75,42,.18)",border:"1px solid rgba(255,255,255,.8)"} as CSSProperties} aria-label={label} role="img" />;
}
