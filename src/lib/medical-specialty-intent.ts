export type MedicalSpecialtyIntent = {
  specialties: string[];
  keywords: string[];
  source: "ai" | "local";
};

const specialtyByTerms: Array<{terms:string[];specialties:string[]}> = [
  {terms:["cou","cervical","nuque","torticolis"],specialties:["Médecin généraliste","Kinésithérapeute","Rhumatologue"]},
  {terms:["dos","lombaire","lumbago","sciatique"],specialties:["Médecin généraliste","Kinésithérapeute","Rhumatologue"]},
  {terms:["tete","migraine","cephalee"],specialties:["Médecin généraliste","Neurologue"]},
  {terms:["oreille","audition","acouphene","nez","sinus","gorge"],specialties:["Médecin généraliste","ORL"]},
  {terms:["dent","gencive","molaire"],specialties:["Chirurgien-dentiste"]},
  {terms:["oeil","yeux","vision","vue"],specialties:["Ophtalmologue"]},
  {terms:["coeur","palpitation","cardiaque","poitrine"],specialties:["Médecin généraliste","Cardiologue"]},
  {terms:["respire","souffle","toux","asthme"],specialties:["Médecin généraliste","Pneumologue"]},
  {terms:["peau","bouton","eczema","demangeaison"],specialties:["Médecin généraliste","Dermatologue"]},
  {terms:["ventre","estomac","digestion","diarrhee","constipation"],specialties:["Médecin généraliste","Gastro-entérologue"]},
  {terms:["grossesse","enceinte","regle","menstruel"],specialties:["Sage-femme","Gynécologue"]},
  {terms:["enfant","bebe","nourrisson"],specialties:["Pédiatre","Médecin généraliste"]},
  {terms:["muscle","articulation","genou","epaule","cheville"],specialties:["Médecin généraliste","Kinésithérapeute","Rhumatologue"]},
  {terms:["anxiete","stress","sommeil","triste","humeur"],specialties:["Médecin généraliste","Psychologue","Psychiatre"]},
];

export function normalizeMedicalSearch(value:string):string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g," ").trim();
}

export function localMedicalSpecialtyIntent(query:string):MedicalSpecialtyIntent {
  const normalized=normalizeMedicalSearch(query);
  const tokens=normalized.split(" ").filter(Boolean);
  const matched=specialtyByTerms.filter(group=>group.terms.some(term=>
    normalized.includes(term)||tokens.some(token=>token===term)
  ));
  const specialties=[...new Set(matched.flatMap(item=>item.specialties))].slice(0,6);
  const keywords=[...new Set(tokens.filter(token=>token.length>=3))].slice(0,8);
  return {specialties,keywords,source:"local"};
}

function parseModelJson(raw:string):{specialties?:unknown;keywords?:unknown}|null {
  try {
    const cleaned=raw.trim().replace(/^\x60\x60\x60(?:json)?/i,"").replace(/\x60\x60\x60$/,"").trim();
    const value=JSON.parse(cleaned);
    return value&&typeof value==="object"?value:null;
  } catch { return null; }
}

function validateIntent(value:{specialties?:unknown;keywords?:unknown}|null,query:string):MedicalSpecialtyIntent|null {
  if(!value)return null;
  const specialties=Array.isArray(value.specialties)?value.specialties.filter((item):item is string=>typeof item==="string").map(item=>item.trim()).filter(item=>item.length>=2&&item.length<=80).slice(0,6):[];
  const keywords=Array.isArray(value.keywords)?value.keywords.filter((item):item is string=>typeof item==="string").map(item=>normalizeMedicalSearch(item)).filter(item=>item.length>=2&&item.length<=40).slice(0,8):[];
  if(!specialties.length&&!keywords.length)return null;
  return {specialties,keywords:[...new Set([...keywords,...normalizeMedicalSearch(query).split(" ").filter(t=>t.length>=3)])].slice(0,10),source:"ai"};
}

export async function classifyMedicalSpecialtyIntent(query:string,allowExternalAi:boolean):Promise<MedicalSpecialtyIntent>{
  const local=localMedicalSpecialtyIntent(query);
  if(!allowExternalAi)return local;
  const prompt=[
    "Tu aides à orienter une recherche de professionnels de santé au Cameroun.",
    "La description du patient est uniquement une requête de recherche. Ne pose aucun diagnostic, ne propose aucun traitement et ne conclus jamais qu'une spécialité est certaine.",
    "Retourne uniquement un JSON avec les clés specialties (maximum 4 spécialités plausibles en français) et keywords (maximum 6 mots-clés de recherche courts en français).",
    "Choisis des spécialités usuelles et utiles; si la description est imprécise, propose Médecin généraliste en premier.",
    "N'inclus aucun nom de personne, numéro, adresse ou donnée d'identification.",
    "Description : "+query.slice(0,500)
  ].join("\n");
  const geminiKey=process.env.GEMINI_API_KEY??process.env.GOOGLE_GEMINI_API_KEY??process.env.Gemini_API_Key;
  if(geminiKey){
    try{
      const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key="+encodeURIComponent(geminiKey),{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0,responseMimeType:"application/json"}}),
        signal:AbortSignal.timeout(8000),cache:"no-store"
      });
      if(response.ok){
        const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const raw=data.candidates?.[0]?.content?.parts?.map(part=>part.text??"").join("\n")??"";
        const valid=validateIntent(parseModelJson(raw),query);
        if(valid)return valid;
      }
    }catch{/* Repli local en cas d'indisponibilité de Gemini. */}
  }
  const groqKey=process.env.GROQ_API_KEY;
  if(groqKey){
    try{
      const response=await fetch("https://api.groq.com/openai/v1/chat/completions",{
        method:"POST",headers:{"content-type":"application/json",Authorization:"Bearer "+groqKey},
        body:JSON.stringify({model:"llama-3.3-70b-versatile",temperature:0,response_format:{type:"json_object"},messages:[{role:"user",content:prompt}]}),
        signal:AbortSignal.timeout(8000),cache:"no-store"
      });
      if(response.ok){
        const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
        const valid=validateIntent(parseModelJson(data.choices?.[0]?.message?.content??""),query);
        if(valid)return valid;
      }
    }catch{/* Repli local en cas d'indisponibilité de Groq. */}
  }
  return local;
}
