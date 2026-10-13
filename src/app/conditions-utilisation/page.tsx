import Link from "next/link";

export default function Conditions(){
  return <main className="min-h-screen bg-naxa-green-50 px-5 py-8">
    <article className="mx-auto max-w-2xl rounded-xl2 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-extrabold">Conditions générales d’utilisation</h1>
      <p className="mt-2 text-xs text-slate-500">Version 1.0 — 12 octobre 2026 · Projet à valider avant mise en production.</p>
      <p className="mt-4 text-sm leading-7">Les présentes conditions décrivent les règles d’utilisation du service NAXA. L’identité juridique complète de l’exploitant et ses coordonnées doivent être publiées avant l’ouverture générale du service.</p>
      <p className="mt-4 text-sm leading-7"><strong className="naxa-text">NAXA</strong> est un service de recherche et de comparaison d'informations relatives à la disponibilité de médicaments et aux pharmacies référencées. Les informations fournies servent à faciliter la recherche et ne constituent ni un diagnostic, ni une prescription, ni un avis médical.</p>
      <h2 className="mt-6 text-lg font-bold">Accès au service</h2>
      <p className="mt-2 text-sm leading-7">La recherche générale peut être consultée sans compte. Certaines actions opérationnelles, notamment celles qui nécessitent un compte ou une validation d'âge, sont réservées aux utilisateurs authentifiés conformément au parcours NAXA.</p>
      <h2 className="mt-6 text-lg font-bold">Informations fournies par l'utilisateur</h2>
      <p className="mt-2 text-sm leading-7">L'utilisateur doit fournir des informations exactes et à jour lors de la création et de l'utilisation de son compte. Il lui appartient de conserver ses moyens d'authentification confidentiels et de signaler toute utilisation non autorisée.</p>
      <h2 className="mt-6 text-lg font-bold">Disponibilité des médicaments</h2>
      <p className="mt-2 text-sm leading-7">Une disponibilité, un prix ou une information affichée peut évoluer entre deux consultations. Une information affichée par <strong className="naxa-text">NAXA</strong> doit donc être comprise comme une information de disponibilité et non comme une garantie que le produit sera encore disponible au moment du déplacement.</p>
      <h2 className="mt-6 text-lg font-bold">Ordonnances et usage médical</h2>
      <p className="mt-2 text-sm leading-7">Le scanner d'ordonnance est conçu pour une lecture locale dans le navigateur. <strong className="naxa-text">NAXA</strong> ne demande pas l'envoi ni le stockage de l'image de l'ordonnance dans ce parcours. Les décisions médicales doivent rester prises avec un professionnel de santé.</p>
      <h2 className="mt-6 text-lg font-bold">Utilisation responsable</h2>
      <p className="mt-2 text-sm leading-7">L'utilisateur s'engage à ne pas détourner le service, contourner les contrôles d'accès, tenter d'accéder aux données d'un tiers ou utiliser NAXA pour une activité illicite. Les fonctionnalités peuvent évoluer pour des raisons de sécurité, de maintenance ou d'amélioration du service.</p>
      <h2 className="mt-6 text-lg font-bold">Compte et sécurité</h2>
      <p className="mt-2 text-sm leading-7">L’utilisateur est responsable de la confidentialité de ses identifiants et doit signaler rapidement toute utilisation suspecte. NAXA peut suspendre temporairement l’accès lorsqu’une mesure est nécessaire pour protéger le compte ou le service, sous réserve des règles applicables.</p>
      <h2 className="mt-6 text-lg font-bold">Disponibilité du service</h2>
      <p className="mt-2 text-sm leading-7">Le service peut être interrompu pour maintenance, sécurité ou incident technique. NAXA s’efforce de maintenir des informations utiles, sans garantir une disponibilité ininterrompue ni l’exactitude en temps réel des informations communiquées par des tiers.</p>
      <h2 className="mt-6 text-lg font-bold">Données personnelles</h2>
      <p className="mt-2 text-sm leading-7">Le traitement des données personnelles est décrit dans la <Link href="/politique-confidentialite" className="underline font-semibold">Politique de confidentialité</Link>, à lire avec les présentes conditions.</p>
      <h2 className="mt-6 text-lg font-bold">Droit applicable et contact</h2>
      <p className="mt-2 text-sm leading-7">Ces conditions sont destinées à être appliquées conformément au droit camerounais, sous réserve des règles impératives applicables. Pour toute question, utilisez le canal de contact publié sur le site.</p>
      <h2 className="mt-6 text-lg font-bold">Urgence</h2>
      <p className="mt-2 text-sm leading-7">NAXA ne remplace pas les secours ni une consultation médicale. En cas d'urgence, contactez les services d'urgence compétents ou rendez-vous dans l'établissement de santé le plus proche.</p>
      <Link href="/creation-compte" className="mt-8 inline-flex font-bold underline">Retour à l'inscription</Link>
    </article>
  </main>
}
