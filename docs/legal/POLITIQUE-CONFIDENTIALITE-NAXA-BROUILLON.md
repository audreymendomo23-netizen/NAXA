# NAXA — Politique de confidentialité et de sécurité des données

**Version de travail 1.4 — 15 octobre 2026**  
**Statut : BROUILLON JURIDIQUE — NON PUBLIABLE EN L’ÉTAT**

> Projet de travail, non avis juridique. Avant publication, il faut vérifier le code et les services effectivement déployés, les flux de données, les durées de conservation, les prestataires et les formalités applicables au Cameroun. Les mesures décrites comme objectifs ou principes ne prouvent pas qu’elles sont déjà toutes actives.

## 1. Responsable du traitement et contact

Le service est présenté sous le nom **NAXA**, accessible notamment à l’adresse https://naxa.cm.

- **Responsable déclaré :** BITSEKI MAYAKA Bienvenu.
- **Forme déclarée :** entreprise individuelle (EI).
- **Adresse communiquée :** Yaoundé, Cameroun.
- **Adresse physique et postale complète :** à compléter avant publication.
- **Immatriculation et identifiants légaux/fiscaux :** à renseigner et vérifier.
- **Contact données personnelles :** naxa.home@gmail.com.
- **Téléphone communiqué :** +237 681 97 22 37.

Ces informations ont été communiquées par l’exploitant, mais l’immatriculation, les identifiants requis et l’adresse complète doivent être vérifiés. La politique définitive devra identifier sans ambiguïté la personne ou l’entité responsable du traitement et, le cas échéant, ses coordonnées réglementaires.

## 2. Personnes concernées et catégories de données

Selon les fonctionnalités effectivement utilisées, NAXA peut traiter :

- **Compte et identité :** nom, prénom, nom d’utilisateur, date de naissance ou information d’âge, identifiant du compte et données nécessaires à son administration.
- **Coordonnées :** adresse e-mail, téléphone et échanges avec l’assistance.
- **Authentification et sécurité :** informations de connexion, événements de session, mécanismes de vérification et de récupération, journaux de sécurité.
- **Localisation et recherche :** localisation saisie ou approximative, requêtes et critères utilisés pour rechercher des pharmacies, si ces données sont réellement collectées.
- **Activité des pharmacies :** identité et comptes des collaborateurs, informations d’établissement, stocks, horaires, gardes, réservations et opérations effectuées dans l’espace professionnel.
- **Données commerciales :** abonnements, commissions, commandes, réservations, factures et états de paiement lorsque ces fonctions sont activées.
- **Assistance et communications :** messages et coordonnées transmis par e-mail ou via WhatsApp Business lorsque l’utilisateur choisit ce canal.
- **Ordonnances et données de santé éventuelles :** image sélectionnée, texte reconnu par OCR, candidats de médicaments extraits et termes de recherche choisis, selon le fonctionnement réel du scanner.
- **Données techniques :** informations du navigateur/appareil, journaux, cookies et stockage local, dans la mesure où ils sont effectivement utilisés.

Cette liste décrit les catégories susceptibles d’être concernées ; elle ne prouve pas que toutes sont actuellement collectées. L’inventaire final doit être aligné sur le code, les bases de données, les API, les journaux et les prestataires. Toute catégorie non utilisée doit être retirée du texte publié.

## 3. Finalités et bases juridiques

Les finalités envisagées comprennent la création et la gestion des comptes, l’authentification et la sécurité, la recherche de pharmacies, la fourniture des espaces Client et Pharmacie, la gestion des stocks et réservations, la gestion des abonnements et commissions, l’assistance et le respect des obligations légales.

Pour chaque finalité, NAXA doit déterminer et documenter le fondement applicable au regard du droit camerounais : par exemple, exécution d’un service ou contrat, obligation légale, consentement lorsque requis, ou autre fondement légalement admis. La présente liste ne vaut pas validation de ces fondements. Les traitements de données de santé, les communications via un service tiers et les transferts internationaux nécessitent une analyse spécifique avant publication.

## 4. Scan d’ordonnance : image locale, texte OCR et recherche

