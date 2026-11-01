export type FicheIA={description:string;indications:string;precautions:string}; type Produit={nom:string;dci:string;dosage:string;forme:string};
const CONSIGNE=`Tu rédiges une fiche d'information pour un médicament, en français très simple (niveau collège), pour le grand public au Cameroun.
Règles strictes :
- Réponds uniquement avec un objet JSON : {"description": "...", "indications": "...", "precautions": "..."}.
- description : 1 à 2 phrases.
- indications : 1 à 2 phrases.
- precautions : 2 à 3 phrases.
- N'indique JAMAIS de dose, de nombre de comprimés ni de durée de traitement.
- N'invente rien. Si tu n'es pas sûr, écris "Information à vérifier avec un pharmacien."`;
const coupe=(s:unknown,n:number)=>String(s??"").replace(/\s+/g," ").trim().slice(0,n);
export async function genererFiche(p:Produit):Promise<FicheIA>{const cle=process.env.GEMINI_API_KEY||process.env.Gemini_API_Key;if(!cle)throw new Error("IA non configurée (GEMINI_API_KEY manquante)");const modele=process.env.IA_MODELE||"gemini-2.5-flash";const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":cle},body:JSON.stringify({systemInstruction:{parts:[{text:CONSIGNE}]},contents:[{role:"user",parts:[{text:`Médicament : ${p.nom} ${p.dosage}. Molécule : ${p.dci||"inconnue"}. Forme : ${p.forme||"inconnue"}.`}]}],generationConfig:{responseMimeType:"application/json",temperature:.2,maxOutputTokens:700}})});if(res.status===429)throw new Error("Quota gratuit de l'IA atteint. Réessayez plus tard.");if(!res.ok)throw new Error(`Erreur de l'IA (${res.status})`);const json=await res.json();const texte:string=json?.candidates?.[0]?.content?.parts?.[0]?.text??"";const donnees=JSON.parse(texte.replace(/\`\`\`json|\`\`\`/g,"").trim());return{description:coupe(donnees.description,400),indications:coupe(donnees.indications,400),precautions:coupe(donnees.precautions,600)}}