# Conditions générales d’utilisation

**Version de travail 1.3 — 15 octobre 2026**  
**Statut : BROUILLON JURIDIQUE — NON PUBLIABLE EN L’ÉTAT**

> Document de travail à faire vérifier par un conseil connaissant le droit camerounais. Il ne constitue pas un avis juridique et ne doit pas être présenté comme validé. Les services, flux de données et conditions commerciales doivent correspondre au fonctionnement effectivement déployé.

## 1. Éditeur, exploitant et contact

Le service est présenté sous le nom **NAXA**, accessible notamment à l’adresse https://naxa.cm.

- **Responsable déclaré :** BITSEKI MAYAKA Bienvenu.
- **Forme déclarée :** entreprise individuelle (EI).
- **Adresse communiquée :** Yaoundé, Cameroun.
- **Adresse physique et postale complète :** à compléter avant publication.
- **Immatriculation et identifiants applicables :** numéro et justificatifs à fournir/vérifier avant publication.
- **Contact :** naxa.home@gmail.com.
- **Téléphone communiqué :** +237 681 97 22 37.

La mention « EI » et le nom du responsable sont les informations communiquées par l’exploitant ; elles ne remplacent pas la vérification des justificatifs d’immatriculation, de l’identifiant fiscal et des mentions légalement requises. Le nom commercial NAXA ne doit pas être confondu avec la dénomination ou l’identité juridique exacte de l’exploitant.

## 2. Objet du service et limites

NAXA propose des espaces distincts aux clients et aux pharmacies, pouvant notamment inclure la recherche de pharmacies, l’affichage d’informations sur les produits et leur disponibilité, la localisation ou recherche de proximité, des outils de gestion pour les pharmacies, des réservations ou commandes si elles sont activées, et un outil de lecture OCR d’ordonnance.

La disponibilité des fonctionnalités dépend de la version du service et des parcours activés. Aucune clause ne doit laisser croire qu’une fonction est disponible si elle ne l’est pas réellement. NAXA est un service numérique d’information et de mise en relation ; il ne remplace ni un pharmacien, ni un médecin, ni les autorités de santé.

## 3. Accès, âge minimum et comptes

Le service est destiné aux personnes âgées d’au moins **18 ans**. Le code consulté sur `main` comporte un parcours de vérification demandant une date de naissance et vérifiant côté serveur que l’utilisateur a au moins 18 ans, ainsi qu’une finalisation d’inscription qui valide également l’âge. Les contrôles doivent néanmoins être testés de bout en bout sur la version déployée avant de considérer cette protection comme validée.

L’utilisateur doit fournir des informations exactes, protéger ses moyens d’authentification et signaler tout accès suspect. Il ne doit pas utiliser le compte d’un tiers sans autorisation. Les mesures de suspension ou de fermeture doivent être proportionnées et respecter les droits impératifs applicables.

Les collaborateurs d’une pharmacie doivent utiliser leur propre compte et les autorisations attribuées à leur fonction. L’exploitant de la pharmacie demeure responsable de la gestion de ses utilisateurs et de la fiabilité des informations qu’il publie, dans les limites de la loi.

## 4. Conditions applicables aux pharmacies

Toute pharmacie souhaitant utiliser les fonctions professionnelles de NAXA doit pouvoir justifier de son existence légale au Cameroun et de l’autorisation valide délivrée par l’autorité compétente pour créer et/ou exploiter l’établissement pharmaceutique concerné, selon les exigences applicables. Les pièces exigées, leur vérification, leur actualisation et les conséquences d’une autorisation expirée ou retirée doivent être définies dans le processus d’admission des pharmacies.

L’affichage d’une pharmacie sur NAXA ne doit pas être interprété comme une certification officielle par NAXA ni comme une garantie de conformité réglementaire permanente. NAXA doit vérifier les documents selon une procédure adaptée et suspendre l’accès professionnel lorsqu’une vérification obligatoire échoue ou qu’une autorisation valide ne peut plus être établie.

