export type RechercheMock = {
  id: string; nom: string; medicament: string; quantite: number; prix: number;
  distanceKm: number; quartier: string; ville: string; note: number; avis: number;
  promo?: string; livraison?: string; ouvert24h?: boolean;
};
export const RECHERCHE_CLIENT_MOCK: RechercheMock[] = [
 {id:"mock-gare",nom:"Pharmacie de la Gare",medicament:"Paracétamol 500mg",quantite:8,prix:1500,distanceKm:0.8,quartier:"Bonanjo",ville:"Douala",note:4.6,avis:128,promo:"Promo -5%"},
 {id:"mock-bonapriso",nom:"Pharmacie Bonapriso",medicament:"Paracétamol 500mg",quantite:5,prix:1700,distanceKm:1.1,quartier:"Bonapriso",ville:"Douala",note:4.4,avis:92,livraison:"Livraison en 20 min"},
 {id:"mock-plateau",nom:"Pharmacie du Plateau",medicament:"Paracétamol 500mg",quantite:3,prix:1900,distanceKm:1.6,quartier:"Plateau",ville:"Douala",note:4.8,avis:210,ouvert24h:true}
];
