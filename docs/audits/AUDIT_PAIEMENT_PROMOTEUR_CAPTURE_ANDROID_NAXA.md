# Audit — capture Android du paiement Promoteur NAXA

> **État courant sur `main` — 13 novembre 2026**
>
> Le contenu daté du 7 au 11 novembre ci-dessous constitue l'historique des étapes QA ; il ne décrit plus à lui seul l'architecture actuelle.
>
> ## Circuit de paiement actuellement intégré
>
> - **Promoteur :** le compagnon Android standard prépare le paiement sur le téléphone enrôlé. Après le débit, le Promoteur partage volontairement son SMS à NAXA Paiement (`POST /api/promoteur/paiements/share`). Le montant est comparé au tarif d'abonnement chargé côté serveur. L'ancien endpoint `/api/promoteur/paiements/capture` répond désormais `410` et redirige vers le partage volontaire.
> - **Administrateur :** la variante Android Admin reçoit le SMS de crédit après consentement explicite et permission Android. Le serveur rapproche canal, montant, destination, payeur et fenêtre horaire. Un cas incomplet, ambigu ou discordant reste en vérification manuelle.
> - **Double preuve Promoteur :** l'activation automatique exige un SMS de débit Promoteur de niveau 1 et un SMS de crédit Admin de niveau 2, tous deux rattachés au même règlement et au même canal. Les références de transaction du débit et du crédit peuvent être différentes ; la référence du SMS Admin doit correspondre à sa revendication de niveau 2. Les deux preuves doivent aussi passer les contrôles montant, destination, payeur et temps. Le partage manuel seul ne déclenche jamais un renouvellement.
> - **Client :** après confirmation du stock, le Client choisit MTN Mobile Money ou Orange Money, partage volontairement son SMS ou saisit les champs manuellement. La déclaration est visible dans la Caisse avec montant, numéro payeur, date et source ; la pharmacie contrôle le crédit et confirme via le ticket POS. Le SMS partagé ne vaut jamais encaissement.
> - **Compagnon Android :** le produit est sous `android/payment-companion/` avec variantes `standard` et `admin`. La variante standard n'écoute pas les SMS ; elle traite le partage volontaire Client/Promoteur. La permission `RECEIVE_SMS` est limitée à la variante Admin.
>
> ## Mise à jour fonctionnelle — 13 novembre 2026

Cette mise à jour remplace toute instruction antérieure qui reportait la lecture des notifications côté Pharmacie ou interdisait cette fonction au Promoteur pendant le pilote.

- Client : partage volontaire du SMS uniquement ; aucun accès aux notifications ou SMS en arrière-plan. Le service Android refuse explicitement le rôle Client.
- Pharmacie : dans le modèle actuel, le paiement de l'abonnement pharmacie est porté par le compte Promoteur. Ce profil peut activer la lecture facultative des notifications et partager le SMS volontairement.
- Partenaire : le compagnon peut enrôler chaque partenaire actif pour lequel l'utilisateur est owner/manager. Notifications et SMS partagés sont conservés comme candidats de revue manuelle. Le cycle métier d'abonnement Partenaire (tarif, intention, échéance, règlement, activation) n'existe pas encore ; aucune activation automatique n'est déclenchée.
- Administrateur : garde tous les mécanismes, y compris le lecteur de notifications, le partage volontaire et le récepteur SMS_RECEIVED avec son consentement et sa permission distincte.
- Le lecteur Android nécessite l'accès spécial aux notifications. Android expose techniquement un flux général ; NAXA filtre localement les seuls titres exacts OrangeMoney et MobileMoney. Une notification ne prouve pas l'origine brute du SMS et reste toujours en revue manuelle.
- Seul le SMS réellement reçu via SMS_RECEIVED sur le téléphone Admin, avec adresse d'origine exacte OrangeMoney ou MobileMoney, peut alimenter la preuve de crédit authentifiée. Les notifications ne sont jamais envoyées à l'endpoint de capture authentifiée.
- Les coordonnées marchandes Client → Pharmacie sont séparées par établissement et opérateur. Le Client voit nom, téléphone, code marchand à 6 chiffres et montant. Le composeur est préparé avec MTN *126*4*<code 6 chiffres>*<montant># ou Orange #150*47#. Le préremplissage du montant Orange reste à confirmer sur SIM réelle.
- La distribution reste par APK privé NAXA, sans Play Store.