Les pharmacies restent responsables des informations qu’elles fournissent, notamment identité, autorisations, prix, stocks, horaires, gardes et coordonnées. Le processus de vérification et les obligations précises doivent être validés au regard de la réglementation camerounaise du secteur pharmaceutique.

## 5. Informations sur les produits et la disponibilité

Les stocks, prix, horaires, périodes de garde et autres informations peuvent changer. Sauf confirmation explicite, datée et liée au parcours concerné, une information affichée ne garantit pas la disponibilité immédiate d’un produit, son prix final, l’ouverture de la pharmacie ou la délivrance du produit. L’utilisateur doit confirmer les éléments déterminants auprès de la pharmacie.

Les contenus et outils numériques de NAXA ne constituent pas un diagnostic, une prescription ou un avis médical. En cas d’urgence, l’utilisateur doit contacter les services compétents ou se rendre dans un établissement de santé.

## 6. Scan d’ordonnance

Le code consulté sur la branche `main` utilise `tesseract.js` pour reconnaître du texte à partir d’un fichier image fourni à la fonction OCR. Dans le composant de recherche examiné, l’image est passée à cette fonction dans le navigateur ; le texte reconnu et les candidats sont présentés à l’utilisateur. Le composant indique que l’image n’est pas envoyée à NAXA. Lorsqu’un utilisateur choisit ensuite de rechercher les médicaments identifiés ou modifiés, les termes retenus sont envoyés comme requête de recherche pour obtenir des informations du catalogue et/ou rechercher les stocks des pharmacies partenaires.

Le code examiné ne montre pas que l’image elle-même est transmise par ce parcours, mais l’absence de transmission de l’image doit encore être confirmée par un contrôle réseau sur la version déployée. Le chargement des ressources OCR, les journaux, les métadonnées et les flux d’autres composants doivent également être examinés. Il ne faut pas affirmer que rien ne quitte l’appareil : les termes de recherche choisis par l’utilisateur peuvent quitter le navigateur lorsqu’il lance la recherche.

Le scanner facilite la lecture du texte et ne vérifie ni l’authenticité ni la validité médicale ou juridique de l’ordonnance. L’OCR peut produire des erreurs ; le pharmacien reste responsable des contrôles relevant de sa profession. L’utilisateur ne doit traiter que les documents qu’il est autorisé à utiliser.

## 7. Réservations, commandes, paiements et réclamations

Lorsqu’une réservation ou commande est activée, l’interface doit préciser avant confirmation la pharmacie concernée, le produit ou service, le prix ou son mode de calcul, les frais éventuels, les délais, le mode de paiement, les conditions d’annulation et les modalités de réclamation ou de remboursement.

Une réservation ne garantit pas à elle seule la disponibilité définitive du produit ni sa délivrance. Avant l’activation de chaque parcours, NAXA doit clarifier le rôle contractuel de NAXA et de la pharmacie, la partie qui vend ou délivre le produit, la gestion des paiements, les justificatifs et les responsabilités applicables.

## 8. Abonnements et commissions

Le modèle économique annoncé comprend des **abonnements de pharmacies et des commissions**. Les montants sont personnalisés et ne sont pas fixés par les présentes CGU. Avant tout engagement, chaque pharmacie doit recevoir les conditions commerciales applicables : prix, base de calcul et fait générateur des commissions, taxes, périodicité, facturation, moyens de paiement, renouvellement, suspension, résiliation et traitement des éventuels impayés ou remboursements.

Ces conditions doivent être remises dans une grille, un devis ou un contrat distinct, accepté avant la souscription. Elles ne doivent pas être inventées ou déduites de la présente clause.

## 9. Utilisations interdites

Il est notamment interdit de fournir volontairement des informations trompeuses, d’accéder sans autorisation à un compte ou à des données, de contourner les contrôles de sécurité, de perturber le service, d’utiliser NAXA à des fins illicites, de publier des informations pharmaceutiques trompeuses ou de soumettre des données personnelles sans disposer des droits ou autorisations nécessaires.

## 10. Disponibilité, suspension et fermeture du compte

