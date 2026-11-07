"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { declarerCameraSecurite } from "@/app/pharmacie/promoteur/actions";

type PharmacyOption = { id: string; nom: string; ville: string | null; quartier: string | null };
type GatewayOption = { id: string; pharmacie_id: string; label: string; serial_number: string | null; firmware_version: string | null; tunnel_status: string };

const messages: Record<string, { tone: "success" | "warning" | "error"; text: string }> = {
  declared: { tone: "success", text: "La fiche caméra a été enregistrée dans l’inventaire. Elle n’est pas encore connectée." },
  journal: { tone: "warning", text: "La caméra a été enregistrée, mais le journal de sécurité n’a pas été confirmé. Contactez NAXA avant toute validation du pilote." },
  perimetre: { tone: "error", text: "Déclaration refusée : pharmacie, compte ou données d’équipement hors du périmètre autorisé." },
  registre: { tone: "error", text: "Le dossier d’installation n’a pas pu être créé ou lu. Aucun statut de connexion n’a été attribué." },
  passerelle: { tone: "error", text: "La passerelle sélectionnée n’appartient pas à cette pharmacie ou à son dossier d’installation." },
  passerelle_requise: { tone: "warning", text: "Indiquez le nom de la nouvelle passerelle ou sélectionnez une passerelle existante." },
  passerelle_echec: { tone: "error", text: "La fiche de passerelle n’a pas pu être enregistrée." },
  camera_echec: { tone: "error", text: "La passerelle peut avoir été déclarée, mais la fiche caméra n’a pas été créée. Vérifiez l’inventaire avant de recommencer." },
};

export function PromoteurSecurityInventoryForm({
  pharmacies,
  gateways,
}: {
  pharmacies: PharmacyOption[];
  gateways: GatewayOption[];
}) {
  const searchParams = useSearchParams();
  const [selectedPharmacyId, setSelectedPharmacyId] = useState(pharmacies[0]?.id ?? "");
  const [selectedGatewayId, setSelectedGatewayId] = useState("");
  const availableGateways = gateways.filter((gateway) => gateway.pharmacie_id === selectedPharmacyId);
  const currentMessage = messages[searchParams.get("security") ?? ""];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold">Inventaire des équipements</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Déclarez une caméra et sa passerelle pour préparer son raccordement. Cette opération ne lance aucune détection réseau et ne crée aucun flux vidéo.
          </p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">Inventaire uniquement</span>
      </div>

      {currentMessage && (
        <p role={currentMessage.tone === "success" ? "status" : "alert"}
          className={"mt-4 rounded-xl border p-3 text-sm " + (
            currentMessage.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-950" :
            currentMessage.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-950" :
            "border-red-200 bg-red-50 text-red-950"
          )}>
          {currentMessage.text}
        </p>
      )}

      {pharmacies.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Aucune pharmacie active et autorisée ne peut recevoir une nouvelle déclaration.</p>
      ) : (
        <form action={declarerCameraSecurite} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Pharmacie
              <select name="pharmacie_id" required value={selectedPharmacyId}
                onChange={(event) => { setSelectedPharmacyId(event.target.value); setSelectedGatewayId(""); }}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal">
                {pharmacies.map((pharmacy) => (
                  <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.nom} · {[pharmacy.quartier, pharmacy.ville].filter(Boolean).join(" · ")}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Passerelle / enregistreur
              <select name="gateway_id" value={selectedGatewayId} onChange={(event) => setSelectedGatewayId(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal">
                <option value="">Créer une fiche de passerelle à configurer</option>
                {availableGateways.map((gateway) => (
                  <option key={gateway.id} value={gateway.id}>{gateway.label} · {gateway.tunnel_status}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-bold">Nouvelle fiche de passerelle (si aucune n’est sélectionnée)</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <label className="block text-xs font-semibold text-slate-700">Nom / repère
                <input name="gateway_label" maxLength={100} placeholder="Ex. NVR principal"
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">Numéro de série
                <input name="gateway_serial_number" maxLength={100} placeholder="Facultatif"
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">Firmware passerelle
                <input name="gateway_firmware_version" maxLength={80} placeholder="Facultatif"
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal" />
              </label>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">La fiche créée reste en tunnel sortant non configuré. Elle ne prouve pas qu’une passerelle physique est déjà installée.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-sm font-semibold">Zone surveillée
              <input name="zone_label" required minLength={2} maxLength={100} placeholder="Ex. Entrée principale"
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal" />
            </label>
            <label className="block text-sm font-semibold">Fabricant caméra
              <input name="manufacturer" maxLength={80} placeholder="Ex. Hikvision"
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal" />
            </label>
            <label className="block text-sm font-semibold">Modèle
              <input name="model" maxLength={120} placeholder="Référence exacte"
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal" />
            </label>
            <label className="block text-sm font-semibold">Firmware caméra
              <input name="firmware_version" maxLength={80} placeholder="Facultatif si inconnu"
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal" />
            </label>
            <label className="block text-sm font-semibold">Canal / identifiant recorder
              <input name="channel_key" maxLength={80} placeholder="Ex. channel-01 (facultatif)"
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal" />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="max-w-xl text-xs leading-5 text-slate-500">Ne saisissez aucun mot de passe, token, URL RTSP ou secret dans ce formulaire. Les identifiants seront intégrés ultérieurement via un coffre sécurisé côté passerelle.</p>
            <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-full bg-naxa-green-900 px-5 py-2 text-sm font-extrabold text-white hover:bg-naxa-green-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naxa-green-700">
              Enregistrer la fiche caméra
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
