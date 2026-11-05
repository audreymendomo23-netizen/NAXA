# État de validation réglementaire — NAXA

**Date : 5 novembre 2026**  
**Périmètre :** conditions d’utilisation, confidentialité, consentements et obligations camerounaises.

## Décision documentaire

La version 1.0 des documents suivants est consolidée et validée sur le plan rédactionnel et de cohérence avec le fonctionnement NAXA décrit dans le dépôt :

- `docs/legal/CGU-NAXA.md`
- `docs/legal/POLITIQUE-CONFIDENTIALITE-NAXA.md`
- Page publique `/conditions-utilisation`
- Page publique `/politique-confidentialite`

Les textes sont alignés sur les règles confirmées : NAXA est un service d’information et d’intermédiation ; le paiement des médicaments est fait directement auprès de la pharmacie ; les demandes et réservations client sont gratuites ; NAXA ne perçoit aucune commission sur les ventes de médicaments ; l’OCR traite l’image dans le navigateur ; les rappels et partages de suivi sont facultatifs.

**Cette validation éditoriale ne constitue pas une validation juridique externe, une autorisation administrative de traitement ou une certification de conformité.** La conformité juridique globale reste à finaliser.

## Éléments factuels vérifiés

- Le projet Supabase Production NAXA est actif dans la région `eu-west-1` (Irlande).
- Le projet Vercel `naxa` héberge l’application. Le projet utilise également des services Google pour certaines fonctions de messagerie, d’authentification ou d’automatisation.
- Le schéma applicatif contient des consentements de suivi par catégorie, des partages révocables, des abonnements Push et des données de posologie.
- Le profil client contient un horodatage d’acceptation (`consent_accepted_at`). Le registre applicatif ne prouve pas encore la conservation complète de la version exacte de chaque notice acceptée ni de la preuve distincte de chaque consentement facultatif.
- Coordonnées disponibles : naxa.home@gmail.com, +237 681 97 22 37, +237 690 55 77 34, Yaoundé, Cameroun.

## Formalités restant à régulariser avant une validation juridique globale

### 1. Identification de l’exploitant
Il reste à confirmer et publier, selon la forme juridique de l’exploitant, son identité ou sa raison sociale, sa forme, son adresse d’établissement, ainsi que les références RCCM/registre, NIU et autorisations légalement applicables. Une marque seule ne remplace pas les mentions d’identification prévues par la loi sur le commerce électronique.

### 2. Autorisation préalable des traitements et transferts internationaux
La loi n° 2024/017 prévoit une autorisation préalable pour les traitements concernés et pour les transferts vers un État étranger ou une organisation internationale. La base Supabase Production étant en région eu-west-1, le transfert international doit être encadré et son autorisation documentée. Les traitements et accès de Vercel et Google doivent être cartographiés pour déterminer les autres transferts concernés.

La loi prévoit une autorité indépendante de protection des données, dont l’organisation et le fonctionnement doivent être fixés par décret. L’absence éventuelle d’un canal administratif opérationnel ne doit pas être assimilée à une dispense de l’obligation légale.

### 3. Registre, sous-traitants et analyse d’impact
Il reste à constituer le registre exhaustif des traitements, avec catégories, finalités, destinataires, durées, lieux de traitement et autorisations, puis à formaliser ou vérifier les contrats de sous-traitance. Les traitements de données de santé et les flux de partage avec les professionnels doivent faire l’objet de l’analyse de risque et, lorsque les critères légaux sont réunis, d’une analyse d’impact préalable.

### 4. Consentements et preuve
Les fonctions facultatives doivent rester désactivées tant qu’un choix positif n’a pas été exprimé. La configuration initiale des rappels de posologie est corrigée pour ne plus précocher l’activation. Le libellé d’inscription distingue l’acceptation des conditions de la prise de connaissance de la politique de confidentialité.

Il reste à compléter la preuve conservée : version CGU et politique acceptée, date/heure, action, finalité, catégorie facultative, retrait et historique. Les consentements de suivi par famille et la révocation des partages sont présents dans le modèle ; leur preuve complète doit être réunie dans le registre de conformité.

### 5. Conservation et exercice des droits
Il reste à finaliser une matrice de conservation par catégorie, à la relier aux mécanismes d’effacement et de purge des sauvegardes, et à confirmer les durées légales applicables aux pièces transactionnelles, documents professionnels et journaux techniques. Les demandes de droits doivent être suivies et clôturées avec une preuve de réponse.

### 6. Activité pharmaceutique et publicité
Les pharmacies demeurent responsables de leurs autorisations et de l’exercice professionnel. Toute publicité concernant les médicaments ou les établissements pharmaceutiques doit respecter les autorisations et avis exigés par les textes pharmaceutiques et les règles professionnelles.

## Références réglementaires principales

- Loi n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel, notamment sections 5, 9, 13 à 16, 19, 21 à 33, 37 à 47, 48, 53 et 73.
- Loi n° 2010/021 du 21 décembre 2010 régissant le commerce électronique, notamment articles 5 à 15, 19 à 22, 26 et 30 à 34.
- Loi n° 2010/012 du 21 décembre 2010 relative à la cybersécurité et à la cybercriminalité, notamment articles 26 à 30 et 41 à 47.
- Loi n° 90-035 du 10 août 1990 relative à l’exercice et à l’organisation de la profession de pharmacien, notamment articles 2 et 19.
- Loi-cadre n° 2011/012 du 6 mai 2011 portant protection du consommateur.

## Statut final

- **Documents de référence :** version 1.0 consolidée et validée sur le plan éditorial.
- **Pages publiques :** textes alignés sur les documents de référence.
- **Consentement facultatif aux rappels :** valeur initiale corrigée pour être désactivée ; activation sur action volontaire.
- **Conformité juridique globale :** non déclarée verte tant que l’identité légale de l’exploitant, les autorisations de traitement/transfert, les garanties contractuelles, le registre et l’analyse d’impact requise ne sont pas documentés.
- **Déploiement :** aucun déploiement Production n’est inclus dans cette mise à jour.
