export default function Confidentialite() {
  const p = "mt-2 text-sm leading-7";
  return (
    <main className="min-h-screen bg-naxa-green-50 px-5 py-8 pb-[calc(8rem+env(safe-area-inset-bottom,0px))]">
      <article className="mx-auto max-w-2xl rounded-xl2 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold">Politique de confidentialité de NAXA</h1>
        <p className="mt-2 text-xs text-slate-500">Version 1.0 · 5 novembre 2026 · Droit camerounais</p>
        <h2 className="mt-6 text-lg font-bold">1. Responsable et contact</h2>
        <p className={p}>NAXA est la marque publique du service numérique exploité depuis Yaoundé, Cameroun. Contact données personnelles : <a className="font-semibold underline" href="mailto:naxa.home@gmail.com">naxa.home@gmail.com</a>, <a className="font-semibold underline" href="tel:+237681972237">+237 681 97 22 37</a> ou <a className="font-semibold underline" href="tel:+237690557734">+237 690 55 77 34</a>. Lorsqu’une pharmacie reçoit une demande et traite la vente, la délivrance ou la relation de soins, elle est responsable de ses propres traitements.</p>
        <h2 className="mt-6 text-lg font-bold">2. Données concernées</h2>
        <p className={p}>Selon les fonctions utilisées, NAXA peut traiter les données d’identité et de contact, date de naissance, données d’authentification et de sécurité, recherches confirmées, localisation volontaire, demandes et réservations, informations de pharmacie, affectations professionnelles, posologie, rappels et données de suivi personnel relatives à la santé.</p>
        <h2 className="mt-6 text-lg font-bold">3. Origine et finalités</h2>
        <p className={p}>Les données sont fournies par l’utilisateur ou proviennent du navigateur, de l’appareil, des prestataires et des pharmacies. Elles servent à gérer les comptes, fournir les fonctions sollicitées, sécuriser les accès, gérer les demandes, enregistrer les consignes de posologie choisies et respecter les obligations légales.</p>
        <p className={p}>Selon le traitement, le fondement est la fourniture du service demandé, une obligation légale, la protection des personnes ou le consentement préalable et spécifique lorsqu’il est requis. Géolocalisation, Push, partage de suivi et prospection sont facultatifs. L’acceptation générale des conditions ne vaut pas consentement à toutes ces fonctions.</p>
        <h2 className="mt-6 text-lg font-bold">4. Ordonnances et santé</h2>
        <p className={p}>L’image OCR est traitée localement dans le navigateur ; cette étape n’envoie pas l’image au serveur NAXA et NAXA ne la conserve pas dans ce parcours. Les termes confirmés peuvent être transmis au service de recherche après lancement par l’utilisateur.</p>
        <p className={p}>Les données de posologie et de suivi sont enregistrées lorsque l’utilisateur choisit ces fonctions. Le partage avec un professionnel suppose le consentement correspondant et un partage actif avec un professionnel vérifié. Le retrait met fin au partage concerné. NAXA ne fournit ni diagnostic ni recommandation de dose.</p>
        <h2 className="mt-6 text-lg font-bold">5. Destinataires et prestataires</h2>
        <p className={p}>L’accès est limité aux personnes autorisées. Lorsqu’une demande est adressée à une pharmacie, les informations nécessaires lui sont communiquées. Les données de suivi ne sont partagées avec un professionnel que dans le cadre d’un partage actif et du consentement correspondant.</p>
        <p className={p}>Les prestataires comprennent Supabase (authentification et base de données), Vercel (hébergement), Google (services de messagerie, d’authentification ou d’automatisation activés) et les fournisseurs de notifications Push du navigateur ou du système d’exploitation. NAXA ne vend pas les données personnelles et ne les utilise pas pour de la publicité ciblée.</p>
        <h2 className="mt-6 text-lg font-bold">6. Hébergement et transferts internationaux</h2>
        <p className={p}>La base Supabase de Production est configurée dans la région <strong>eu-west-1</strong>, située en Irlande. Vercel et Google peuvent aussi impliquer des traitements ou accès depuis d’autres pays selon leur infrastructure. La loi n° 2024/017 encadre les transferts internationaux et prévoit une autorisation préalable ; cette information ne remplace pas l’autorisation ni les garanties contractuelles requises.</p>
        <h2 className="mt-6 text-lg font-bold">7. Conservation</h2>
        <p className={p}>Les données de profil sont visées pour suppression ou dissociation sous 30 jours après une demande valide, sauf obligation légale. Les demandes et pièces transactionnelles sont conservées pour leur suivi, les obligations comptables et la défense de droits. Les données de posologie et de suivi sont conservées tant que l’utilisateur utilise les fonctions concernées, sous réserve des demandes d’effacement et obligations légales.</p>
        <p className={p}>Les abonnements Push sont conservés jusqu’à leur révocation ou suppression. Les images OCR sont traitées temporairement dans le navigateur et ne sont pas conservées par le serveur dans ce parcours. Les données de connexion et de trafic entrant dans le champ de l’article 29 de la loi n° 2010/012 sont conservées pendant la durée légale applicable, notamment dix ans pour les exploitants concernés.</p>
        <h2 className="mt-6 text-lg font-bold">8. Cookies et stockage local</h2>
        <p className={p}>NAXA utilise des cookies et espaces de stockage locaux ou de session nécessaires à l’authentification, la sécurité, la déclaration temporaire d’âge, les préférences et certaines fonctions hors ligne. Un abonnement Push n’est enregistré que lorsque l’utilisateur active les notifications et accorde la permission du navigateur.</p>
        <h2 className="mt-6 text-lg font-bold">9. Sécurité et violations</h2>
        <p className={p}>NAXA applique des contrôles d’accès par rôle et périmètre, des mesures de protection des comptes, la traçabilité des opérations sensibles, des restrictions d’accès et des sauvegardes. En cas de violation de données, les mesures de confinement et notifications à l’autorité compétente et aux personnes concernées sont effectuées sans délai conformément au droit applicable.</p>
        <h2 className="mt-6 text-lg font-bold">10. Droits des personnes</h2>
        <p className={p}>Vous pouvez demander l’accès, la rectification, la mise à jour, l’effacement, le blocage ou la limitation des données, vous opposer à certains traitements, demander la portabilité lorsque applicable et retirer un consentement lorsque le traitement repose sur celui-ci.</p>
        <p className={p}>Pour exercer vos droits : <a className="font-semibold underline" href="mailto:naxa.home@gmail.com">naxa.home@gmail.com</a>. Une vérification proportionnée de l’identité peut être demandée. Une première réponse est visée sous 15 jours, objectif de service qui ne remplace pas les délais légaux. La suppression du compte client peut aussi être demandée depuis les paramètres de l’espace client.</p>
        <h2 className="mt-6 text-lg font-bold">11. Prospection et mise à jour</h2>
        <p className={p}>Les messages nécessaires au service peuvent être envoyés pour fournir les fonctions sollicitées. Les messages promotionnels sont facultatifs et nécessitent le consentement préalable requis. La présente politique peut évoluer ; les changements importants sont portés à la connaissance des utilisateurs et une nouvelle acceptation est demandée lorsqu’elle est légalement nécessaire.</p>
      </article>
    </main>
  );
}