Les candidats Promoteur et Partenaire n'écrivent pas le texte SMS brut, ne ferment pas une intention d'abonnement et n'activent pas de compte. Les deux migrations de candidats du lot courant doivent être vérifiées sur Replay avant d'être considérées comme installées.

## État des migrations et de la distribution
>
> Les migrations `20261113152922_payment_sms_declarations_and_dual_proof_guard.sql` et `20261113152925_promoteur_payment_require_dual_sms_proofs.sql` sont appliquées sur Supabase Replay `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`) et enregistrées sous ces versions. Les deux migrations n'ont pas été appliquées sur Production ; aucun déploiement Production n'a été lancé.
>
> La CI Android avait confirmé la compilation, les tests unitaires et l'assemblage Debug des deux variantes sur le commit antérieur `c7bc186bdfe3ad38db4c2db83c9df1f109e24763`. Les APK Release signés, l'allowlist réelle de la permission SMS sur un téléphone Admin, les SMS Orange/MTN de production et les E2E Client→Caisse / Promoteur→Admin restent à valider sur les environnements/appareils autorisés.
>
> ---

Date : 7 novembre 2026  
Branche : `qa/e2e-stabilisation-20261106`  
Environnement de données autorisé : Supabase Replay `pwfftcsjyeibxxqhwysw`.

## Architecture livrée sur QA

- Le Promoteur déjà authentifié crée un paiement de 30 minutes avant de payer. Le montant est relu depuis son abonnement, le canal est choisi parmi les canaux mobile money actifs et la destination marchande est figée dans le paiement préparé.
- Un appareil Android doit s'enrôler au moyen d'une session Supabase du même compte Promoteur. Le serveur ne stocke que le hash d'un jeton d'appareil.
- Le compagnon transmet un événement de notification normalisé avec le même compte et le jeton lié au téléphone.
- Le serveur rapproche le canal, le montant FCFA et le bénéficiaire de la destination enregistrée. Une correspondance crée seulement une déclaration de règlement existante, avec statut `en_attente`, et déclenche la notification Admin déjà en place.
- Tout écart est conservé comme capture `mismatch` et envoyé vers `manual_review`; aucun règlement n'est soumis.
- Une notification Android n'est jamais une preuve d'encaissement. Seule la vérification indépendante par NAXA peut déclencher l'activation et le reçu.

## Endpoints

- `POST /api/promoteur/paiements/device/register` : enrôlement de l'appareil Android par le Promoteur connecté.
- `POST /api/promoteur/paiements/intent` : préparation avant paiement, appelée uniquement par le compagnon Android avec le Bearer Supabase du Promoteur, `x-naxa-device-id` et `x-naxa-device-token`. La page web ne peut pas créer une intention pour un téléphone qui n'est pas celui qui exécutera la transaction.
- `POST /api/promoteur/paiements/capture` : réception des données normalisées d'une notification depuis le compagnon Android.

Contrat de capture : Bearer token de session Supabase du Promoteur, `deviceId`, jeton d'appareil, canal, référence de transaction, montant, devise `FCFA`, bénéficiaire normalisé, compte payeur masqué éventuel et date de transaction. Le compagnon ne doit jamais envoyer PIN, OTP ni le texte intégral de la notification.

## Limites constatées

- Le dépôt NAXA audité ne contient aucun projet Android/Kotlin/Java/Gradle ni service `NotificationListenerService`. Les endpoints et le contrat backend sont prêts, mais la capture réelle sur le téléphone ne sera activée qu'après intégration de ce contrat dans le compagnon Android natif.
- Aucune clé marchande MTN/Orange ou autorisation d'API opérateur n'est configurée dans le dépôt audité. La détection locale est donc un signal client à rapprocher, pas un callback opérateur authentifié.
- Le parcours manuel antérieur demeure disponible en secours.
- Aucun statut de paiement, abonnement ou pharmacie n'est confirmé par la capture Android.
- Les migrations sont destinées au Replay. Production n'est pas modifiée et aucun déploiement Vercel n'est lancé.

## Vérifications à exécuter

