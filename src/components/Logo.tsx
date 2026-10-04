export function Logo({ clair=true, taille=40 }: { clair?: boolean; taille?: number }) {
  const n=clair?"#FFE33D":"#0A6B3A"; const t=clair?"#FFFFFF":"#054A29";
  return <span className="inline-flex items-center gap-2" aria-label="NAXA"><svg width={taille} height={taille} viewBox="0 0 48 48" aria-hidden="true"><path d="M10 40V8h8l14 22V8h6v32h-8L16 18v22z" fill={n}/></svg><span className="text-3xl font-extrabold tracking-tight" style={{color:t}}>NAXA</span></span>;
}