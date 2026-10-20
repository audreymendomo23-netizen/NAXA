import { GestionnaireStockEspace } from "@/components/pharmacie/GestionnaireStockEspace";
export default function Page({searchParams}:{searchParams?:{page?:string}}){const parsed=Number.parseInt(searchParams?.page??"1",10);return <GestionnaireStockEspace section="lots-peremptions" page={Number.isSafeInteger(parsed)&&parsed>0?parsed:1}/>;}
