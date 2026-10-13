export function BandeauHorsLigne({etat,attente=0}:{etat:"hors-ligne"|"attente"|"synchronise";attente?:number}) {
 const config={ "hors-ligne":{texte:"Hors ligne",point:"#8B9290"},"attente":{texte:`En attente d’envoi (${attente})`,point:"#FFE33D"},"synchronise":{texte:"Synchronisé",point:"#0A6B3A"} }[etat];
 return <div role="status" className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#D8E9DE] bg-white px-3 text-xs font-bold text-[#064B2A]"><span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor:config.point}}/><span>{config.texte}</span></div>;
}
