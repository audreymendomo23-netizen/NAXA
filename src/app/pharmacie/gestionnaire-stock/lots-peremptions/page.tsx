import { GestionnaireStockEspace } from "@/components/pharmacie/GestionnaireStockEspace";
export default async function Page({searchParams}:{searchParams?: Promise<{page?:string;ok?:string;erreur?:string}>}){
  const filters = await searchParams;const parsed=Number.parseInt(filters?.page??"1",10);return <GestionnaireStockEspace section="lots-peremptions" page={Number.isSafeInteger(parsed)&&parsed>0?parsed:1} ok={filters?.ok} erreur={filters?.erreur}/>;}
