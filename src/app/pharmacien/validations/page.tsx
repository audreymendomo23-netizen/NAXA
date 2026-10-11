"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Notification = { id: string; validation_id: string; type: "nouveau_dossier" | "decision" | "complement"; message: string; cree_le: string; lu_le: string | null; };

type Dossier = {
  id: string;
  pharmacie_id: string;
  type_document: "prescription" | "ordonnance" | "consultation";
  objet: string;
  soumis_par: string;
  document_storage_path: string;
  statut: "brouillon" | "en_attente" | "approuvee" | "refusee" | "complement_requis";
  decide_par: string | null;
  decision_commentaire: string | null;
  cree_le: string;
  soumis_le: string | null;
  decide_le: string | null;
};

const BUCKET = "naxa-validations-pharmaceutiques";
const TYPES = [
  { value: "prescription", label: "Prescription" },
  { value: "ordonnance", label: "Ordonnance" },
  { value: "consultation", label: "Consultation" },
] as const;

const STATUTS: Record<Dossier["statut"], string> = {
  brouillon: "Brouillon",
  en_attente: "En attente du pharmacien",
  approuvee: "Validée par le pharmacien",
  refusee: "Refusée",
  complement_requis: "Complément demandé",
};

export default function ValidationsPharmaceutiquesPage() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [userId, setUserId] = useState("");
  const [pharmacieId, setPharmacieId] = useState("");
  const [fonction, setFonction] = useState("");
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [type, setType] = useState<Dossier["type_document"]>("ordonnance");
  const [objet, setObjet] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);
  const [commentaires, setCommentaires] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [occupé, setOccupé] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    const { data: auth, error: authError } = await sb.auth.getUser();
    if (authError || !auth.user) {
      setErreur("Connectez-vous pour accéder aux validations pharmaceutiques.");
      setChargement(false);
      return;
    }
    setUserId(auth.user.id);
    const { data: profil, error: profilError } = await sb
      .from("profiles")
      .select("id,pharmacie_id,fonction_interne,role")
      .eq("id", auth.user.id)
      .single();
    if (profilError || !profil) {
      setErreur("Profil NAXA introuvable ou inaccessible.");
      setChargement(false);
      return;
    }
    const fn = profil.fonction_interne || (profil.role === "caisse" ? "caisse" : profil.role);
    setFonction(fn || "");
    if (!profil.pharmacie_id) {
      setErreur("Aucune pharmacie n’est associée à ce profil. Le Promoteur doit sélectionner une pharmacie depuis son périmètre.");
      setChargement(false);
      return;
    }
    setPharmacieId(profil.pharmacie_id);
    const { data: notes, error: notesError } = await sb
      .from("naxa_validations_pharmaceutiques_notifications")
      .select("id,validation_id,type,message,cree_le,lu_le")
      .eq("destinataire_id", auth.user.id)
      .order("cree_le", { ascending: false })
      .limit(10);
    if (!notesError) setNotifications((notes || []) as Notification[]);
    const { data, error: listeError } = await sb
      .from("naxa_validations_pharmaceutiques")
      .select("id,pharmacie_id,type_document,objet,soumis_par,document_storage_path,statut,decide_par,decision_commentaire,cree_le,soumis_le,decide_le")
      .eq("pharmacie_id", profil.pharmacie_id)
      .order("cree_le", { ascending: false });
    if (listeError) setErreur("Impossible de charger les dossiers. Vérifiez vos privilèges et le périmètre de la pharmacie.");
    else setDossiers((data || []) as Dossier[]);
    setChargement(false);
  }, [sb]);

  useEffect(() => { void charger(); }, [charger]);

  async function creerEtSoumettre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setErreur("");
    if (!fichier || !pharmacieId) {
      setErreur("Choisissez un document PDF, PNG ou JPEG.");
      return;
    }
    if (!["application/pdf", "image/png", "image/jpeg"].includes(fichier.type)) {
      setErreur("Format refusé : seuls PDF, PNG et JPEG sont acceptés.");
      return;
    }
    if (fichier.size > 10 * 1024 * 1024) {
      setErreur("Le document dépasse la limite de 10 Mo.");
      return;
    }
    const nomFichier = fichier.name.normalize("NFKD").replace(/[^A-Za-z0-9._-]/g, "_").replace(/^[^A-Za-z0-9]+/, "").slice(0, 120);
    if (!nomFichier) {
      setErreur("Nom de fichier invalide.");
      return;
    }
    setOccupé(true);
    try {
      const { data, error: creerError } = await sb.rpc("naxa_creer_dossier_validation_pharmaceutique", {
        p_pharmacie: pharmacieId,
        p_type_document: type,
        p_objet: objet.trim(),
        p_nom_fichier: nomFichier,
      });
      if (creerError) throw creerError;
      const created = Array.isArray(data) ? data[0] : data;
      if (!created?.validation_id || !created?.storage_path) throw new Error("La création du dossier n’a pas retourné son identifiant.");
      const { error: uploadError } = await sb.storage.from(BUCKET).upload(created.storage_path, fichier, {
        contentType: fichier.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { error: submitError } = await sb.rpc("naxa_soumettre_dossier_validation_pharmaceutique", {
        p_validation_id: created.validation_id,
      });
      if (submitError) throw submitError;
      setObjet("");
      setFichier(null);
      setMessage("Dossier transmis au pharmacien. Il reste en attente jusqu’à une décision explicite.");
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Échec de la transmission. Le brouillon peut rester à compléter.");
    } finally {
      setOccupé(false);
    }
  }

  async function decider(id: string, decision: "approuvee" | "refusee" | "complement_requis") {
    setMessage("");
    setErreur("");
    setOccupé(true);
    try {
      const { error } = await sb.rpc("naxa_decider_validation_pharmaceutique", {
        p_validation_id: id,
        p_decision: decision,
        p_commentaire: commentaires[id] || null,
      });
      if (error) throw error;
      setMessage("Décision enregistrée et journalisée.");
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "La décision n’a pas pu être enregistrée.");
    } finally {
      setOccupé(false);
    }
  }

  async function ouvrirDocument(path: string) {
    setErreur("");
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      setErreur("Accès au document refusé ou document indisponible.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const estPharmacien = fonction === "pharmacien";
  const peutSoumettre = ["pharmacien", "preparateur", "agent_accueil", "responsable"].includes(fonction);

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <header className="space-y-1">
        <p className="text-sm font-semibold text-emerald-800">NAXA · Pharmacie</p>
        <h1 className="text-2xl font-extrabold">Validations pharmaceutiques</h1>
        <p className="text-sm text-slate-600">
          Le pharmacien habilité peut examiner le dossier à distance. Aucune demande n’est approuvée automatiquement.
        </p>
      </header>

      {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">{message}</p>}
      {erreur && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">{erreur}</p>}

      {peutSoumettre && (
        <section className="rounded-xl border border-slate-200 p-4">
          <h2 className="mb-3 text-lg font-bold">Transmettre un dossier au pharmacien</h2>
          <form className="space-y-3" onSubmit={creerEtSoumettre}>
            <label className="block text-sm font-semibold">
              Type de dossier
              <select className="champ mt-1" value={type} onChange={(e) => setType(e.target.value as Dossier["type_document"])}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Objet / contexte minimal
              <textarea className="champ mt-1 min-h-20" required minLength={3} maxLength={500} value={objet} onChange={(e) => setObjet(e.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Document (PDF, PNG ou JPEG · 10 Mo maximum)
              <input className="champ mt-1" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" required onChange={(e) => setFichier(e.target.files?.[0] || null)} />
            </label>
            <button className="btn btn-canari" disabled={occupé}>{occupé ? "Transmission…" : "Transmettre au pharmacien"}</button>
          </form>
        </section>
      )}

      {notifications.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 font-bold">Notifications de validation</h2>
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li key={n.id} className="border-t border-amber-200 pt-2 text-sm">
                <p>{n.message}</p>
                <p className="text-xs text-slate-600">{new Date(n.cree_le).toLocaleString("fr-FR")}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Dossiers de la pharmacie</h2>
          <button className="rounded-lg border px-3 py-2 text-sm font-semibold" onClick={() => void charger()} disabled={chargement || occupé}>Actualiser</button>
        </div>
        {chargement ? <p className="text-sm text-slate-600">Chargement…</p> : dossiers.length === 0 ? (
          <p className="rounded-xl border border-dashed p-5 text-sm text-slate-600">Aucun dossier visible dans votre périmètre.</p>
        ) : dossiers.map((d) => (
          <article key={d.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-bold">{TYPES.find((t) => t.value === d.type_document)?.label || d.type_document}</h3>
                <p className="text-sm text-slate-700">{d.objet}</p>
                <p className="mt-1 text-xs text-slate-500">Créé le {new Date(d.cree_le).toLocaleString("fr-FR")} · Réf. {d.id.slice(0, 8)}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{STATUTS[d.statut]}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-lg border px-3 py-2 text-sm font-semibold" onClick={() => void ouvrirDocument(d.document_storage_path)}>Ouvrir le document sécurisé</button>
            </div>
            {d.decision_commentaire && <p className="text-sm text-slate-700">Commentaire : {d.decision_commentaire}</p>}
            {estPharmacien && d.statut === "en_attente" && d.soumis_par !== userId && (
              <div className="space-y-2 border-t pt-3">
                <label className="block text-sm font-semibold">
                  Commentaire de décision
                  <textarea className="champ mt-1 min-h-16" maxLength={1000} value={commentaires[d.id] || ""} onChange={(e) => setCommentaires((p) => ({ ...p, [d.id]: e.target.value }))} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-canari" disabled={occupé} onClick={() => void decider(d.id, "approuvee")}>Valider</button>
                  <button className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700" disabled={occupé} onClick={() => void decider(d.id, "refusee")}>Refuser</button>
                  <button className="rounded-lg border px-3 py-2 text-sm font-semibold" disabled={occupé || !(commentaires[d.id] || "").trim()} onClick={() => void decider(d.id, "complement_requis")}>Demander un complément</button>
                </div>
              </div>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
