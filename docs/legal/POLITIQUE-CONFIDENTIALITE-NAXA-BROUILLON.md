# NAXA — Politique de confidentialité

**Version de travail 1.2 — 12 octobre 2026**  
**Statut : BROUILLON JURIDIQUE — NON PUBLIABLE EN L’ÉTAT**

> Projet de travail, et non avis juridique. Cette politique ne doit être publiée qu’après vérification du code réellement déployé, des flux de données, des prestataires, des durées de conservation et des formalités applicables au Cameroun.

## 1. Responsable du traitement et contact

Le service est présenté sous le nom **NAXA** et accessible notamment à https://naxa.cm.

- Nom déclaré : NAXA
- Forme juridique et immatriculation : **à confirmer**
- Adresse : Yaoundé, Cameroun — **adresse complète à renseigner**
- Contact : naxa.home@gmail.com
- Téléphone : +237 681 972 237

L’identité juridique exacte du responsable du traitement doit être confirmée avant publication.

## 2. Personnes concernées et données susceptibles d’être traitées

Selon les fonctions utilisées, NAXA peut traiter les catégories suivantes :

- **Identité et compte** : nom ou informations de profil, identifiant de compte, date de naissance ou confirmation d’âge, identifiants d’authentification.
- **Contact** : adresse e-mail, numéro de téléphone et échanges avec l’assistance.
- **Localisation approximative** : position approximative ou localisation utilisée pour rechercher des pharmacies à proximité, si l’utilisateur autorise ou saisit cette information.
- **Données liées aux pharmacies** : informations de l’établissement, comptes des collaborateurs, stocks, horaires, garde, réservations et opérations réalisées depuis l’espace pharmacie.
- **Données de transaction** : abonnement, commissions, commandes, réservations, factures, reçus et statut de paiement si ces parcours sont activés.
- **Données techniques et de sécurité** : journaux de connexion, événements nécessaires à la prévention des abus, données techniques du navigateur ou de l’appareil lorsque celles-ci sont effectivement collectées.
- **Ordonnances et données de santé éventuelles** : image d’une ordonnance, texte reconnu par OCR ou données qui en sont extraites, selon le fonctionnement réel du scanner.

Cette liste décrit les catégories possibles, et non la preuve que chaque donnée est actuellement collectée. NAXA doit supprimer de la version publiée toute catégorie qui n’est pas effectivement traitée et ajouter toute catégorie réellement collectée qui manque ici.

## 3. Finalités et bases juridiques

Les finalités possibles sont :
- créer et sécuriser les comptes ;
- fournir les espaces Client et Pharmacie ;
- rechercher des pharmacies et afficher des informations de proximité ;
- gérer les stocks, réservations et commandes lorsque ces fonctions sont activées ;
- gérer les abonnements, commissions, factures et paiements ;
- répondre aux demandes d’assistance ;
- prévenir la fraude, les accès non autorisés et les incidents ;
- satisfaire aux obligations légales applicables.

La base juridique doit être déterminée pour chaque finalité, selon le droit applicable : exécution du service ou d’un contrat, obligation légale, consentement lorsque nécessaire, ou autre fondement autorisé. **La base juridique précise pour les données de santé, l’OCR et les transferts éventuels reste à valider avant publication.**

## 4. Scan d’ordonnance : vérification prioritaire

Une ordonnance peut contenir des données de santé sensibles. Avant publication de cette politique, NAXA doit vérifier et documenter :
1. si l’image est traitée uniquement dans le navigateur ou transmise à un serveur ;
2. si le texte OCR, des extraits, métadonnées ou journaux sont envoyés ou conservés ;
3. quels fournisseurs techniques peuvent recevoir ou traiter ces éléments ;
4. les finalités, le fondement juridique, les durées de conservation et les mesures de sécurité ;
5. si une autorisation ou une formalité particulière est requise.

Ne pas affirmer que l’image ou le texte reste exclusivement sur l’appareil tant que cela n’a pas été confirmé par l’inspection du code déployé et par un contrôle réseau. Si le traitement est réellement local et qu’aucune image, texte ou métadonnée d’ordonnance ne quitte l’appareil, la politique finale devra le dire précisément, sans généraliser cette affirmation aux autres données du service.

