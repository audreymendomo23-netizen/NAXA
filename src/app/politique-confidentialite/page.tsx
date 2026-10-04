import Link from "next/link";

export default function Confidentialite(){
  return <main className="min-h-screen bg-naxa-green-50 px-5 py-8">
    <article className="mx-auto max-w-2xl rounded-xl2 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-extrabold">Politique de confidentialité</h1>
      <p className="mt-4 text-sm leading-7"><strong className="naxa-text">NAXA</strong> traite uniquement les informations nécessaires à la création du compte, à l'authentification, à la sécurité et aux fonctionnalités demandées par l'utilisateur.</p>
      <h2 className="mt-6 text-lg font-bold">Données de compte</h2>
      <p className="mt-2 text-sm leading-7">Selon le parcours utilisé, le compte peut associer notamment nom, prénom, nom d'utilisateur, adresse e-mail, téléphone, pays/indicatif et date de naissance. Ces informations servent à créer et sécuriser le compte, vérifier les conditions d'accès et fournir les fonctionnalités demandées.</p>
      <h2 className="mt-6 text-lg font-bold">Authentification et récupération</h2>
      <p className="mt-2 text-sm leading-7">L'authentification peut utiliser le nom d'utilisateur et le mot de passe ou, lorsque le fournisseur est activé, Google OAuth. Le parcours « mot de passe oublié » utilise un code OTP envoyé à l'adresse e-mail associée au compte. Les mots de passe ne sont pas conservés en clair par NAXA.</p>
      <h2 className="mt-6 text-lg font-bold">Ordonnances</h2>
      <p className="mt-2 text-sm leading-7">Le scanner d'ordonnance fonctionne localement dans le navigateur pour le parcours prévu. L'image n'est pas envoyée au serveur NAXA et n'est pas stockée par ce parcours.</p>
      <h2 className="mt-6 text-lg font-bold">Recherche, réservation et opérations</h2>
      <p className="mt-2 text-sm leading-7">Les informations nécessaires à la recherche, aux réservations et aux opérations demandées peuvent être traitées pour exécuter ces fonctionnalités. Les informations de disponibilité peuvent changer et ne doivent pas être interprétées comme des données médicales personnalisées.</p>
      <h2 className="mt-6 text-lg font-bold">Conservation et contrôle</h2>
      <p className="mt-2 text-sm leading-7">Les données sont conservées aussi longtemps que nécessaire au fonctionnement du compte, à la sécurité et aux obligations applicables. Les accès aux données sont limités selon les rôles et les contrôles de sécurité de l'application. NAXA ne demande pas de photographie d'ordonnance dans le parcours scanner décrit ci-dessus.</p>
      <h2 className="mt-6 text-lg font-bold">Sécurité</h2>
      <p className="mt-2 text-sm leading-7">Les secrets serveur ne sont pas exposés au navigateur. Les accès aux données sont protégés par l'authentification et les mécanismes de contrôle d'accès prévus par l'application. Pour les détails techniques de protection, consultez la politique de sécurité.</p>
      <h2 className="mt-6 text-lg font-bold">Vos choix</h2>
      <p className="mt-2 text-sm leading-7">L'utilisateur peut demander des informations sur les données associées à son compte et exercer les droits prévus par la réglementation applicable, sous réserve des contraintes légales et techniques pertinentes.</p>
      <Link href="/creation-compte" className="mt-8 inline-flex font-bold underline">Retour à l'inscription</Link>
    </article>
  </main>
}
