"use client";
import { ActionProtegee } from "@/components/ActionProtegee";
import { usePathname } from "next/navigation";
import { usePanier } from "@/lib/panier";
const MASQUE_EXACTS=["/","/recherche","/resultats","/scanner","/panier","/gardes","/client","/client/posologie"];
const MASQUE_PREFIXES=["/admin","/pharmacie","/connexion","/reservation/","/client/profil/","/produit/","/offre/"];
export function BoutonPanier(){
 const chemin=usePathname();const{nombre,pret}=usePanier();
 if(!pret||nombre===0||MASQUE_EXACTS.includes(chemin)||MASQUE_PREFIXES.some(p=>chemin.startsWith(p)))return null;
 return <ActionProtegee href="/panier" className="no-print btn btn-canari fixed bottom-4 right-4 z-40 shadow-lg" aria-label={`Mon panier, ${nombre} produit${nombre>1?"s":""}`}>Mon panier <span className="rounded-full bg-naxa-green-900 px-2 text-sm text-white">{nombre}</span></ActionProtegee>;
}