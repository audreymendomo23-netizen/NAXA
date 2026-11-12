"use client";

import type { CSSProperties } from "react";

type Props = { deviceKey: string; label?: string; className?: string };

const deviceNames: Record<string, string> = {
  tensiometre: "Tensiomètre de bras",
  thermometre: "Thermomètre numérique",
  oxymetre: "Oxymètre de doigt",
  glucometre: "Glucomètre",
  balance: "Balance",
  capteur_cardiaque_bluetooth: "Capteur cardiaque",
  podometre: "Podomètre",
  ecg: "Électrocardiographe portable",
  spirometre: "Spiromètre",
  peak_flow: "Débitmètre de pointe",
  balance_impedance: "Balance impédancemètre",
  cholesterolometre: "Lecteur de cholestérol",
  cetonemetre: "Lecteur de cétones",
  uricometre: "Lecteur d’acide urique",
  montre_connectee: "Montre connectée",
  bracelet_activite: "Bracelet d’activité",
  tracker_sommeil: "Capteur de sommeil",
  thermometre_infrarouge: "Thermomètre infrarouge",
  capteur_respiration: "Capteur respiratoire",
  pilulier_connecte: "Pilulier connecté",
  bouteille_hydratation: "Bouteille connectée",
};

const shell: CSSProperties = { fill: "#FDFEFE", stroke: "#A8B8C8", strokeWidth: 3, strokeLinejoin: "round" };
const screen: CSSProperties = { fill: "#DCEBF2", stroke: "#8DA6B7", strokeWidth: 2 };
const ink: CSSProperties = { fill: "none", stroke: "#31536B", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" };
const accent: CSSProperties = { fill: "#18865A" };

function DeviceShape({ deviceKey }: { deviceKey: string }) {
  switch (deviceKey) {
    case "tensiometre":
      return <><rect x="76" y="62" width="148" height="154" rx="24" style={shell}/><rect x="96" y="82" width="108" height="68" rx="10" style={screen}/><path d="M112 124h18l9-20 13 34 10-18h25" style={ink}/><circle cx="150" cy="181" r="15" style={{...accent,stroke:"#0D6844",strokeWidth:2}}/><path d="M76 120H48v84q0 22 22 22h25" style={ink}/><path d="M224 120h18v82q0 24-24 24h-18" style={ink}/></>;
    case "thermometre":
      return <><rect x="102" y="54" width="96" height="174" rx="42" style={shell}/><rect x="119" y="78" width="62" height="48" rx="8" style={screen}/><path d="M132 105h35" style={ink}/><circle cx="150" cy="177" r="23" style={{...shell,fill:"#E7F4EF"}}/><path d="M150 177V92" stroke="#D65B58" strokeWidth="6" strokeLinecap="round"/><circle cx="150" cy="177" r="10" fill="#D65B58"/></>;
    case "oxymetre":
      return <><path d="M94 74q0-20 22-20h68q22 0 22 20v126q0 24-24 24h-64q-24 0-24-24z" style={shell}/><rect x="111" y="79" width="78" height="58" rx="10" style={screen}/><path d="M123 116l15-15 13 12 13-18 13 12" style={{...ink,stroke:"#18865A"}}/><path d="M108 160q42 26 84 0" style={ink}/><circle cx="150" cy="184" r="7" style={accent}/></>;
    case "glucometre": case "cholesterolometre": case "cetonemetre": case "uricometre":
      return <><rect x="91" y="47" width="118" height="185" rx="22" style={shell}/><rect x="109" y="68" width="82" height="70" rx="8" style={screen}/><path d="M122 119h55" style={ink}/><circle cx="150" cy="177" r="13" style={{...shell,fill:"#E7F4EF"}}/><path d="M150 232v27" style={{...ink,strokeWidth:5}}/><rect x="143" y="252" width="14" height="36" rx="3" fill="#F5FAFC" stroke="#8DA6B7" strokeWidth="2"/><path d="M143 261h14" stroke="#D65B58" strokeWidth="3"/></>;
    case "balance": case "balance_impedance":
      return <><rect x="45" y="83" width="210" height="145" rx="26" style={shell}/><rect x="119" y="101" width="62" height="37" rx="7" style={screen}/><path d="M132 126h36" style={ink}/><path d="M75 166q16-18 32 0M193 166q16-18 32 0" style={ink}/><circle cx="90" cy="194" r="9" fill="#B7C8D3"/><circle cx="210" cy="194" r="9" fill="#B7C8D3"/></>;
    case "capteur_cardiaque_bluetooth":
      return <><path d="M52 144q0-40 42-40h112q42 0 42 40t-42 40H94q-42 0-42-40z" style={{...shell,fill:"#E9F2F7"}}/><rect x="112" y="106" width="76" height="76" rx="20" style={shell}/><path d="M124 146h12l8-17 13 34 9-17h12" style={{...ink,stroke:"#D65B58"}}/></>;
    case "podometre":
      return <><rect x="98" y="68" width="104" height="154" rx="22" style={shell}/><rect x="115" y="88" width="70" height="58" rx="8" style={screen}/><path d="M128 128h44" style={ink}/><circle cx="150" cy="178" r="11" style={accent}/><path d="M98 85H76v36h22M202 85h22v36h-22" style={ink}/></>;
    case "ecg":
      return <><rect x="48" y="70" width="204" height="145" rx="18" style={shell}/><rect x="66" y="87" width="168" height="83" rx="8" style={screen}/><path d="M76 132h28l12-22 17 43 17-31 13 10h59" style={{...ink,stroke:"#D65B58"}}/><circle cx="91" cy="191" r="8" style={accent}/><circle cx="119" cy="191" r="8" fill="#A8B8C8"/><path d="M150 215v28m-38 0h76" style={ink}/></>;
    case "spirometre": case "peak_flow":
      return <><path d="M128 48h44v48h24q17 0 17 18v82q0 18-18 18h-90q-18 0-18-18v-82q0-18 18-18h23z" style={shell}/><rect x="116" y="115" width="68" height="44" rx="7" style={screen}/><path d="M130 140h40" style={ink}/><path d="M150 214v40h30" style={{...ink,strokeWidth:7}}/><path d="M180 254h38" style={{...ink,strokeWidth:7}}/></>;
    case "montre_connectee":
      return <><path d="M123 32h54l8 54h-70zM115 214h70l-8 58h-54z" fill="#A8B8C8"/><rect x="91" y="78" width="118" height="146" rx="30" style={{...shell,fill:"#243746"}}/><rect x="104" y="91" width="92" height="120" rx="22" fill="#E6F3F1"/><path d="M118 151q16-24 32 0t28 0" style={{...ink,stroke:"#18865A"}}/><circle cx="150" cy="177" r="5" style={accent}/></>;
    case "bracelet_activite":
      return <><path d="M112 38h76l-7 67h-62zM119 199h62l7 67h-76z" fill="#A8B8C8"/><rect x="100" y="90" width="100" height="125" rx="28" style={{...shell,fill:"#263B4B"}}/><rect x="113" y="105" width="74" height="94" rx="18" fill="#E6F3F1"/><path d="M127 153h46" style={ink}/><circle cx="150" cy="137" r="8" style={accent}/></>;
    case "tracker_sommeil":
      return <><rect x="70" y="84" width="160" height="112" rx="24" style={shell}/><path d="M174 103a38 38 0 1 0 37 59 43 43 0 0 1-37-59z" fill="#E5B85C"/><path d="M92 173q18-23 36 0t36 0" style={ink}/><circle cx="103" cy="111" r="4" fill="#7D9CB0"/><circle cx="126" cy="101" r="3" fill="#7D9CB0"/></>;
    case "thermometre_infrarouge":
      return <><path d="M72 167q0-25 24-37l89-45q20-10 31 10l14 27q10 20-10 31l-88 48q-24 13-42-5z" style={shell}/><rect x="155" y="99" width="42" height="30" rx="6" transform="rotate(-27 155 99)" style={screen}/><path d="M95 163l-24 16M89 150l-25 2" style={{...ink,stroke:"#D65B58"}}/><circle cx="130" cy="166" r="8" style={accent}/></>;
    case "capteur_respiration":
      return <><rect x="82" y="88" width="136" height="104" rx="32" style={shell}/><path d="M150 88v-35q0-12 12-12h24" style={ink}/><path d="M105 142q22-25 45 0t45 0" style={{...ink,stroke:"#18865A"}}/><circle cx="150" cy="168" r="7" style={accent}/></>;
    case "pilulier_connecte":
      return <><rect x="45" y="94" width="210" height="120" rx="22" style={shell}/>{Array.from({length:7},(_,i)=><g key={i}><rect x={56+i*28} y="109" width="23" height="89" rx="7" fill={i===2?"#DFF1E8":"#EAF1F5"} stroke="#A8B8C8" strokeWidth="1.5"/><path d={`M${59+i*28} 153h17`} stroke="#A8B8C8" strokeWidth="1.5"/></g>)}<circle cx="150" cy="82" r="9" style={accent}/></>;
    case "bouteille_hydratation":
      return <><path d="M128 48h44v30l17 18v123q0 22-22 22h-34q-22 0-22-22V96l17-18z" style={shell}/><rect x="125" y="40" width="50" height="16" rx="5" fill="#A8B8C8"/><path d="M112 157q38-13 76 0v56q0 16-16 16h-44q-16 0-16-16z" fill="#DCEFEA"/><path d="M125 174h50" style={{...ink,stroke:"#18865A"}}/></>;
    default:
      return <><rect x="70" y="70" width="160" height="160" rx="28" style={shell}/><rect x="94" y="94" width="112" height="70" rx="10" style={screen}/><path d="M112 132h76" style={ink}/><circle cx="150" cy="190" r="13" style={accent}/></>;
  }
}

export function DeviceIllustration({ deviceKey, label, className = "" }: Props) {
  return (
    <div className={`grid h-full w-full place-items-center overflow-hidden ${className}`} role="img" aria-label={label || deviceNames[deviceKey] || "Illustration d’un dispositif de suivi"}>
      <svg viewBox="0 0 300 300" className="h-full w-full" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`device-bg-${deviceKey}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F8FBFF" />
            <stop offset="100%" stopColor="#E8F1F7" />
          </linearGradient>
          <filter id={`device-shadow-${deviceKey}`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#7892A5" floodOpacity=".16" />
          </filter>
        </defs>
        <rect x="0" y="0" width="300" height="300" rx="28" fill={`url(#device-bg-${deviceKey})`} />
        <ellipse cx="150" cy="252" rx="92" ry="13" fill="#B7C9D5" opacity=".28" />
        <g filter={`url(#device-shadow-${deviceKey})`}><DeviceShape deviceKey={deviceKey} /></g>
        <circle cx="244" cy="54" r="17" fill="#E1F2E9" />
        <path d="M237 54h14M244 47v14" stroke="#18865A" strokeWidth="2.5" strokeLinecap="round" opacity=".7" />
      </svg>
    </div>
  );
}