NAXA s’efforce de maintenir le service, sans garantir une disponibilité ininterrompue. Des interruptions peuvent survenir pour maintenance, sécurité ou incident technique. Un compte peut être suspendu ou limité en cas d’usage illicite, de risque de sécurité ou de violation des CGU, dans le respect des règles applicables.

Les effets d’une fermeture de compte sur les réservations, opérations commerciales, factures et données doivent être expliqués dans les parcours concernés. La suppression du compte et la conservation résiduelle des données sont décrites dans la politique de confidentialité.

## 11. Données personnelles et communications

Les traitements de données sont décrits dans la politique de confidentialité, qui doit être lue avec les présentes CGU. Les demandes relatives aux données personnelles peuvent être adressées à **naxa.home@gmail.com**.

WhatsApp Business est indiqué par l’exploitant comme canal/prestataire supplémentaire envisagé ou utilisé. Avant publication, NAXA doit confirmer les parcours qui l’utilisent, les données effectivement échangées et les conditions du fournisseur. Les utilisateurs doivent être informés lorsqu’un échange implique ce canal ; les données et métadonnées éventuellement traitées par WhatsApp/Meta ne doivent pas être omises de la politique.

## 12. Propriété intellectuelle et contenus tiers

Sous réserve des droits de tiers, les éléments propres au service NAXA sont protégés par les règles applicables. Les pharmacies restent responsables des droits nécessaires à la publication des contenus qu’elles fournissent. Toute licence ou réutilisation de contenus doit respecter les droits applicables.

## 13. Modifications des CGU

La version et la date d’entrée en vigueur doivent être indiquées. Les modifications substantielles doivent être communiquées de manière adaptée ; une nouvelle acceptation doit être recueillie lorsque la loi ou la nature du changement l’exige.

## 14. Droit applicable et règlement des différends

Le droit camerounais est envisagé comme droit applicable, sous réserve des règles impératives et de compétence applicables. Les voies de réclamation, les formalités préalables éventuelles et la juridiction compétente doivent être confirmées par un conseil juridique avant publication.

## 15. Références à vérifier

- Loi camerounaise n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel : https://prc.cm/fr/multimedia/documents/10258-loi-n-2024-017-du-23-12-2024-web
- Loi n° 2010/021 du 21 décembre 2010 régissant le commerce électronique au Cameroun : https://www.minpostel.gov.cm/index.php/fr/les-textes/telecoms-tic/lois-telecoms-tic/274-loi-n-2010-021-du-21-decembre-2010-regissant-le-commerce-electronique-au-cameroun
- Textes relatifs aux établissements pharmaceutiques (Ministère de la Santé publique / DPML) : https://www.dpml.cm/index.php/fr/publications/normes-et-legislation/etablissements-pharmaceutiques

Cette liste n’est pas exhaustive et ne remplace pas une validation juridique.

---

## Points bloquants avant publication

- [ ] Confirmer l’immatriculation de l’EI, le numéro et les identifiants légaux/fiscaux requis.
- [ ] Renseigner l’adresse physique et postale complète, au-delà de « Yaoundé, Cameroun ».
- [ ] Vérifier le parcours OCR de bout en bout et les requêtes réseau sur la version déployée, notamment les ressources OCR, les journaux et les données dérivées.
- [ ] Vérifier le contrôle d’âge dans la version déployée.
- [ ] Documenter le contrôle des autorisations des pharmacies et faire valider les exigences par un conseil compétent.
- [ ] Définir les contrats commerciaux, abonnements, commissions, taxes, facturation, résiliation et impayés.
- [ ] Clarifier les parcours de réservation, commande, paiement, annulation et remboursement.
- [ ] Inventorier les traitements liés à WhatsApp Business et aux autres prestataires.
- [ ] Faire valider les CGU par un conseil connaissant le droit camerounais et la réglementation pharmaceutique.
- [ ] Vérifier la cohérence avec la politique de confidentialité, les écrans de consentement et les contrats.
- [ ] Ne publier qu’après validation juridique et autorisation explicite de l’exploitant.
