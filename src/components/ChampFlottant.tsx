"use client";
import type { ChangeEvent, ReactNode, CSSProperties, Ref } from "react";
import { CocheValidation } from "@/components/CocheValidation";
type Props = {
  id: string; label: string; value: string; onChange: (value: string) => void;
  type?: string; autoComplete?: string; required?: boolean; maxLength?: number;
  inputMode?: "text" | "numeric" | "tel" | "email" | "decimal" | "search" | "url" | "none";
  helper?: string; valid?: boolean; validColor?: string; delayMs?: number; revealDelayMs?: number;
  prefix?: ReactNode; trailing?: ReactNode; min?: string; max?: string;
  onBlur?: () => void; disabled?: boolean; name?: string; className?: string; minHeight?: number; inset?: number; pattern?: string; inputRef?: Ref<HTMLInputElement>;
};
export function ChampFlottant({id,label,value,onChange,type="text",autoComplete,required,maxLength,inputMode,helper,valid=false,validColor="#FFE33D",delayMs=0,revealDelayMs=0,prefix,trailing,min,max,onBlur,disabled,name,className="",minHeight=52,inset=14,pattern,inputRef}:Props) {
  const filled=Boolean(value);
  return <div className={`naxa-field ${className}`} data-filled={filled ? "true":"false"} style={{"--reveal-delay":`${delayMs}ms`,"--naxa-reveal-delay":`${revealDelayMs}ms`} as CSSProperties}>
    {prefix && <span className="absolute left-2 top-1/2 z-10 -translate-y-1/2">{prefix}</span>}
    <input ref={inputRef} id={id} name={name} className="naxa-field-control" style={{minHeight,paddingLeft:prefix ? "94px":`${inset}px`,paddingTop:minHeight>52?"24px":undefined}} aria-label={label} type={type} value={value} onChange={(e:ChangeEvent<HTMLInputElement>)=>onChange(e.target.value)} autoComplete={autoComplete} required={required} maxLength={maxLength} inputMode={inputMode} pattern={pattern} min={min} max={max} onBlur={onBlur} disabled={disabled}/>
    <label htmlFor={id} className="naxa-field-label" style={{left:prefix ? "94px":`${inset}px`}}>{label}</label>
    <CocheValidation couleur={validColor} visible={valid} right={type==="date"?"42px":"14px"}/>
    {trailing && <span className="absolute right-3 top-1/2 z-10 -translate-y-1/2">{trailing}</span>}
    {helper && <span className="naxa-field-helper">{helper}</span>}
  </div>;
}