## 5. Localisation

La localisation peut servir à ordonner ou filtrer les pharmacies proches. L’application doit expliquer si elle utilise la position de l’appareil, une position saisie manuellement ou une localisation approximative. L’utilisateur devrait pouvoir utiliser une recherche manuelle lorsque cela est compatible avec le service.

La précision, la fréquence de collecte, la conservation et la transmission de la localisation doivent être confirmées dans le code et les paramètres déployés avant publication.

## 6. Destinataires et prestataires

Les prestataires déclarés à ce stade sont :
- **Supabase** : infrastructure de données et fonctions liées aux comptes, selon la configuration réelle ;
- **Vercel** : hébergement et distribution de l’application ;
- **Google** : services Google utilisés, notamment si l’authentification Google est activée.

Les rôles précis, sous-traitants ultérieurs, régions d’hébergement, accès aux données et éventuels transferts hors du Cameroun doivent être vérifiés dans les configurations et contrats applicables. Cette liste ne doit pas être considérée comme exhaustive tant que l’inventaire technique n’est pas achevé.

NAXA ne doit partager les données qu’en fonction des finalités déclarées, des autorisations nécessaires et des obligations applicables.

## 7. Durées de conservation

Le principe déclaré est la conservation des données de compte jusqu’à la suppression du compte, sous réserve des obligations légales et des nécessités de sécurité. Cette règle générale ne suffit pas à définir toutes les durées.

Avant publication, NAXA doit établir une grille distincte pour :
- données du compte et du profil ;
- localisation et recherches ;
- ordonnances, images et résultats OCR éventuels ;
- réservations, commandes, factures et données comptables ;
- journaux de sécurité et d’authentification ;
- demandes d’assistance ;
- sauvegardes et copies résiduelles après suppression.

Chaque durée doit être justifiée, mise en œuvre techniquement et communiquée de façon claire. Ne pas promettre l’effacement immédiat de toutes les copies si les sauvegardes ou obligations légales imposent un délai.

## 8. Politique de sécurité des données et du service

Cette section intègre à la présente politique de confidentialité les principes de sécurité de NAXA. Elle décrit les mesures à appliquer et à vérifier ; elle ne constitue pas une certification et ne garantit pas l’absence absolue d’incident. Les contrôles effectivement actifs doivent être confirmés dans le code, la configuration et les services déployés avant publication.

### 8.1. Contrôle des accès et séparation des espaces

- Les accès aux comptes, aux données et aux fonctions d’administration doivent être limités aux personnes et services qui en ont besoin.
- Les espaces Client et Pharmacie doivent rester séparés. Une pharmacie ne doit accéder qu’aux données autorisées pour son établissement et ses utilisateurs.
- Les permissions doivent être contrôlées côté serveur et dans la base de données ; masquer un bouton ou une page dans l’interface ne suffit pas.
- Les règles d’accès à la base de données, notamment les politiques Row Level Security (RLS) lorsqu’elles sont applicables, doivent être testées contre les accès autorisés et non autorisés.
- Les privilèges doivent suivre le principe du moindre privilège et être réexaminés lors des changements de rôle, de départ d’un collaborateur ou d’évolution du service.

### 8.2. Authentification et sessions

NAXA doit protéger les parcours de connexion, de création de compte, de vérification d’adresse e-mail, de récupération de compte et de gestion des sessions. Les jetons et mécanismes de récupération ne doivent pas être exposés dans les URL, journaux ou interfaces non prévues à cet effet. Les erreurs affichées ne doivent pas révéler de secrets ni de détails internes facilitant un abus. Les paramètres réellement activés (durée de session, expiration, révocation et protection contre les tentatives abusives) doivent être vérifiés avant publication.

### 8.3. Secrets, clés et configuration

- Les mots de passe, clés API, jetons et secrets d’intégration doivent être conservés dans des mécanismes de configuration protégés, jamais dans le code public, les dépôts, le navigateur ou les journaux.
- Les secrets doivent être accessibles uniquement aux composants qui en ont besoin et être renouvelés en cas d’exposition suspectée.
- Les variables d’environnement exposées au navigateur ne doivent jamais contenir de secret privilégié.
- Aucun mot de passe ni secret d’accès ne doit être communiqué par e-mail à l’assistance.

