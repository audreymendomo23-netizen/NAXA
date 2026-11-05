import Link from "next/link";

const p = "mt-2 text-sm leading-7";

export default function Conditions() {
  return (
    <main className="min-h-screen bg-naxa-green-50 px-5 py-8">
      <article className="mx-auto max-w-2xl rounded-xl2 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold">Conditions générales d’utilisation de NAXA</h1>
        <p className="mt-2 text-xs text-slate-500">Version 1.0 · 5 novembre 2026 · Droit camerounais</p>
        <h2 className="mt-6 text-lg font-bold">1. Présentation et rôle de NAXA</h2>
        <p className={p}>NAXA facilite la recherche d’informations sur les médicaments et les pharmacies référencées, la consultation des informations communiquées par les pharmacies et l’envoi éventuel d’une demande de réservation ou de mise en relation.</p>
        <p className={p}>NAXA est un service d’information et d’intermédiation, non une officine. NAXA ne vend pas, ne délivre pas et ne prescrit pas de médicaments. La pharmacie reste le vendeur et répond de la disponibilité, du prix, de la délivrance, des conseils, du paiement, des reçus et des remboursements qui lui incombent.</p>
        <p className={p}>Contact : <a className="font-semibold underline" href="mailto:naxa.home@gmail.com">naxa.home@gmail.com</a> · <a className="font-semibold underline" href="tel:+237681972237">+237 681 97 22 37</a> · <a className="font-semibold underline" href="tel:+237690557734">+237 690 55 77 34</a>. Yaoundé, Cameroun.</p>
        <h2 className="mt-6 text-lg font-bold">2. Accès et majorité</h2>
        <p className={p}>Les espaces clients et les actions protégées sont réservés aux personnes âgées d’au moins 18 ans. Cette limite est une règle d’accès du service. La déclaration de majorité ne remplace pas la date de naissance demandée pour le compte.</p>
        <h2 className="mt-6 text-lg font-bold">3. Compte et sécurité</h2>
        <p className={p}>L’utilisateur fournit des informations exactes, protège ses moyens d’authentification et signale toute utilisation non autorisée. Les droits professionnels sont limités aux espaces, fonctions et pharmacies autorisés. Il est interdit d’accéder aux données d’autrui ou de contourner les contrôles.</p>
        <h2 className="mt-6 text-lg font-bold">4. Informations pharmaceutiques</h2>
        <p className={p}>Les prix, stocks, horaires et gardes sont communiqués par les pharmacies et peuvent évoluer. Leur affichage ne garantit pas la disponibilité lors du déplacement. Les informations NAXA ne constituent ni un diagnostic, ni une recommandation thérapeutique, ni une validation d’ordonnance.</p>
        <h2 className="mt-6 text-lg font-bold">5. OCR et posologie</h2>
        <p className={p}>Le scanner OCR facilite la lecture et la recherche, sans vérifier l’authenticité ou la validité d’une ordonnance. L’image est traitée localement dans le navigateur et n’est pas envoyée au serveur par cette étape. Les termes confirmés peuvent être transmis au service de recherche après lancement par l’utilisateur.</p>
        <p className={p}>Les champs de posologie enregistrent les consignes déclarées par l’utilisateur. NAXA ne prescrit ni ne recommande de dose. Les rappels sont facultatifs et nécessitent une action volontaire et les permissions de l’appareil.</p>
        <h2 className="mt-6 text-lg font-bold">6. Pharmacies et professionnels</h2>
        <p className={p}>Les pharmacies répondent de leurs autorisations, de leurs personnels, de la délivrance et du secret professionnel. Une validation pharmaceutique doit être réalisée par un professionnel disposant de l’accréditation requise et validée.</p>
        <h2 className="mt-6 text-lg font-bold">7. Demandes, réservations et paiements</h2>
        <p className={p}>Une demande ou réservation est transmise à une pharmacie et ne garantit pas le stock ni la délivrance tant que celle-ci n’a pas confirmé les conditions. Les demandes et réservations client sont gratuites. NAXA ne perçoit aucune commission sur la vente des médicaments et n’encaisse pas leur paiement ; le paiement est effectué directement auprès de la pharmacie.</p>
        <p className={p}>Les droits de rétractation, retour, échange et remboursement prévus par les textes applicables restent préservés. La pharmacie répond du remboursement d’un paiement qu’elle a reçu.</p>
        <h2 className="mt-6 text-lg font-bold">8. Abonnements professionnels</h2>
        <p className={p}>Un abonnement professionnel ne s’applique que s’il est proposé dans une convention ou une offre distincte précisant le titulaire, le périmètre, la durée, la périodicité, le tarif, le paiement et la résiliation. Aucun frais ou avantage non communiqué ne peut être présumé.</p>
        <h2 className="mt-6 text-lg font-bold">9. Communications promotionnelles</h2>
        <p className={p}>Les messages nécessaires au compte, à la sécurité ou au suivi d’une demande peuvent être adressés. Les communications promotionnelles sont facultatives, nécessitent le consentement préalable requis et peuvent être interrompues séparément.</p>
        <h2 className="mt-6 text-lg font-bold">10. Disponibilité, suspension et suppression</h2>
        <p className={p}>NAXA met en œuvre des efforts raisonnables pour maintenir le service, sans garantir une disponibilité ininterrompue. Un compte peut être restreint en cas de fraude, d’usurpation, de risque de sécurité ou de violation des conditions. Le client peut demander la suppression du compte depuis les paramètres, sous réserve des données à conserver légalement.</p>
        <h2 className="mt-6 text-lg font-bold">11. Réclamations</h2>
        <p className={p}>Pour une question concernant NAXA ou les données personnelles, contactez <a className="font-semibold underline" href="mailto:naxa.home@gmail.com">naxa.home@gmail.com</a>. Pour le produit, la délivrance, le prix, le paiement ou le remboursement, la pharmacie vendeuse demeure le premier interlocuteur. Aucun droit impératif n’est exclu.</p>
        <h2 className="mt-6 text-lg font-bold">12. Droit applicable</h2>
        <p className={p}>Les présentes conditions sont soumises au droit camerounais, sous réserve des règles impératives et des recours ouverts aux utilisateurs. Les modifications substantielles sont portées à la connaissance des utilisateurs et une nouvelle acceptation est demandée lorsque nécessaire.</p>
        <p className="mt-8 border-t border-slate-100 pt-4 text-sm leading-7">Les données personnelles sont traitées conformément à la <Link href="/politique-confidentialite" className="font-semibold underline">Politique de confidentialité de NAXA</Link>.</p>
        <Link href="/creation-compte" className="mt-6 inline-flex font-bold underline">Retour à l’inscription</Link>
      </article>
    </main>
  );
}
