"use client";
import type { ChangeEvent, ReactNode, CSSProperties, Ref } from "react";
type Props = {
  id: string; label: string; value: string; onChange: (value: string) => void;
  type?: string; autoComplete?: string; required?: boolean; maxLength?: number;
  inputMode?: "text" | "numeric" | "tel" | "email" | "decimal" | "search" | "url" | "none";
  helper?: string; valid?: boolean; validColor?: string; delayMs?: number;
  prefix?: ReactNode; trailing?: ReactNode; min?: string; max?: string;
  onBlur?: () => void; disabled?: boolean; name?: string; className?: string; minHeight?: number; inset?: number; pattern?: string; inputRef?: Ref<HTMLInputElement>;
};
export function ChampFlottant({id,label,value,onChange,type="text",autoComplete,required,maxLength,inputMode,helper,valid=false,validColor="#FFE33D",delayMs=0,prefix,trailing,min,max,onBlur,disabled,name,className="",minHeight=52,inset=14,pattern,inputRef}:Props) {
  const filled=Boolean(value);
  return <div className={`naxa-field ${className}`} data-filled={filled ? "true":"false"} style={{"--reveal-delay":`${delayMs}ms`} as CSSProperties}>
    {prefix && <span className="absolute left-2 top-1/2 z-10 -translate-y-1/2">{prefix}</span>}
    <input ref={inputRef} id={id} name={name} className="naxa-field-control" style={{minHeight,paddingLeft:prefix ? "94px":`${inset}px`,paddingTop:minHeight>52?"24px":undefined}} aria-label={label} type={type} value={value} onChange={(e:ChangeEvent<HTMLInputElement>)=>onChange(e.target.value)} autoComplete={autoComplete} required={required} maxLength={maxLength} inputMode={inputMode} pattern={pattern} min={min} max={max} onBlur={onBlur} disabled={disabled}/>
    <label htmlFor={id} className="naxa-field-label" style={{left:prefix ? "94px":`${inset}px`}}>{label}</label>
    <span className="naxa-check" data-visible={valid?"true":"false"} style={{backgroundColor:validColor,right:type==="date"?"42px":"14px"}} aria-label="Information valide"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8 3 3 7-7" stroke={validColor==="#FFE33D" ? "#064B2A":"#fff"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
    {trailing && <span className="absolute right-3 top-1/2 z-10 -translate-y-1/2">{trailing}</span>}
    {helper && <span className="naxa-field-helper">{helper}</span>}
  </div>;
}
