import { redirect } from "next/navigation";

// Ancienne URL conservée pour les favoris et liens historiques.
// Le poste Assistant pharmacien n'existe plus : tous accèdent à l'espace Pharmacien.
export default function AssistantPharmacienRedirect() {
  redirect("/pharmacie/pharmacien");
}
