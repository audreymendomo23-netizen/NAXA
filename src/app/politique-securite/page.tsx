import Link from "next/link";

export default function Securite(){
  return <main className="min-h-screen bg-naxa-green-50 px-5 py-8">
    <article className="mx-auto max-w-2xl rounded-xl2 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-extrabold">Politique de sécurité et de protection des données</h1>
      <p className="mt-4 text-sm leading-7"><strong className="naxa-text">NAXA</strong> applique des contrôles d'accès destinés à protéger les comptes, les données et les opérations sensibles. Les secrets serveur, notamment la clé service, ne sont jamais destinés au navigateur.</p>
      <h2 className="mt-6 text-lg font-bold">Authentification</h2>
      <p className="mt-2 text-sm leading-7">Les fonctionnalités protégées nécessitent une authentification. Le parcours Google utilise OAuth et doit établir une session avant de rediriger l'utilisateur dans l'application. La récupération du mot de passe utilise un OTP à durée limitée avant l'accès à la modification du mot de passe.</p>
      <h2 className="mt-6 text-lg font-bold">Contrôle d'accès</h2>
      <p className="mt-2 text-sm leading-7">Les actions opérationnelles sont contrôlées côté interface et côté serveur. Les données sensibles et les opérations administratives reposent sur des contrôles d'identité, de rôle et de politiques d'accès en base. Une vérification côté navigateur ne remplace pas les contrôles serveur.</p>
      <h2 className="mt-6 text-lg font-bold">Protection des données</h2>
      <p className="mt-2 text-sm leading-7">Les politiques d'accès de la base sont utilisées pour limiter les lectures et écritures selon l'utilisateur et son rôle. Les fonctions serveur sensibles ne doivent pas être rendues accessibles au public lorsqu'elles ne sont pas nécessaires.</p>
      <h2 className="mt-6 text-lg font-bold">Ordonnances</h2>
      <p className="mt-2 text-sm leading-7">Le scanner prévu par NAXA conserve l'image de l'ordonnance dans le navigateur pour son traitement local et ne l'envoie pas au serveur NAXA dans ce parcours.</p>
      <h2 className="mt-6 text-lg font-bold">Validation de l'âge</h2>
      <p className="mt-2 text-sm leading-7">La date de naissance est utilisée pour appliquer la règle d'accès aux personnes âgées de 18 ans ou plus. Les actions protégées ne doivent pas considérer une simple présence de l'interface comme une preuve suffisante : le serveur vérifie l'état du compte.</p>
      <h2 className="mt-6 text-lg font-bold">Bonnes pratiques utilisateur</h2>
      <p className="mt-2 text-sm leading-7">L'utilisateur doit conserver son mot de passe et ses moyens d'accès confidentiels, éviter de les partager et signaler rapidement toute activité inhabituelle. NAXA ne demandera jamais la clé service ou un secret technique à un utilisateur.</p>
      <h2 className="mt-6 text-lg font-bold">Évolution des contrôles</h2>
      <p className="mt-2 text-sm leading-7">Les contrôles de sécurité peuvent être renforcés au fil de l'évolution du service. Toute évolution doit respecter le prompt maître, le cahier des charges et les principes de moindre privilège, sans exposer de secret serveur au client.</p>
      <Link href="/creation-compte" className="mt-8 inline-flex font-bold underline">Retour à l'inscription</Link>
    </article>
  </main>
}