Le code de la branche `main` contient `src/lib/ocr.ts`, qui utilise `tesseract.js` : la fonction OCR reçoit un fichier image, reconnaît le texte et renvoie le texte, un score de confiance et une liste de candidats. Le composant `src/components/Recherche.tsx` appelle cette fonction dans le navigateur et présente les candidats à l’utilisateur pour vérification ou modification.

Dans le composant examiné, l’image n’est pas directement envoyée par l’appel OCR et l’interface indique qu’elle reste dans le navigateur. Cependant, l’absence de transmission de l’image doit être confirmée par un contrôle réseau sur la version déployée ; les ressources OCR téléchargées, métadonnées et éventuels journaux doivent aussi être vérifiés.

**Point important :** lorsque l’utilisateur appuie sur l’action de recherche des stocks, les termes de médicament qu’il a retenus ou modifiés sont envoyés comme paramètres de recherche. Ils servent à rechercher des informations dans le catalogue et/ou les stocks des pharmacies partenaires. Ainsi, même si l’image reste locale, les termes de recherche issus de l’ordonnance peuvent quitter le navigateur après cette action. Ces termes peuvent révéler des informations liées à la santé et doivent être décrits comme tels dans l’information donnée à l’utilisateur.

Avant publication, il faut vérifier :
1. les requêtes réseau de bout en bout et les ressources OCR chargées ;
2. si le texte OCR complet, seuls les candidats choisis ou d’autres données sont transmis ou conservés ;
3. les destinataires, journaux et durées de conservation des termes de recherche ;
4. si les requêtes sont associées à un compte, à un identifiant ou à d’autres données ;
5. les fondements juridiques, informations/consentements et formalités applicables aux données de santé.

Ne pas promettre que toutes les données issues de l’ordonnance restent exclusivement sur l’appareil. Si le traitement local exclusif de l’image est confirmé, la politique finale devra distinguer explicitement l’image, le texte OCR, les termes de recherche et les requêtes techniques.

L’OCR peut produire des erreurs. Il ne vérifie ni l’authenticité ni la validité d’une ordonnance et ne remplace pas le contrôle du pharmacien. L’utilisateur ne doit traiter que les documents qu’il est autorisé à utiliser.

## 5. Âge minimum

Le service est prévu pour les personnes âgées d’au moins **18 ans**. Sur la branche `main`, la page `/verification-age` demande une date de naissance et l’acceptation des trois documents présentés ; la route serveur `/api/auth/verify-age` vérifie l’âge et refuse les moins de 18 ans. Le parcours `/api/auth/complete-signup` vérifie également que la date de naissance correspond à un âge d’au moins 18 ans. Cela confirme la présence de contrôles dans le code consulté, mais pas leur test complet sur la version actuellement déployée. Le contrôle doit être testé sur les parcours réels avant de déclarer la protection pleinement validée.

## 6. Localisation

La localisation peut être utilisée pour proposer ou classer les pharmacies proches. Avant publication, NAXA doit confirmer si la position provient du GPS/navigateur, d’une saisie manuelle, d’une adresse approximative ou d’une autre source ; sa précision, son caractère facultatif, les destinataires, la durée de conservation et les possibilités de recherche manuelle doivent être documentés.

## 7. Destinataires, prestataires et communications

Les prestataires ou canaux déclarés à ce stade sont :

- **Supabase** : base de données, authentification et fonctions associées, selon la configuration réelle ;
- **Vercel** : hébergement et distribution de l’application ;
- **Google / Gmail / Google Apps Script** : l’envoi de courriers automatiques de bienvenue est documenté comme utilisant Google Apps Script et le service MailApp ;
- **WhatsApp Business** : canal supplémentaire déclaré par l’exploitant, dont l’usage précis, le compte et les flux de données doivent encore être vérifiés.

L’audit du dépôt n’a pas identifié, dans les fichiers consultés, une intégration technique WhatsApp Business clairement documentée. Son utilisation peut être manuelle ou externe au code ; il faut la confirmer avant de la décrire comme un prestataire intégré. Lorsque l’utilisateur contacte NAXA via WhatsApp Business, des données de message, de compte, de numéro et des métadonnées peuvent être traitées par le fournisseur conformément à ses propres conditions. La version publiée devra préciser les catégories réellement échangées, les finalités, les rôles des parties et les éventuels transferts.