- Appliquer la migration sur Replay et vérifier les ACL/RLS.
- Exécuter les tests statiques du contrat et la CI groupée.
- Terminer le module Android natif puis tester sur un téléphone réel les notifications MTN et Orange, les cas montant/destination incorrects, les doublons et l'absence de notification.
- Tester ensuite le rapprochement d'un paiement réel via API opérateur ou compte marchand avant d'autoriser une automatisation plus forte.


## État de la migration et contrôles Replay — 7 novembre 2026

- Migration appliquée avec succès sur Replay : version distante `20261107075228`, nom `promoteur_payment_device_capture_20261107`. Le fichier source est aligné sur ce numéro de version.
- Contrôle SQL : les trois tables existent ; RLS est activée sur les trois ; zéro droit de table pour `anon` et `authenticated` ; `preuve_path` est nullable comme l'exige le RPC existant de déclaration sans fichier.
- Le conseiller Supabase retourne une information `rls_enabled_no_policy` sur ces trois nouvelles tables. C'est intentionnel : elles sont exclusivement pilotées par les routes serveur via `service_role`, et aucun accès direct Data API n'est accordé aux clients.
- Les avertissements globaux SECURITY DEFINER (179 fonctions authentifiées) et protection contre les mots de passe compromis restent présents dans le projet Replay ; ils ne sont pas créés par cette migration.
- Aucun appareil Android Promoteur ni événement de notification réel n'est présent dans Replay à ce stade. La capture native et les essais MTN/Orange sur téléphone ne sont donc pas validés.
- Main reste inchangée. Aucune donnée ni migration Supabase Production n'a été touchée, et aucun déploiement Vercel n'a été lancé.

- Renforcement QA : la préparation du paiement a été déplacée côté compagnon Android ; l'interface web est uniquement en lecture et rappelle que la page ne peut pas se substituer au téléphone enrôlé.


## Mise à jour — circuit à trois niveaux, 11 novembre 2026

Le code QA ajoute une analyse FR/EN par règles et repli Gemini/Groq, avec extraction déterministe et sans stockage du SMS brut. Le formulaire Promoteur joint une preuve dès la déclaration et la soumission est enregistrée au niveau 3 en revue manuelle. Le message court MTN Successintegral n'est pas accepté comme preuve complète.

L'API du niveau 1 exige désormais le corps SMS, l'expéditeur brut (OrangeMoney/MobileMoney), l'heure de réception et le rapprochement d'un paiement préalablement préparé sur un appareil Promoteur enrôlé. La destination et le montant sont comparés aux valeurs lues côté serveur. Cette API n'est pas encore raccordée à un compagnon Android natif : le dépôt ne contient toujours pas de module Android.

Le niveau 2 est préparé côté base par le registre de références secondaires, qui permet de rattacher une référence marchand différente au règlement existant sans réutilisation globale. L'enrôlement d'un téléphone Admin et l'endpoint de capture Admin restent à construire.

La migration ajoute une unicité globale des références normalisées, des horodatages distincts opérateur/réception/déclaration et une fenêtre de 24 h. La fenêtre préserve un compte déjà actif jusqu'à la fin du délai sans réactiver une suspension indépendante ou un profil/pharmacie déjà inactif. Les preuves manuelles sont analysées mais ne peuvent pas déclencher seules un renouvellement.

La migration `20261111013000_promoteur_payment_three_stage_verification` a été appliquée sur Supabase Replay. Le test SQL `supabase/tests/promoteur_payment_three_stage_verification.sql` est PASS après correction de l'assertion d'inspection PL/pgSQL. Migration de garde secondaire appliquée ensuite : version Replay `20261111011317`. ACL vérifiées : `anon=false`, `authenticated=false`, `service_role=true` sur les RPC de déclaration et d'ajout de référence secondaire. Les trois index uniques, dont celui des événements de capture, et le cron `naxa-promoteur-validity-hourly` sont présents. Replay ne contient encore aucune destination marchande configurée (0 ligne active) ; aucun paiement réel de bout en bout ne peut donc être simulé. Aucune Production et aucun déploiement ne sont concernés.


