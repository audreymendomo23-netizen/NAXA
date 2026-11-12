import {PromoteurDashboard} from "../page";
export default async function PromoteurPage({searchParams}:{searchParams:Promise<{geo?:string}>}) {
 const query=await searchParams;
 return <PromoteurDashboard section="reseau" geoStatus={query.geo}/>;
}