La liste ci-dessus n’est pas réputée exhaustive. NAXA doit vérifier les sous-traitants ultérieurs, les régions d’hébergement, les accès techniques, les contrats, les pays de traitement et les garanties applicables. Les données ne doivent être communiquées qu’aux destinataires nécessaires et dans le cadre d’un fondement légal approprié.

## 8. Transferts internationaux

Selon les régions et services effectivement configurés, certaines données peuvent être hébergées ou traitées en dehors du Cameroun. Les pays, destinataires, catégories de données, garanties et formalités éventuellement requises doivent être identifiés avant publication. NAXA ne doit pas affirmer qu’il n’existe aucun transfert international tant que l’inventaire des fournisseurs et de leurs configurations n’est pas achevé.

## 9. Durées de conservation et suppression

Le principe communiqué par l’exploitant est de supprimer les données **dès que possible après la suppression du compte**, sous réserve des obligations légales applicables et des besoins légitimes de sécurité. Cela ne signifie pas nécessairement l’effacement instantané de toutes les copies techniques, journaux ou sauvegardes.

Avant publication, NAXA doit établir, justifier et appliquer une grille de conservation par catégorie, notamment pour :
- les données de compte et de profil ;
- les recherches et la localisation ;
- les images d’ordonnance et les résultats OCR éventuels ;
- les termes de recherche issus d’une ordonnance ;
- les réservations, commandes, abonnements, commissions, factures et pièces comptables ;
- les journaux de sécurité et d’authentification ;
- les messages d’assistance et échanges WhatsApp ;
- les sauvegardes, archives et copies résiduelles.

Pour chaque catégorie, la durée ou le critère de durée, le point de départ, le processus de suppression, les exceptions légales et le délai d’expiration des sauvegardes doivent être confirmés. Aucune durée précise n’est affirmée dans cette version faute d’inventaire vérifié.

## 10. Sécurité des données et du service

Cette section expose les principes de sécurité à appliquer et à vérifier ; elle ne constitue ni une certification ni une garantie d’absence d’incident.

### 10.1 Contrôle d’accès et séparation des espaces
- Limiter les accès aux personnes et services qui en ont besoin.
- Séparer les espaces Client, Pharmacie et administration.
- Vérifier les permissions côté serveur et dans la base ; masquer un bouton ne suffit pas.
- Tester les politiques RLS et les autorisations pour les accès permis et interdits.
- Appliquer le moindre privilège et réexaminer les accès lors d’un changement de rôle ou du départ d’un collaborateur.

### 10.2 Authentification et sessions
Les parcours de création de compte, vérification d’adresse e-mail, connexion, récupération et gestion des sessions doivent être contrôlés. Les jetons de session et de récupération ne doivent pas être exposés dans des URL, journaux ou interfaces non prévues. Les erreurs ne doivent pas révéler de secrets. Les durées de session, révocations et protections contre les tentatives abusives doivent être vérifiées dans la configuration réelle.

### 10.3 Secrets et configuration
Les mots de passe, clés privilégiées, jetons et secrets d’intégration doivent être conservés dans des mécanismes protégés, non dans le code public, le navigateur ou les journaux. Les variables exposées au navigateur ne doivent contenir aucun secret privilégié. Les secrets doivent être accessibles au seul composant qui en a besoin et renouvelés en cas d’exposition suspectée.

### 10.4 Transmissions et prestataires
Les connexions doivent utiliser le chiffrement lorsqu’il est pris en charge. Les protections, régions et accès dépendent des services et paramètres réellement configurés. Les accès des prestataires, leurs sous-traitants et les transferts éventuels doivent être documentés et vérifiés.

### 10.5 Journaux, sauvegardes et incidents
Les journaux doivent être limités aux besoins opérationnels et de sécurité et ne pas contenir inutilement des mots de passe, secrets, jetons ou contenus d’ordonnance. Les sauvegardes doivent être protégées, leurs accès limités et leur durée de conservation définie. NAXA doit disposer d’une procédure de détection, de traitement et de notification des incidents conformément aux obligations applicables. L’existence et l’efficacité de ces mesures doivent être testées avant qu’elles soient présentées comme pleinement opérationnelles.