### 8.4. Transmissions et prestataires techniques

Les communications doivent utiliser des connexions chiffrées lorsque prises en charge par les services utilisés. Les protections fournies par Supabase, Vercel, Google et tout autre prestataire dépendent de la configuration effective, des autorisations et des régions sélectionnées. Les rôles de ces prestataires, leurs accès, leurs sous-traitants et les éventuels transferts internationaux doivent être inventoriés et vérifiés ; leur simple mention ne prouve pas qu’une configuration est sécurisée.

### 8.5. Courriels transactionnels et Google Apps Script

Le projet NAXA prévoit un mécanisme d’envoi de courriels transactionnels reposant sur Google Apps Script et Gmail. Son activation et son déploiement doivent être confirmés avant de le présenter comme opérationnel. Si ce mécanisme est utilisé, le point d’entrée doit vérifier les requêtes entrantes et le secret partagé côté serveur, valider les champs attendus, limiter les destinataires et contenus acceptés, et éviter les envois répétés au moyen d’une clé d’idempotence. Le secret ne doit jamais être inclus dans le code client, rendu public ou écrit dans les journaux. Les accès au compte Google et au script doivent être limités et révocables. Les données présentes dans les e-mails doivent être réduites au strict nécessaire ; les ordonnances et autres données de santé ne doivent pas être jointes ou transmises par ce mécanisme sans analyse et autorisation spécifiques.

### 8.6. Données sensibles et scanner d’ordonnance

Les images d’ordonnances, les résultats OCR et les données de santé éventuelles nécessitent une protection renforcée. NAXA doit vérifier les flux réseau, le stockage, les journaux, les accès internes et les durées de conservation associés à cette fonction. Aucun texte ne doit affirmer que les ordonnances restent sur l’appareil ou ne sont jamais transmises à un tiers tant que cela n’a pas été établi par l’inspection du code déployé et des flux réseau. Les exigences légales et le fondement autorisant ce traitement doivent être validés avant activation ou publication.

### 8.7. Journaux, sauvegardes et conservation

Les journaux de sécurité doivent être limités aux informations nécessaires à la détection, à l’investigation et à la prévention des abus. Ils ne doivent pas enregistrer de mots de passe, secrets, jetons complets ni contenu sensible inutile. L’accès aux journaux et sauvegardes doit être restreint. Les durées de conservation, les procédures de restauration et la suppression des données dans les sauvegardes doivent être documentées et cohérentes avec la grille de conservation de la présente politique.

### 8.8. Prévention, détection et réponse aux incidents

NAXA doit prévoir un processus de réception des alertes, de qualification des incidents, de limitation de leur impact, de conservation des éléments utiles, de correction et de suivi. En cas d’incident affectant des données personnelles, NAXA doit évaluer sans délai les obligations d’information ou de notification applicables, les personnes concernées et les autorités compétentes, selon le droit applicable. Les coordonnées de contact pour signaler un problème de sécurité doivent être maintenues à jour ; le contact général est naxa.home@gmail.com.

### 8.9. Limites et responsabilité de chacun

Les utilisateurs doivent protéger leurs moyens d’accès, choisir des mots de passe appropriés lorsqu’ils en définissent, fermer les sessions sur les appareils partagés et signaler rapidement toute activité suspecte. Ils ne doivent pas envoyer de mots de passe, de codes de vérification ni de secrets au support. NAXA ne peut promettre une sécurité absolue ; il s’engage à maintenir des mesures proportionnées aux risques et à les améliorer en fonction des incidents et des évolutions techniques.

## 9. Droits des personnes et demandes

Pour toute demande relative aux données personnelles, contacter **naxa.home@gmail.com**. Il peut être nécessaire de vérifier l’identité du demandeur afin d’éviter la divulgation à un tiers.

Selon le droit applicable et les circonstances, les personnes peuvent disposer de droits d’accès, de rectification, d’effacement, d’opposition, de limitation, de retrait du consentement ou d’autres droits prévus par la loi. Les modalités, délais de réponse, exceptions et voie de recours doivent être confirmés juridiquement avant publication.