**Contrôles locaux complémentaires — 11/11/2026 :** parseur testé sur les cinq modèles SMS transmis (Orange payeur, Orange marchand, MTN payeur, MTN marchand, MTN Successintegral court) : 5/5 PASS. Fallback IA simulé avec une réponse structurée Gemini : 2/2 PASS (date anglaise DD/MM/YYYY acceptée, date opérateur inventée rejetée). Aucune clé réelle ni appel fournisseur IA n'a été utilisé pour ces tests.


## Mise à jour de clôture des cinq points — 11 novembre 2026

### 1. Capture du téléphone Admin
Ajout de l'enrôlement Admin par compte actif et par canal, avec code marchand figé et jeton d'appareil haché côté base. Nouvel endpoint POST /api/admin/paiements/device/register, capture POST /api/admin/paiements/capture, table de journal naxa_admin_payment_capture_events, et liste des événements dans le cockpit Admin.

### 2. Compagnon Android natif
Projet source Java/Gradle ajouté sous android/payment-companion/. Il utilise SMS_RECEIVED_ACTION et SmsMessage.getOriginatingAddress() (adresse brute), jamais le libellé d'un contact ; il ne demande pas READ_SMS et n'inspecte pas l'historique. Les jetons Supabase et appareil sont chiffrés avec Android Keystore AES-GCM. L'APK n'est pas compilé : l'environnement ne contient ni Gradle, ni Android SDK, ni ADB.

**Blocage de distribution :** la permission RECEIVE_SMS est dangereuse et hard-restricted. Google Play Protect peut bloquer une application téléchargée d'Internet lorsqu'elle la déclare. La capture native exige une voie d'installation approuvée qui permet l'allowlist de cette permission ; le téléchargement direct depuis le site NAXA n'est donc pas validé. Ne pas désactiver Play Protect ni contourner cette restriction.

### 3. Confirmation/renouvellement Admin SMS
Le RPC naxa_promoteur_payment_auto_confirm_admin_sms appelle la confirmation Admin canonique uniquement après contrôle du SMS de crédit, de l'expéditeur alphanumérique exact, du canal, du montant, de la destination figée, du payeur, de la référence unique liée au dossier et de l'heure. Une capture reçue 15 minutes avant à 30 minutes après l'heure de paiement déclarée est acceptée ; tout cas absent, tardif, dupliqué ou ambigu reste manuel. Les suspensions indépendantes ne sont pas réactivées.

### 4. OCR des justificatifs
PromoteurPaymentProofOcr et promoteurPaymentProofOcr.ts ajoutent la lecture locale d'images et de PDF (trois pages maximum), bilingue français/anglais. Les champs reconnus et la confiance OCR sont transmis au serveur ; le texte complet demeure temporaire côté navigateur et n'est pas persisté. L'OCR classe et rapproche, mais ne confirme jamais un paiement.

### 5. Tests et preuves
Migrations Replay : versions 20261111011044, 20261111011317, 20261111012919, 20261111012923, 20261111013438, 20261111013608. Tests SQL promoteur_payment_three_stage_verification.sql et promoteur_payment_admin_sms_auto_confirm.sql : PASS. Les scripts Node de régression sont ajoutés mais pas exécutés dans cette session ; typecheck, lint, build Next, build Android et tests sur SIM réelles ne sont pas prouvés.

**Bloqueurs d'E2E :** aucune destination marchande réelle n'est configurée dans Replay (0 destination active) et aucun téléphone réel n'est enrôlé. L'expéditeur SMS alphanumérique n'est pas une signature cryptographique ; le test réel doit inclure les possibilités de spoofing et les délais opérateur.

### Preuves Replay — 13 novembre 2026

- `supabase/tests/promoteur_payment_three_stage_verification.sql` : **PASS**.
- `supabase/tests/promoteur_payment_admin_sms_auto_confirm.sql` : **PASS**.
- Vérification SQL : six champs de déclaration Client présents ; RLS active ; accès directs à la table et à la RPC Client refusés à `anon/authenticated` ; RPC Caisse réservée aux utilisateurs authentifiés avec contrôle de pharmacie ; auto-confirmation Promoteur réservée à `service_role` ; les deux niveaux de preuve sont présents dans la définition effective.
- Données Replay au contrôle : 0 destination marchande active, 0 appareil Promoteur actif, 0 appareil Admin actif, 0 événement de capture, 0 intention de paiement active. Les tests réels Orange/MTN et l'E2E Client→Caisse ne sont donc pas encore possibles.

