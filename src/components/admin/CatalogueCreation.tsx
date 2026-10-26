"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { creerPharmacie } from "@/app/admin/actions";
import { rattacherServiceBebeMaman } from "@/app/admin/rattacher-service-bebe-maman";
import { creerDossierUnivers } from "@/app/admin/creation-univers-actions";
import { GeolocalisationChamps } from "@/components/admin/GeolocalisationChamps";
import { IdentificationPromoteur } from "@/components/admin/IdentificationPromoteur";

type Universe = "pharmacie" | "parapharmacie" | "bebe-maman" | "examens" | "prestations";
type PharmacyOption = { id: string; nom: string; ville: string | null; quartier: string | null };
type Props = {
  pharmacies: PharmacyOption[];
  initialUniverse?: string;
  ok?: string;
  erreur?: string;
  erreursChamps?: Record<string, string>;
};

const universes: { value: Universe; label: string; description: string }[] = [
  { value: "pharmacie", label: "Pharmacie", description: "une pharmacie" },
  { value: "parapharmacie", label: "Parapharmacie", description: "une parapharmacie" },
  { value: "bebe-maman", label: "Bébé & Maman", description: "le service Bébé & Maman dans une pharmacie partenaire" },
  { value: "examens", label: "Examens médicaux", description: "un centre d’examens médicaux" },
  { value: "prestations", label: "Prestations à domicile", description: "un partenaire de prestations à domicile" },
];

const field = "champ mt-1 w-full";
const documents = [
  ["piece_existence_legale", "Pièce d’existence légale"],
  ["registre_commerce", "Registre de commerce"],
  ["niu", "Numéro d’identifiant unique (NIU)"],
  ["attestation_non_redevance", "Attestation de non-redevance"],
  ["plan_localisation", "Plan de localisation"],
  ["cni_promoteur", "CNI du Promoteur"],
] as const;

const errorText: Record<string, string> = {
  compte: "Le compte du Promoteur n’a pas pu être créé. Vérifiez l’e-mail et le nom d’utilisateur.",
  pharmacie: "La pharmacie n’a pas pu être créée.",
  profil: "Les informations privées n’ont pas pu être enregistrées.",
  documents: "Les pièces reçues n’ont pas pu être enregistrées.",
  convention: "La convention n’a pas pu être créée.",
  architecture: "L’architecture n’a pas pu être attribuée.",
  abonnement: "L’abonnement n’a pas pu être créé.",
  reseau: "Le rattachement du Promoteur à la pharmacie a échoué.",
  dossier: "Le dossier n’a pas pu être créé. Le compte provisoire a été supprimé si la création métier a échoué.",
  canal_unique: "La création initiale est centralisée dans le Catalogue NAXA. Utilisez le formulaire unique ci-dessous.",
  pharmacie_parrainage: "Choisissez une pharmacie partenaire active et visible dans la recherche.",
  service_bebe_maman: "Le service n’a pas pu être rattaché. Vérifiez que la migration de gestion des services est disponible.",
  canal_unique: "La création initiale est centralisée dans le Catalogue NAXA. Utilisez le formulaire unique ci-dessous.",
};