La suppression d’un compte peut être demandée selon le parcours proposé par NAXA ou par e-mail. Certaines données peuvent devoir être conservées pendant une durée légale ou pour la défense de droits ; ces exceptions doivent être expliquées à la personne concernée.

## 10. Cookies, mesures d’audience et communications

L’utilisation de cookies, de stockage local, d’outils de mesure d’audience, de pixels publicitaires ou d’autres traceurs doit être auditée. Cette version ne prétend pas qu’aucun traceur n’est utilisé. Les traceurs non essentiels, s’ils existent, doivent être décrits et soumis au choix de l’utilisateur lorsque la loi l’exige.

Les communications de service doivent être distinguées des communications promotionnelles. Les canaux utilisés, les bases juridiques et les moyens de désinscription doivent être précisés selon le fonctionnement réel.

## 11. Transferts internationaux

Les données peuvent être hébergées ou traitées dans des pays autres que le Cameroun selon les régions et services effectivement configurés. NAXA doit identifier les pays, destinataires, garanties et formalités applicables avant toute déclaration définitive sur les transferts internationaux.

## 12. Mineurs

Le service est prévu pour les personnes âgées d’au moins **18 ans**. Les mécanismes de contrôle d’âge doivent être décrits conformément au comportement réel du service. Les procédures applicables en cas de données concernant un mineur doivent être déterminées avant publication.

## 13. Évolution de la politique

La date et la version de la politique doivent être affichées. En cas de changement substantiel des finalités, des destinataires ou du traitement des données sensibles, les personnes doivent être informées et un consentement doit être recueilli lorsque la loi l’exige.

## 14. Cadre juridique à vérifier

- Loi camerounaise n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel : https://prc.cm/fr/multimedia/documents/10258-loi-n-2024-017-du-23-12-2024-web
- Loi n° 2010/021 du 21 décembre 2010 régissant le commerce électronique au Cameroun : https://www.minpostel.gov.cm/index.php/fr/les-textes/telecoms-tic/lois-telecoms-tic/274-loi-n-2010-021-du-21-decembre-2010-regissant-le-commerce-electronique-au-cameroun
- Normes et législation des établissements pharmaceutiques (Ministère de la Santé publique / DPML) : https://www.dpml.cm/index.php/fr/publications/normes-et-legislation/etablissements-pharmaceutiques

La conformité, les formalités préalables, les exigences relatives aux données de santé et les transferts internationaux doivent être validés par un conseil juridique compétent. Les liens ci-dessus ne remplacent pas cette analyse.

---

## Liste de contrôle obligatoire avant publication

- [ ] Confirmer l’identité juridique, la forme, l’immatriculation et l’adresse complète de NAXA.
- [ ] Cartographier les données collectées par le code réellement déployé, les API, les journaux et les services tiers.
- [ ] Tester le flux complet du scanner d’ordonnance : image, OCR, métadonnées, réseau, stockage et suppression.
- [ ] Identifier les bases juridiques et les formalités applicables, notamment pour les données de santé.
- [ ] Confirmer Supabase, Vercel, Google et tout autre fournisseur : rôle, région, sous-traitants et transferts.
- [ ] Définir et appliquer des durées de conservation par catégorie, y compris journaux et sauvegardes.
- [ ] Auditer cookies, stockage local, analytics, publicité et communications e-mail.
- [ ] Définir et tester les procédures de demande d’accès, rectification, suppression, opposition et réponse aux incidents.\n- [ ] Auditer la sécurité réelle des accès, politiques RLS, sessions, secrets, journaux, sauvegardes et du script Google Apps Script/Gmail avant de présenter ces contrôles comme actifs.
- [ ] Vérifier que les CGU, l’interface, les consentements et la présente politique sont cohérents.
- [ ] Faire valider le texte et les formalités par un conseil juridique au regard de la loi camerounaise n° 2024/017 et des règles sectorielles.
- [ ] Obtenir une validation explicite de NAXA avant toute publication sur le site ou déploiement.

