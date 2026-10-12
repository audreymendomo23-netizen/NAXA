import Link from "next/link";

export default function Confidentialite(){
  return <main className="min-h-screen bg-naxa-green-50 px-5 py-8">
    <article className="mx-auto max-w-2xl rounded-xl2 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-extrabold">Politique de confidentialité</h1>
      <p className="mt-2 text-xs text-slate-500">Version 1.0 — 12 octobre 2026 · Projet à valider avant mise en production.</p>
      <p className="mt-4 text-sm leading-7">Cette politique décrit les catégories de données traitées par NAXA et les raisons du traitement. Elle doit être finalisée avec l’identité juridique de l’exploitant, ses coordonnées, les durées de conservation et les informations exactes sur les prestataires avant l’ouverture générale.</p>
      <p className="mt-4 text-sm leading-7"><strong className="naxa-text">NAXA</strong> traite uniquement les informations nécessaires à la création du compte, à l'authentification, à la sécurité et aux fonctionnalités demandées par l'utilisateur.</p>
      <h2 className="mt-6 text-lg font-bold">Responsable et contact</h2>
      <p className="mt-2 text-sm leading-7">Le responsable du traitement est l’entité qui exploite NAXA. Son nom légal, son adresse et ses coordonnées doivent être complétés avant la mise en production. Pour les demandes relatives aux données personnelles, utilisez l’adresse de contact dédiée publiée par NAXA.</p>
      <h2 className="mt-6 text-lg font-bold">Données de compte</h2>
      <p className="mt-2 text-sm leading-7">Selon le parcours utilisé, le compte peut associer notamment nom, prénom, nom d'utilisateur, adresse e-mail, téléphone, pays/indicatif et date de naissance. Ces informations servent à créer et sécuriser le compte, vérifier les conditions d'accès et fournir les fonctionnalités demandées.</p>
      <h2 className="mt-6 text-lg font-bold">Authentification et récupération</h2>
      <p className="mt-2 text-sm leading-7">L'authentification peut utiliser le nom d'utilisateur et le mot de passe ou, lorsque le fournisseur est activé, Google OAuth. Le parcours « mot de passe oublié » utilise un code OTP envoyé à l'adresse e-mail associée au compte. Les mots de passe ne sont pas conservés en clair par NAXA.</p>
      <h2 className="mt-6 text-lg font-bold">Ordonnances</h2>
      <p className="mt-2 text-sm leading-7">Le scanner d'ordonnance fonctionne localement dans le navigateur pour le parcours prévu. L'image n'est pas envoyée au serveur NAXA et n'est pas stockée par ce parcours.</p>
      <h2 className="mt-6 text-lg font-bold">Recherche, réservation et opérations</h2>
      <p className="mt-2 text-sm leading-7">Les informations nécessaires à la recherche, aux réservations et aux opérations demandées peuvent être traitées pour exécuter ces fonctionnalités. Les informations de disponibilité peuvent changer et ne doivent pas être interprétées comme des données médicales personnalisées.</p>
      <h2 className="mt-6 text-lg font-bold">Finalités et fondements</h2>
      <p className="mt-2 text-sm leading-7">Les données sont utilisées pour créer et administrer le compte, vérifier l’adresse e-mail, protéger le service contre les abus et fournir les fonctionnalités choisies. Selon l’opération, le traitement peut être nécessaire au service demandé, reposer sur un consentement, répondre à une obligation légale ou poursuivre un objectif légitime de sécurité lorsque la réglementation le permet.</p>
      <h2 className="mt-6 text-lg font-bold">Destinataires et prestataires</h2>
      <p className="mt-2 text-sm leading-7">Les données peuvent être traitées par les prestataires techniques indispensables à l’hébergement, à l’authentification, à la sécurité et à l’envoi des courriers automatiques. Avant la mise en production, l’exploitant doit confirmer la liste des prestataires, leurs lieux de traitement et les garanties requises pour les éventuels transferts internationaux.</p>
      <h2 className="mt-6 text-lg font-bold">Conservation et contrôle</h2>
      <p className="mt-2 text-sm leading-7">Les données sont conservées aussi longtemps que nécessaire au fonctionnement du compte, à la sécurité et aux obligations applicables. Les accès aux données sont limités selon les rôles et les contrôles de sécurité de l'application. NAXA ne demande pas de photographie d'ordonnance dans le parcours scanner décrit ci-dessus.</p>
      <h2 className="mt-6 text-lg font-bold">Sécurité</h2>
      <p className="mt-2 text-sm leading-7">Les secrets serveur ne sont pas exposés au navigateur. Les accès aux données sont protégés par l'authentification et les mécanismes de contrôle d'accès prévus par l'application. Pour les détails techniques de protection, consultez la politique de sécurité.</p>
      <h2 className="mt-6 text-lg font-bold">Cookies et données techniques</h2>
      <p className="mt-2 text-sm leading-7">Des données techniques strictement nécessaires au fonctionnement et à la sécurité peuvent être utilisées. Si des outils d’analyse ou de publicité sont ajoutés, leur finalité et les choix disponibles devront être décrits avant leur activation.</p>
      <h2 className="mt-6 text-lg font-bold">Vos droits et réclamations</h2>
      <p className="mt-2 text-sm leading-7">L’utilisateur peut demander l’accès aux données le concernant, leur rectification, leur suppression ou la limitation du traitement, s’opposer à certains traitements et retirer un consentement lorsque ces droits sont prévus par la loi applicable. Une demande peut être adressée au contact publié par NAXA. Une réclamation peut être portée devant l’autorité compétente selon les procédures légales applicables.</p>
      <Link href="/creation-compte" className="mt-8 inline-flex font-bold underline">Retour à l'inscription</Link>
    </article>
  </main>
}