export function CatalogueCreation({ pharmacies, initialUniverse, ok, erreur, erreursChamps = {} }: Props) {
  const [selected, setSelected] = useState<Universe | "">("");
  const [confirmed, setConfirmed] = useState<Universe | "">("");
  const [pharmacyQuery, setPharmacyQuery] = useState("");
  const [selectedPharmacy, setSelectedPharmacy] = useState<PharmacyOption | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialUniverse && universes.some((u) => u.value === initialUniverse)) {
      setSelected(initialUniverse as Universe);
      setConfirmed(initialUniverse as Universe);
    }
  }, [initialUniverse]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const matches = useMemo(() => {
    const query = pharmacyQuery.trim().toLocaleLowerCase("fr");
    if (!query) return [];
    return pharmacies.filter((p) =>
      [p.nom, p.ville ?? "", p.quartier ?? ""].join(" ").toLocaleLowerCase("fr").includes(query)
    ).slice(0, 8);
  }, [pharmacies, pharmacyQuery]);

  const current = universes.find((u) => u.value === confirmed);
  const submitAction = confirmed === "pharmacie" ? creerPharmacie : creerDossierUnivers;

  return <section className="carte space-y-4" aria-labelledby="creation-univers-title">
    <div>
      <p className="text-xs font-extrabold uppercase tracking-widest text-teal-700">Catalogue NAXA</p>
      <h2 id="creation-univers-title" className="text-xl font-extrabold">Créer / configurer un univers</h2>
      <p className="mt-1 text-sm text-slate-600">Choisissez l’écosystème concerné, puis validez votre choix pour afficher la fiche adaptée. Une création indépendante ouvre un dossier en attente : elle ne publie pas automatiquement le catalogue.</p><div className="flex flex-col gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><p><strong>Parcours unifié :</strong> ouvrir le dossier ici, le contrôler et le valider dans Dossier Promoteur, puis gérer la publication dans Univers &amp; catalogue.</p><Link href="/admin/promoteurs" className="shrink-0 font-extrabold text-naxa-green-900 underline">Dossiers à examiner →</Link></div>
    </div>

    {ok && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{ok === "dossier" ? "Dossier partenaire créé et placé en attente de vérification." : "Dossier créé. Les pièces cochées correspondent uniquement aux pièces reçues."}</p>}
    {erreur && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <p className="font-bold">{errorText[erreur] ?? (erreur === "validation" ? "Vérifiez les champs signalés dans le formulaire." : "L’opération n’a pas abouti. Aucun succès n’est confirmé.")}</p>
      {Object.keys(erreursChamps).length > 0 && <ul className="mt-2 list-disc pl-5">{Object.entries(erreursChamps).map(([key, message]) => <li key={key}><strong>{key} :</strong> {message}</li>)}</ul>}
    </div>}

    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <label className="block min-w-0 text-sm font-semibold">Univers
        <select value={selected} onChange={(event) => { setSelected(event.target.value as Universe | ""); setConfirmed(""); }} required className={field}>
          <option value="">Choisir un univers…</option>
          {universes.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
      </label>
      <button type="button" disabled={!selected} onClick={() => { setConfirmed(selected); setSelectedPharmacy(null); setPharmacyQuery(""); setSuggestionsOpen(false); }} className="min-h-11 rounded-xl border-2 border-[#FFE23D] bg-[#FFE23D] px-6 py-3 font-extrabold text-[#0B3D26] shadow-sm hover:bg-[#f5d900] disabled:cursor-not-allowed disabled:opacity-50">VALIDER</button>
    </div>

    {!confirmed && <p className="text-xs text-slate-500">La fiche ne s’affiche qu’après avoir cliqué sur VALIDER. Dispositifs médicaux reste un service NAXA et n’est pas une création d’établissement.</p>}

    {current && confirmed === "bebe-maman" && <div className="space-y-4 rounded-2xl border border-[#FFE23D] bg-white p-4">
      <h3 className="text-lg font-extrabold">Activer le service <span className="rounded bg-[#0B3D26] px-1 text-[#FFE23D]">Bébé &amp; Maman</span></h3>
      <p className="text-sm text-slate-600">Le service sera ajouté au dossier de la pharmacie choisie. Aucune pharmacie ni aucun dossier Promoteur autonome ne sera créé.</p>
      <form action={rattacherServiceBebeMaman} className="space-y-3">
        <div ref={suggestionsRef} className="relative">
          <label className="block text-sm font-semibold">Entrer la pharmacie de parrainage
            <input value={pharmacyQuery} onChange={(event) => { setPharmacyQuery(event.target.value); setSelectedPharmacy(null); setSuggestionsOpen(true); }} onFocus={() => setSuggestionsOpen(true)} autoComplete="off" placeholder="Saisir le nom d’une pharmacie partenaire…" className={field} required aria-expanded={suggestionsOpen && matches.length > 0} aria-controls="pharmacie-parrainage-options"/>
          </label>
          {suggestionsOpen && matches.length > 0 && <ul id="pharmacie-parrainage-options" role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
            {matches.map((p) => <li key={p.id} role="option" aria-selected={selectedPharmacy?.id === p.id}>
              <button type="button" onClick={() => { setSelectedPharmacy(p); setPharmacyQuery(p.nom); setSuggestionsOpen(false); }} className="w-full rounded-lg px-3 py-3 text-left hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D26]">
                <span className="block font-bold">{p.nom}</span><span className="block text-xs text-slate-500">{[p.quartier, p.ville].filter(Boolean).join(" · ")}</span>
              </button>
            </li>)}
          </ul>}
          {suggestionsOpen && pharmacyQuery.trim() && matches.length === 0 && <p className="mt-2 text-sm text-slate-500">Aucune pharmacie partenaire active correspondante.</p>}
        </div>
        {selectedPharmacy && <p className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Pharmacie sélectionnée : {selectedPharmacy.nom} · {[selectedPharmacy.quartier, selectedPharmacy.ville].filter(Boolean).join(" · ")}</p>}
        <input type="hidden" name="pharmacie_id" value={selectedPharmacy?.id ?? ""}/>
        <button disabled={!selectedPharmacy} className="min-h-11 w-full rounded-xl border-2 border-[#FFE23D] bg-[#FFE23D] px-4 py-3 font-extrabold text-[#0B3D26] disabled:cursor-not-allowed disabled:opacity-50">Valider le rattachement</button>
      </form>
    </div>}

    {current && confirmed !== "bebe-maman" && <form action={submitAction} className="space-y-4 rounded-2xl border bg-white p-4 sm:p-5">
      <input type="hidden" name="universe_slug" value={confirmed}/>
      <h3 className="text-xl font-extrabold">Créer <span className="rounded bg-[#0B3D26] px-1 text-[#FFE23D]">{current.description}</span></h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Nom<input name="nom" required maxLength={160} className={field}/></label>
        <label className="block text-sm font-semibold">Ville<input name="ville" required defaultValue="Yaoundé" className={field}/></label>
        <label className="block text-sm font-semibold">Quartier<input name="quartier" className={field}/></label>
        <label className="block text-sm font-semibold">Adresse<input name="adresse" required minLength={2} className={field}/></label>
      </div>
      <GeolocalisationChamps className={field}/>
      <label className="block text-sm font-semibold">WhatsApp<input name="whatsapp" required inputMode="numeric" className={field}/></label>
      <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-base font-bold">Documentation fournie par l’établissement</legend>
        <p className="text-sm text-slate-600">Cochez uniquement les pièces reçues dans le dossier.</p>
        {documents.map(([name, label]) => <label key={name} className="flex items-center gap-3 text-sm"><input type="checkbox" name={name} value="oui" className="h-4 w-4 rounded border-slate-300"/><span>{label}</span></label>)}
      </fieldset>
      <div className="border-t pt-3"><h4 className="text-lg font-bold">Identification du Promoteur</h4><p className="mt-1 text-sm text-slate-600">Le dossier est créé en attente de vérification ; les informations du Promoteur restent rattachées à l’établissement.</p></div>
      <label className="block text-sm font-semibold">Tarif mensuel convenu (FCFA)<input name="montant_mensuel" type="number" min="1" step="1" required className={field}/></label>
      {confirmed === "pharmacie" && <label className="block text-sm font-semibold">Architecture attribuée<select name="architecture_code" required defaultValue="ORPHELIN" className={field}><option value="ORPHELIN">ORPHELIN — 1 Caisse</option><option value="PARENTS_ENFANTS">PARENTS → ENFANTS — jusqu’à 5 Caisses</option><option value="PARENTS_AINES_CADETS">PARENTS → AÎNÉS → CADETS — jusqu’à 5 Responsables et 5 Caisses</option><option value="HYBRIDE">HYBRIDE — rôles composables</option></select></label>}
      {confirmed === "parapharmacie" && <label className="block text-sm font-semibold">Architecture attribuée<select name="architecture_code" required defaultValue="ORPHELIN" className={field}><option value="ORPHELIN">ORPHELIN — 1 Caisse</option><option value="PARENTS_ENFANTS">PARENTS → ENFANTS — jusqu’à 5 Caisses</option><option value="PARENTS_AINES_CADETS">PARENTS → AÎNÉS → CADETS — jusqu’à 5 Responsables et 5 Caisses</option><option value="HYBRIDE">HYBRIDE — rôles composables</option></select></label>}
      <IdentificationPromoteur className={field} errors={erreursChamps}/>
      <button className="min-h-12 w-full rounded-xl bg-[#0B3D26] px-4 py-3 font-extrabold text-white">{confirmed === "pharmacie" ? "Ouvrir le Dossier" : "Créer le dossier"}</button>
    </form>}
    <p className="text-xs text-slate-500">Les univers proposés sont les espaces définis dans NAXA. La création d’un univers indépendant est enregistrée en attente de vérification. « Dispositifs médicaux » n’est pas une création d’établissement.</p>
  </section>;
}
