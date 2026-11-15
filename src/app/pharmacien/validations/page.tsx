import { redirect } from "next/navigation";

export default function LegacyPharmacienValidationsPage(){
  redirect("/pharmacie/pharmacien/ordonnances");
}