## 11. Cookies, stockage local et communications

Les cookies, le stockage local, les outils de mesure d’audience, pixels publicitaires et autres traceurs doivent être audités. Cette version ne prétend pas qu’aucun traceur n’est utilisé. Les traceurs non essentiels, s’ils existent, doivent être décrits et soumis au choix de l’utilisateur lorsque la loi l’exige.

Les messages nécessaires au fonctionnement du service doivent être distingués des communications promotionnelles. NAXA doit préciser les canaux utilisés, les bases juridiques, les durées de conservation et les moyens de s’opposer aux communications lorsque cela s’applique.

## 12. Droits et demandes

Sous réserve des conditions et limites prévues par le droit applicable, une personne peut demander l’accès aux données la concernant, leur rectification ou suppression, la limitation ou l’opposition à certains traitements, et retirer un consentement lorsque le traitement repose sur celui-ci. Elle peut également introduire une réclamation auprès de l’autorité compétente selon la procédure applicable.

Les demandes peuvent être adressées à **naxa.home@gmail.com**. NAXA doit définir une procédure permettant de vérifier raisonnablement l’identité du demandeur, de suivre la demande, de respecter les délais applicables et de traiter les exceptions légales. Les droits et procédures exacts doivent être validés par un conseil au regard du droit camerounais.

## 13. Modifications de la politique

La version et la date de mise à jour doivent être affichées. En cas de changement substantiel des finalités, des destinataires, des transferts ou des traitements de données sensibles, les personnes doivent être informées et un consentement recueilli lorsque la loi l’exige.

## 14. Cadre juridique à vérifier

- Loi camerounaise n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel : https://prc.cm/fr/multimedia/documents/10258-loi-n-2024-017-du-23-12-2024-web
- Loi n° 2010/021 du 21 décembre 2010 régissant le commerce électronique au Cameroun : https://www.minpostel.gov.cm/index.php/fr/les-textes/telecoms-tic/lois-telecoms-tic/274-loi-n-2010-021-du-21-decembre-2010-regissant-le-commerce-electronique-au-cameroun
- Textes relatifs aux établissements pharmaceutiques (Ministère de la Santé publique / DPML) : https://www.dpml.cm/index.php/fr/publications/normes-et-legislation/etablissements-pharmaceutiques

L’applicabilité des textes, les formalités préalables, les obligations concernant les données de santé et les transferts internationaux doivent être validés par un conseil juridique compétent.

---

## Liste de contrôle obligatoire avant publication

- [ ] Confirmer l’identité légale, l’immatriculation de l’EI, les identifiants légaux/fiscaux requis et l’adresse complète.
- [ ] Cartographier les données réellement collectées par le code, les API, bases, journaux et services tiers.
- [ ] Tester le parcours OCR complet, notamment l’image, le texte, les candidats, les termes de recherche, les requêtes réseau et la suppression.
- [ ] Tester le contrôle d’âge sur la version déployée.
- [ ] Confirmer les prestataires, les régions, les sous-traitants et les transferts internationaux.
- [ ] Définir et mettre en œuvre les durées de conservation et de suppression par catégorie, y compris sauvegardes et termes de recherche.
- [ ] Auditer cookies, stockage local, analytics, publicité, e-mails et WhatsApp Business.
- [ ] Définir les bases juridiques, les formalités applicables aux données de santé et les mesures d’information/consentement.
- [ ] Vérifier la sécurité réelle des accès, RLS, sessions, secrets, journaux, sauvegardes et du script Google Apps Script/Gmail.
- [ ] Définir une procédure opérationnelle de réponse aux demandes de droits et aux incidents.
- [ ] Harmoniser la politique avec les CGU, les écrans de consentement et les contrats commerciaux.
- [ ] Faire valider les documents et formalités par un conseil juridique connaissant le droit camerounais et la réglementation pharmaceutique.
- [ ] Obtenir l’autorisation explicite de l’exploitant avant toute publication ou déploiement.
