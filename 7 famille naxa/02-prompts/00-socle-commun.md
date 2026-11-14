> Version Markdown issue de la version texte source.
> Source : `Prompts_00_Socle_commun.txt`. Le contenu des consignes est conservé ; seuls le titre et les séparateurs de prompts sont balisés en Markdown.

# Dossier de prompts — Socle commun et mode d'emploi
Prompts pour ChatGPT · version 1.0 · 31 octobre 2026 · travail sur main, sans branche, PR, CI ni déploiement sans accord explicite

## PROMPT 0.1 — Cadrage technique et structure du projet
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Famille de 7 applications Android (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel) qui partagent la même architecture, le même compte client et un seul backend Supabase. Ce prompt construit le SOCLE COMMUN réutilisé par toutes les applications. Cahiers des charges : Cahier_des_charges_01 à 07 (PDF), que je peux te coller par extraits.
ÉTAT DE DÉPART : aucun fichier de passation, c'est la première étape.
MISSION : Choisir la pile technique unique des 7 applications et la structure du projet, sans écrire de code.
À FAIRE :
  1. Compare Android natif (Kotlin, Room, WorkManager, récepteur de SMS) et Flutter ou Capacitor avec plugin SMS. Critère décisif : fiabilité de la lecture des SMS en arrière-plan sur téléphones d'entrée de gamme. Recommande UNE option et justifie-la en 10 lignes.
  2. Compare un monorepo (un dossier noyau commun + 7 dossiers d'applications, avec saveurs de build) et des dépôts séparés. Recommande une option avec ses avantages et ses limites.
  3. Propose les conventions : nommage, internationalisation FR/EN sans texte en dur, thème par application via des jetons de design, gestion d'erreurs, journaux, versions (table app_versions).
  4. Propose les identifiants d'installation des 7 applications (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel).
  5. Liste les bibliothèques gratuites retenues (scan de code-barres, reconnaissance de texte sur photo, voix, PDF, graphiques) avec leur licence.
  6. Termine par un document de décisions et la liste de tes questions. Attends mon accord explicite avant tout code.
CONTRÔLES (en local uniquement, aucune CI) : Aucun code ; un document de décisions clair ; je valide par écrit avant le prompt 0.2.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Pensé pour des utilisateurs non techniciens sur téléphones d'entrée de gamme : écrans simples, gros boutons, trois touches au plus vers un écran clé, application légère.
RÈGLES DE TRAVAIL OBLIGATOIRES :
  1. Travaille uniquement sur la branche main. Ne crée aucune branche parallèle.
  2. N'ouvre aucune pull request (PR).
  3. Ne lance, ne déclenche et n'attends aucune vérification CI (aucun workflow GitHub Actions). Les tests se font en local uniquement, et seulement ceux que ce prompt demande.
  4. Ne fais aucun déploiement : ni publication d'APK ou de release, ni migration appliquée à Supabase, ni fonction serveur déployée, ni mise en ligne d'une page. Prépare seulement les fichiers.
  5. Tout ce qui précède est interdit sans mon accord explicite, écrit dans cette conversation, pour chaque action concernée. Si une étape semble l'exiger (y compris un push qui déclencherait un workflow automatique), arrête-toi, explique pourquoi et demande-moi.
  6. Si tu n'as pas accès à mon dépôt, livre les fichiers complets avec leur chemin exact, prêts à copier ; ne suppose pas qu'ils existent déjà.
  7. N'invente pas : si une information manque, pose-moi la question (une seule à la fois) avant de continuer.
MODÈLE DU FICHIER DE PASSATION À PRODUIRE EN FIN DE RÉPONSE :
  FICHIER DE PASSATION — [application] — [numéro du prompt] — [date]
  1. Fait : ce qui est terminé, en une ligne chacun.
  2. Fichiers créés ou modifiés : chemins exacts.
  3. Tables, fonctions et écrans créés : noms exacts.
  4. Décisions techniques retenues et leur raison.
  5. Points ouverts et questions pour moi.
  6. Prochain prompt recommandé (numéro et titre).
  7. Actions qui demandent mon accord explicite (push, migration, déploiement…).
Termine par : « Étape terminée. J'attends ton accord avant de passer à la suivante. »


## PROMPT 0.2 — Schéma de données commun
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Famille de 7 applications Android (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel) qui partagent la même architecture, le même compte client et un seul backend Supabase. Ce prompt construit le SOCLE COMMUN réutilisé par toutes les applications. Cahiers des charges : Cahier_des_charges_01 à 07 (PDF), que je peux te coller par extraits.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Écrire le schéma PostgreSQL commun à toutes les applications, sous forme de migrations non appliquées.
À FAIRE :
  1. Comptes : organizations, outlets, users, roles, user_roles, devices (jeton FCM, identifiant appareil, empreinte de signature de l'APK), clients (fiche créée par l'administration), client_apps (applications autorisées par client : kiosko, bootik, zipple, naxa_services, cotiz, loyable, naxa_hotel), sales_reps, partners.
  2. Abonnement : plans, subscriptions (application, palier, échéance, statut), payments, payment_matches (identifiant de transaction UNIQUE, y compris en accès simultané), promo_codes, referrals, partner_commissions.
  3. Transverse : notifications, notification_preferences, audit_log, app_versions (version minimale exigée), parser_rules (règles de lecture des SMS versionnées), support_tickets, backups.
  4. Écris les migrations SQL dans des fichiers ordonnés, avec clés, contraintes, index, horodatages, suppression douce. Décris aussi la table locale sync_queue (SQLite) et fournis un dictionnaire de données en tableau.
CONTRÔLES (en local uniquement, aucune CI) : SQL relu sans erreur de syntaxe ; aucune migration appliquée ; dictionnaire de données livré.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Pensé pour des utilisateurs non techniciens sur téléphones d'entrée de gamme : écrans simples, gros boutons, trois touches au plus vers un écran clé, application légère.
RÈGLES DE TRAVAIL OBLIGATOIRES :
  1. Travaille uniquement sur la branche main. Ne crée aucune branche parallèle.
  2. N'ouvre aucune pull request (PR).
  3. Ne lance, ne déclenche et n'attends aucune vérification CI (aucun workflow GitHub Actions). Les tests se font en local uniquement, et seulement ceux que ce prompt demande.
  4. Ne fais aucun déploiement : ni publication d'APK ou de release, ni migration appliquée à Supabase, ni fonction serveur déployée, ni mise en ligne d'une page. Prépare seulement les fichiers.
  5. Tout ce qui précède est interdit sans mon accord explicite, écrit dans cette conversation, pour chaque action concernée. Si une étape semble l'exiger (y compris un push qui déclencherait un workflow automatique), arrête-toi, explique pourquoi et demande-moi.
  6. Si tu n'as pas accès à mon dépôt, livre les fichiers complets avec leur chemin exact, prêts à copier ; ne suppose pas qu'ils existent déjà.
  7. N'invente pas : si une information manque, pose-moi la question (une seule à la fois) avant de continuer.
MODÈLE DU FICHIER DE PASSATION À PRODUIRE EN FIN DE RÉPONSE :
  FICHIER DE PASSATION — [application] — [numéro du prompt] — [date]
  1. Fait : ce qui est terminé, en une ligne chacun.
  2. Fichiers créés ou modifiés : chemins exacts.
  3. Tables, fonctions et écrans créés : noms exacts.
  4. Décisions techniques retenues et leur raison.
  5. Points ouverts et questions pour moi.
  6. Prochain prompt recommandé (numéro et titre).
  7. Actions qui demandent mon accord explicite (push, migration, déploiement…).
Termine par : « Étape terminée. J'attends ton accord avant de passer à la suivante. »


## PROMPT 0.3 — Sécurité des données et règles RLS
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Famille de 7 applications Android (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel) qui partagent la même architecture, le même compte client et un seul backend Supabase. Ce prompt construit le SOCLE COMMUN réutilisé par toutes les applications. Cahiers des charges : Cahier_des_charges_01 à 07 (PDF), que je peux te coller par extraits.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Écrire et tester localement les règles de sécurité par ligne.
À FAIRE :
  1. Un point de vente ne voit que ses lignes ; le compte mère voit tous ses points ; un gérant ne voit jamais un autre propriétaire.
  2. L'administration voit des chiffres agrégés et les informations d'abonnement, jamais les transactions détaillées ; le commercial et le partenaire n'ont aucun accès aux transactions.
  3. Un point dont l'abonnement est échu au-delà de la tolérance ne peut ni lire ni écrire, sauf l'écran de paiement et le bouton « J'ai payé ».
  4. Écris les fonctions d'aide (par exemple is_admin(), outlet_ids()) et un script de tests SQL local pour chaque scénario ci-dessus, avec les résultats attendus.
CONTRÔLES (en local uniquement, aucune CI) : Tous les scénarios de test écrits avec résultat attendu ; rien d'appliqué à Supabase sans mon accord.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Pensé pour des utilisateurs non techniciens sur téléphones d'entrée de gamme : écrans simples, gros boutons, trois touches au plus vers un écran clé, application légère.
RÈGLES DE TRAVAIL OBLIGATOIRES :
  1. Travaille uniquement sur la branche main. Ne crée aucune branche parallèle.
  2. N'ouvre aucune pull request (PR).
  3. Ne lance, ne déclenche et n'attends aucune vérification CI (aucun workflow GitHub Actions). Les tests se font en local uniquement, et seulement ceux que ce prompt demande.
  4. Ne fais aucun déploiement : ni publication d'APK ou de release, ni migration appliquée à Supabase, ni fonction serveur déployée, ni mise en ligne d'une page. Prépare seulement les fichiers.
  5. Tout ce qui précède est interdit sans mon accord explicite, écrit dans cette conversation, pour chaque action concernée. Si une étape semble l'exiger (y compris un push qui déclencherait un workflow automatique), arrête-toi, explique pourquoi et demande-moi.
  6. Si tu n'as pas accès à mon dépôt, livre les fichiers complets avec leur chemin exact, prêts à copier ; ne suppose pas qu'ils existent déjà.
  7. N'invente pas : si une information manque, pose-moi la question (une seule à la fois) avant de continuer.
MODÈLE DU FICHIER DE PASSATION À PRODUIRE EN FIN DE RÉPONSE :
  FICHIER DE PASSATION — [application] — [numéro du prompt] — [date]
  1. Fait : ce qui est terminé, en une ligne chacun.
  2. Fichiers créés ou modifiés : chemins exacts.
  3. Tables, fonctions et écrans créés : noms exacts.
  4. Décisions techniques retenues et leur raison.
  5. Points ouverts et questions pour moi.
  6. Prochain prompt recommandé (numéro et titre).
  7. Actions qui demandent mon accord explicite (push, migration, déploiement…).
Termine par : « Étape terminée. J'attends ton accord avant de passer à la suivante. »


## PROMPT 0.4 — Comptes créés par l'administration
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Famille de 7 applications Android (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel) qui partagent la même architecture, le même compte client et un seul backend Supabase. Ce prompt construit le SOCLE COMMUN réutilisé par toutes les applications. Cahiers des charges : Cahier_des_charges_01 à 07 (PDF), que je peux te coller par extraits.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire le parcours d'ouverture et de gestion des accès clients, sans inscription libre.
À FAIRE :
  1. Création par l'administration : fiche client, applications autorisées, palier, durée, remise ou période d'essai éventuelle ; génération des identifiants (identifiant = numéro de téléphone) et du lien de téléchargement.
  2. Première connexion : changement obligatoire du mot de passe (6 caractères minimum), puis code d'accès local à 4 chiffres ou empreinte à chaque ouverture.
  3. Mot de passe oublié : par e-mail s'il existe, sinon demande de réinitialisation sur WhatsApp traitée par l'administration après contrôle d'identité.
  4. Jusqu'à 2 appareils actifs par point (le plus ancien est fermé au-delà), notification au propriétaire pour tout nouvel appareil, déconnexion à distance, blocage temporaire après 5 tentatives, aucun code envoyé par SMS payant.
  5. Employés créés par le gérant ou le propriétaire avec leur propre code d'accès ; changement d'utilisateur sans déconnexion ; fonction serveur de création de compte (non déployée).
CONTRÔLES (en local uniquement, aucune CI) : Scénarios testés en local : création, première connexion, troisième appareil, 5 tentatives échouées.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Pensé pour des utilisateurs non techniciens sur téléphones d'entrée de gamme : écrans simples, gros boutons, trois touches au plus vers un écran clé, application légère.
RÈGLES DE TRAVAIL OBLIGATOIRES :
  1. Travaille uniquement sur la branche main. Ne crée aucune branche parallèle.
  2. N'ouvre aucune pull request (PR).
  3. Ne lance, ne déclenche et n'attends aucune vérification CI (aucun workflow GitHub Actions). Les tests se font en local uniquement, et seulement ceux que ce prompt demande.
  4. Ne fais aucun déploiement : ni publication d'APK ou de release, ni migration appliquée à Supabase, ni fonction serveur déployée, ni mise en ligne d'une page. Prépare seulement les fichiers.
  5. Tout ce qui précède est interdit sans mon accord explicite, écrit dans cette conversation, pour chaque action concernée. Si une étape semble l'exiger (y compris un push qui déclencherait un workflow automatique), arrête-toi, explique pourquoi et demande-moi.
  6. Si tu n'as pas accès à mon dépôt, livre les fichiers complets avec leur chemin exact, prêts à copier ; ne suppose pas qu'ils existent déjà.
  7. N'invente pas : si une information manque, pose-moi la question (une seule à la fois) avant de continuer.
MODÈLE DU FICHIER DE PASSATION À PRODUIRE EN FIN DE RÉPONSE :
  FICHIER DE PASSATION — [application] — [numéro du prompt] — [date]
  1. Fait : ce qui est terminé, en une ligne chacun.
  2. Fichiers créés ou modifiés : chemins exacts.
  3. Tables, fonctions et écrans créés : noms exacts.
  4. Décisions techniques retenues et leur raison.
  5. Points ouverts et questions pour moi.
  6. Prochain prompt recommandé (numéro et titre).
  7. Actions qui demandent mon accord explicite (push, migration, déploiement…).
Termine par : « Étape terminée. J'attends ton accord avant de passer à la suivante. »


## PROMPT 0.5 — Hors connexion et synchronisation
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Famille de 7 applications Android (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel) qui partagent la même architecture, le même compte client et un seul backend Supabase. Ce prompt construit le SOCLE COMMUN réutilisé par toutes les applications. Cahiers des charges : Cahier_des_charges_01 à 07 (PDF), que je peux te coller par extraits.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire le moteur hors connexion et de synchronisation réutilisé par toutes les applications.
À FAIRE :
  1. Base locale (SQLite ou Room) générique avec tables propres à chaque application ; file sync_queue ; synchronisation par lots avec reprise automatique et identifiant unique par opération contre les doublons.
  2. Une transaction issue d'un SMS est immuable : les corrections s'ajoutent comme écritures nouvelles, avec raison obligatoire et journal (qui, quand, avant, après).
  3. Tolérance hors connexion : 7 jours (paliers Essentiel et Pro), 14 jours (Réseau) ; l'heure du serveur est mémorisée à chaque synchronisation ; un recul d'horloge est détecté et restreint l'accès ; jours 1 à 3 tout fonctionne avec un petit témoin, avant la limite message « Connectez-vous avant le [date] », après la limite accès restreint (les données restent enregistrées).
  4. Règle de conflit : l'enregistrement le plus ancien côté serveur gagne, l'autre est signalé « à replacer » ; décris-la précisément et teste-la.
CONTRÔLES (en local uniquement, aucune CI) : Tests locaux : coupure puis retour du réseau sans doublon, recul d'horloge, dépassement de tolérance.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Pensé pour des utilisateurs non techniciens sur téléphones d'entrée de gamme : écrans simples, gros boutons, trois touches au plus vers un écran clé, application légère.
RÈGLES DE TRAVAIL OBLIGATOIRES :
  1. Travaille uniquement sur la branche main. Ne crée aucune branche parallèle.
  2. N'ouvre aucune pull request (PR).
  3. Ne lance, ne déclenche et n'attends aucune vérification CI (aucun workflow GitHub Actions). Les tests se font en local uniquement, et seulement ceux que ce prompt demande.
  4. Ne fais aucun déploiement : ni publication d'APK ou de release, ni migration appliquée à Supabase, ni fonction serveur déployée, ni mise en ligne d'une page. Prépare seulement les fichiers.
  5. Tout ce qui précède est interdit sans mon accord explicite, écrit dans cette conversation, pour chaque action concernée. Si une étape semble l'exiger (y compris un push qui déclencherait un workflow automatique), arrête-toi, explique pourquoi et demande-moi.
  6. Si tu n'as pas accès à mon dépôt, livre les fichiers complets avec leur chemin exact, prêts à copier ; ne suppose pas qu'ils existent déjà.
  7. N'invente pas : si une information manque, pose-moi la question (une seule à la fois) avant de continuer.
MODÈLE DU FICHIER DE PASSATION À PRODUIRE EN FIN DE RÉPONSE :
  FICHIER DE PASSATION — [application] — [numéro du prompt] — [date]
  1. Fait : ce qui est terminé, en une ligne chacun.
  2. Fichiers créés ou modifiés : chemins exacts.
  3. Tables, fonctions et écrans créés : noms exacts.
  4. Décisions techniques retenues et leur raison.
  5. Points ouverts et questions pour moi.
  6. Prochain prompt recommandé (numéro et titre).
  7. Actions qui demandent mon accord explicite (push, migration, déploiement…).
Termine par : « Étape terminée. J'attends ton accord avant de passer à la suivante. »


## PROMPT 0.6 — Notifications
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Famille de 7 applications Android (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel) qui partagent la même architecture, le même compte client et un seul backend Supabase. Ce prompt construit le SOCLE COMMUN réutilisé par toutes les applications. Cahiers des charges : Cahier_des_charges_01 à 07 (PDF), que je peux te coller par extraits.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire le système de notifications commun.
À FAIRE :
  1. Quatre canaux gratuits : notifications locales, push FCM (messages de données à haute priorité), messages WhatsApp préparés, centre de notifications dans l'application (lu/non lu, actions rejouables). Aucun SMS sortant payant.
  2. Canaux Android distincts : Critique, Opérations, Abonnement, Information, Coaching IA. Anti-doublon par clé d'événement, alerte réarmée quand le niveau est rétabli puis franchi à nouveau, heures calmes, préférences par type (sauf alertes critiques).
  3. Jeton FCM enregistré par appareil (table devices), rafraîchi automatiquement, supprimé à la déconnexion ; fonction serveur d'envoi avec statuts (créée, envoyée, reçue, lue, action faite) et nouvelles tentatives (non déployée).
  4. Écran « Santé de l'appli » : permissions, paramètres restreints d'Android, batterie, notifications, dernière synchronisation ; assistant de configuration au premier lancement, étapes selon la marque du téléphone.
CONTRÔLES (en local uniquement, aucune CI) : Tests locaux : même événement deux fois = une seule alerte ; hors connexion = notifications locales.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Pensé pour des utilisateurs non techniciens sur téléphones d'entrée de gamme : écrans simples, gros boutons, trois touches au plus vers un écran clé, application légère.
RÈGLES DE TRAVAIL OBLIGATOIRES :
  1. Travaille uniquement sur la branche main. Ne crée aucune branche parallèle.
  2. N'ouvre aucune pull request (PR).
  3. Ne lance, ne déclenche et n'attends aucune vérification CI (aucun workflow GitHub Actions). Les tests se font en local uniquement, et seulement ceux que ce prompt demande.
  4. Ne fais aucun déploiement : ni publication d'APK ou de release, ni migration appliquée à Supabase, ni fonction serveur déployée, ni mise en ligne d'une page. Prépare seulement les fichiers.
  5. Tout ce qui précède est interdit sans mon accord explicite, écrit dans cette conversation, pour chaque action concernée. Si une étape semble l'exiger (y compris un push qui déclencherait un workflow automatique), arrête-toi, explique pourquoi et demande-moi.
  6. Si tu n'as pas accès à mon dépôt, livre les fichiers complets avec leur chemin exact, prêts à copier ; ne suppose pas qu'ils existent déjà.
  7. N'invente pas : si une information manque, pose-moi la question (une seule à la fois) avant de continuer.
MODÈLE DU FICHIER DE PASSATION À PRODUIRE EN FIN DE RÉPONSE :
  FICHIER DE PASSATION — [application] — [numéro du prompt] — [date]
  1. Fait : ce qui est terminé, en une ligne chacun.
  2. Fichiers créés ou modifiés : chemins exacts.
  3. Tables, fonctions et écrans créés : noms exacts.
  4. Décisions techniques retenues et leur raison.
  5. Points ouverts et questions pour moi.
  6. Prochain prompt recommandé (numéro et titre).
  7. Actions qui demandent mon accord explicite (push, migration, déploiement…).
Termine par : « Étape terminée. J'attends ton accord avant de passer à la suivante. »


## PROMPT 0.7 — WhatsApp et briefings
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Famille de 7 applications Android (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel) qui partagent la même architecture, le même compte client et un seul backend Supabase. Ce prompt construit le SOCLE COMMUN réutilisé par toutes les applications. Cahiers des charges : Cahier_des_charges_01 à 07 (PDF), que je peux te coller par extraits.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire la génération de messages WhatsApp et le moteur de briefings du matin et du soir.
À FAIRE :
  1. Générateur de liens wa.me avec texte prérempli et encodage correct ; modèles de messages modifiables en français et en English, avec variables (nom, montant, date).
  2. Filtre de sécurité : tout message est contrôlé et refusé s'il contient un PIN ou un OTP ; écris les tests de ce filtre.
  3. Briefing du matin (7 h) et du soir : notification locale à l'heure choisie (WorkManager) avec bouton « Envoyer sur WhatsApp » ; moteur paramétrable pour que chaque application déclare ses sections (chiffres clés, alertes, tâches, échéances).
CONTRÔLES (en local uniquement, aucune CI) : Tests locaux : lien wa.me valide, filtre PIN/OTP, briefing planifié à l'heure choisie.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Pensé pour des utilisateurs non techniciens sur téléphones d'entrée de gamme : écrans simples, gros boutons, trois touches au plus vers un écran clé, application légère.
RÈGLES DE TRAVAIL OBLIGATOIRES :
  1. Travaille uniquement sur la branche main. Ne crée aucune branche parallèle.
  2. N'ouvre aucune pull request (PR).
  3. Ne lance, ne déclenche et n'attends aucune vérification CI (aucun workflow GitHub Actions). Les tests se font en local uniquement, et seulement ceux que ce prompt demande.
  4. Ne fais aucun déploiement : ni publication d'APK ou de release, ni migration appliquée à Supabase, ni fonction serveur déployée, ni mise en ligne d'une page. Prépare seulement les fichiers.
  5. Tout ce qui précède est interdit sans mon accord explicite, écrit dans cette conversation, pour chaque action concernée. Si une étape semble l'exiger (y compris un push qui déclencherait un workflow automatique), arrête-toi, explique pourquoi et demande-moi.
  6. Si tu n'as pas accès à mon dépôt, livre les fichiers complets avec leur chemin exact, prêts à copier ; ne suppose pas qu'ils existent déjà.
  7. N'invente pas : si une information manque, pose-moi la question (une seule à la fois) avant de continuer.
MODÈLE DU FICHIER DE PASSATION À PRODUIRE EN FIN DE RÉPONSE :
  FICHIER DE PASSATION — [application] — [numéro du prompt] — [date]
  1. Fait : ce qui est terminé, en une ligne chacun.
  2. Fichiers créés ou modifiés : chemins exacts.
  3. Tables, fonctions et écrans créés : noms exacts.
  4. Décisions techniques retenues et leur raison.
  5. Points ouverts et questions pour moi.
  6. Prochain prompt recommandé (numéro et titre).
  7. Actions qui demandent mon accord explicite (push, migration, déploiement…).
Termine par : « Étape terminée. J'attends ton accord avant de passer à la suivante. »


## PROMPT 0.8 — Abonnement, paiements et blocage
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Famille de 7 applications Android (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel) qui partagent la même architecture, le même compte client et un seul backend Supabase. Ce prompt construit le SOCLE COMMUN réutilisé par toutes les applications. Cahiers des charges : Cahier_des_charges_01 à 07 (PDF), que je peux te coller par extraits.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire le cycle d'abonnement commun aux 7 applications (un abonnement par application).
À FAIRE :
  1. Cycle : période accordée par l'administration (essai ou forfait), puis écran de paiement avec montant exact et référence unique ; le client paie par OM ou MoMo sur le code marchand, saisit l'identifiant de transaction (« J'ai payé ») ; accès provisoire de 24 h une seule fois par période.
  2. Forfaits : 3 mois = −10 % arrondi à la centaine inférieure ; 6 mois = 5 mois payés ; 12 mois = 10 mois payés ; aucun remboursement. Montée de palier : complément = différence de prix mensuel × jours restants ÷ 30, minimum 100 F, échéance inchangée ; descente à l'échéance.
  3. Offres : bienvenue (paiement dans les 48 h après la fin de la période, 1 mois offert), parrainage (1 mois pour chacun), codes promo ; plafond de 3 mois offerts par an ; mois offerts ajoutés à l'échéance.
  4. Blocage après échéance : dashboard bloqué, infos du compte et écran de paiement visibles, SMS toujours enregistrés sur le téléphone sans synchronisation ni notification, compteur « X opérations enregistrées pendant votre absence », arrêt de l'enregistrement après 60 jours, données jamais supprimées, export possible.
  5. Écris les fonctions de calcul (prorata, forfaits, plafonds) et leurs tests unitaires avec les exemples chiffrés : 15 jours restants, Essentiel 1 000 F vers Pro 3 000 F = 1 000 F.
CONTRÔLES (en local uniquement, aucune CI) : Tests unitaires verts en local ; exemples chiffrés exacts au franc.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Pensé pour des utilisateurs non techniciens sur téléphones d'entrée de gamme : écrans simples, gros boutons, trois touches au plus vers un écran clé, application légère.
RÈGLES DE TRAVAIL OBLIGATOIRES :
  1. Travaille uniquement sur la branche main. Ne crée aucune branche parallèle.
  2. N'ouvre aucune pull request (PR).
  3. Ne lance, ne déclenche et n'attends aucune vérification CI (aucun workflow GitHub Actions). Les tests se font en local uniquement, et seulement ceux que ce prompt demande.
  4. Ne fais aucun déploiement : ni publication d'APK ou de release, ni migration appliquée à Supabase, ni fonction serveur déployée, ni mise en ligne d'une page. Prépare seulement les fichiers.
  5. Tout ce qui précède est interdit sans mon accord explicite, écrit dans cette conversation, pour chaque action concernée. Si une étape semble l'exiger (y compris un push qui déclencherait un workflow automatique), arrête-toi, explique pourquoi et demande-moi.
  6. Si tu n'as pas accès à mon dépôt, livre les fichiers complets avec leur chemin exact, prêts à copier ; ne suppose pas qu'ils existent déjà.
  7. N'invente pas : si une information manque, pose-moi la question (une seule à la fois) avant de continuer.
MODÈLE DU FICHIER DE PASSATION À PRODUIRE EN FIN DE RÉPONSE :
  FICHIER DE PASSATION — [application] — [numéro du prompt] — [date]
  1. Fait : ce qui est terminé, en une ligne chacun.
  2. Fichiers créés ou modifiés : chemins exacts.
  3. Tables, fonctions et écrans créés : noms exacts.
  4. Décisions techniques retenues et leur raison.
  5. Points ouverts et questions pour moi.
  6. Prochain prompt recommandé (numéro et titre).
  7. Actions qui demandent mon accord explicite (push, migration, déploiement…).
Termine par : « Étape terminée. J'attends ton accord avant de passer à la suivante. »


## PROMPT 0.9 — Thème, charte graphique et langues
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Famille de 7 applications Android (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel) qui partagent la même architecture, le même compte client et un seul backend Supabase. Ce prompt construit le SOCLE COMMUN réutilisé par toutes les applications. Cahiers des charges : Cahier_des_charges_01 à 07 (PDF), que je peux te coller par extraits.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire le système de design commun avec un thème par application.
À FAIRE :
  1. Jetons de design et 7 thèmes aux couleurs exactes : Kiosko #0D2E57 / #89B255 ; Bootik #052163 / #FC7820 ; Zipple #0E224D / #F56202 ; NAXA Services #111111 / #DD3A33 (mode sombre par défaut) ; CotiZ #012952 / #018A44 / #D81224 / #FDCC1D ; Loyable #002C98 / #FD6213 ; NAXA Hotel #2058F4 / #FDA601.
  2. Couleurs de sens : succès #197A33, alerte #C62828, avertissement #8F5400, toujours avec icône (✓ ou !) et libellé ; versions foncées pour les liens et petits textes ; mode clair par défaut et mode sombre en option.
  3. Polices libres embarquées : Montserrat, Poppins, Nunito (OFL) pour fonctionner hors connexion ; composants communs : gros boutons, listes, formulaires, indicateurs de synchronisation.
  4. Première page : choix de la langue (Français ou English, présélection selon le téléphone) ; formatage des montants (45 000 F) et des dates ; changement de langue possible dans les options.
CONTRÔLES (en local uniquement, aucune CI) : Captures décrites ou générées pour deux thèmes ; contraste texte d'au moins 4,5 : 1 vérifié par calcul.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Pensé pour des utilisateurs non techniciens sur téléphones d'entrée de gamme : écrans simples, gros boutons, trois touches au plus vers un écran clé, application légère.
RÈGLES DE TRAVAIL OBLIGATOIRES :
  1. Travaille uniquement sur la branche main. Ne crée aucune branche parallèle.
  2. N'ouvre aucune pull request (PR).
  3. Ne lance, ne déclenche et n'attends aucune vérification CI (aucun workflow GitHub Actions). Les tests se font en local uniquement, et seulement ceux que ce prompt demande.
  4. Ne fais aucun déploiement : ni publication d'APK ou de release, ni migration appliquée à Supabase, ni fonction serveur déployée, ni mise en ligne d'une page. Prépare seulement les fichiers.
  5. Tout ce qui précède est interdit sans mon accord explicite, écrit dans cette conversation, pour chaque action concernée. Si une étape semble l'exiger (y compris un push qui déclencherait un workflow automatique), arrête-toi, explique pourquoi et demande-moi.
  6. Si tu n'as pas accès à mon dépôt, livre les fichiers complets avec leur chemin exact, prêts à copier ; ne suppose pas qu'ils existent déjà.
  7. N'invente pas : si une information manque, pose-moi la question (une seule à la fois) avant de continuer.
MODÈLE DU FICHIER DE PASSATION À PRODUIRE EN FIN DE RÉPONSE :
  FICHIER DE PASSATION — [application] — [numéro du prompt] — [date]
  1. Fait : ce qui est terminé, en une ligne chacun.
  2. Fichiers créés ou modifiés : chemins exacts.
  3. Tables, fonctions et écrans créés : noms exacts.
  4. Décisions techniques retenues et leur raison.
  5. Points ouverts et questions pour moi.
  6. Prochain prompt recommandé (numéro et titre).
  7. Actions qui demandent mon accord explicite (push, migration, déploiement…).
Termine par : « Étape terminée. J'attends ton accord avant de passer à la suivante. »


## PROMPT 0.10 — Espace admin web de base
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Famille de 7 applications Android (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel) qui partagent la même architecture, le même compte client et un seul backend Supabase. Ce prompt construit le SOCLE COMMUN réutilisé par toutes les applications. Cahiers des charges : Cahier_des_charges_01 à 07 (PDF), que je peux te coller par extraits.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire l'espace web responsive de l'administration (application web installable gratuite).
À FAIRE :
  1. Connexion par e-mail et mot de passe avec double vérification par application d'authentification gratuite.
  2. File des paiements (reconnus, non reconnus, ambigus) avec boutons Valider et Rejeter journalisés ; fiches clients (applications autorisées, palier, échéance, historique de paiements, position GPS du point) ; actions prolonger, offrir des mois, suspendre, réactiver ; création d'accès clients (appelle le parcours du prompt 0.4).
  3. Réglages : prix des 7 applications, durées, réductions, codes promo, tolérance hors connexion ; gestion des règles de lecture des SMS (parser_rules), des réseaux et des versions d'APK ; écran d'accueil à 6 chiffres (clients actifs, revenu du mois, essais en cours, échéances sous 7 jours, paiements à valider, départs du mois).
CONTRÔLES (en local uniquement, aucune CI) : Parcours testés en local avec données d'essai ; rien de mis en ligne sans mon accord.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Pensé pour des utilisateurs non techniciens sur téléphones d'entrée de gamme : écrans simples, gros boutons, trois touches au plus vers un écran clé, application légère.
RÈGLES DE TRAVAIL OBLIGATOIRES :
  1. Travaille uniquement sur la branche main. Ne crée aucune branche parallèle.
  2. N'ouvre aucune pull request (PR).
  3. Ne lance, ne déclenche et n'attends aucune vérification CI (aucun workflow GitHub Actions). Les tests se font en local uniquement, et seulement ceux que ce prompt demande.
  4. Ne fais aucun déploiement : ni publication d'APK ou de release, ni migration appliquée à Supabase, ni fonction serveur déployée, ni mise en ligne d'une page. Prépare seulement les fichiers.
  5. Tout ce qui précède est interdit sans mon accord explicite, écrit dans cette conversation, pour chaque action concernée. Si une étape semble l'exiger (y compris un push qui déclencherait un workflow automatique), arrête-toi, explique pourquoi et demande-moi.
  6. Si tu n'as pas accès à mon dépôt, livre les fichiers complets avec leur chemin exact, prêts à copier ; ne suppose pas qu'ils existent déjà.
  7. N'invente pas : si une information manque, pose-moi la question (une seule à la fois) avant de continuer.
MODÈLE DU FICHIER DE PASSATION À PRODUIRE EN FIN DE RÉPONSE :
  FICHIER DE PASSATION — [application] — [numéro du prompt] — [date]
  1. Fait : ce qui est terminé, en une ligne chacun.
  2. Fichiers créés ou modifiés : chemins exacts.
  3. Tables, fonctions et écrans créés : noms exacts.
  4. Décisions techniques retenues et leur raison.
  5. Points ouverts et questions pour moi.
  6. Prochain prompt recommandé (numéro et titre).
  7. Actions qui demandent mon accord explicite (push, migration, déploiement…).
Termine par : « Étape terminée. J'attends ton accord avant de passer à la suivante. »


## PROMPT 0.11 — Sécurité des APK et exports
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Famille de 7 applications Android (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel) qui partagent la même architecture, le même compte client et un seul backend Supabase. Ce prompt construit le SOCLE COMMUN réutilisé par toutes les applications. Cahiers des charges : Cahier_des_charges_01 à 07 (PDF), que je peux te coller par extraits.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Mettre en place la signature, la protection de l'APK et les exports marqués.
À FAIRE :
  1. Signature de l'APK : procédure de création de la clé (keystore), sauvegarde en plusieurs lieux sûrs, jamais dans un dépôt ; obfuscation R8 ; envoi de l'empreinte de signature à chaque synchronisation, refus côté serveur si elle est inconnue et alerte à l'administration.
  2. Version minimale exigée (table app_versions) : une version plus ancienne est bloquée à la connexion suivante avec renvoi vers la page de téléchargement officielle.
  3. Scripts de build LOCAUX documentés (aucun déploiement, aucune publication) ; génération de l'empreinte de chaque APK pour la page de téléchargement.
  4. Exports PDF et Excel avec pied de page : nom du point de vente et date d'export ; reçus et factures PDF partageables par WhatsApp.
CONTRÔLES (en local uniquement, aucune CI) : Tests locaux : APK modifié refusé par le serveur simulé ; version trop ancienne bloquée ; export marqué.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Pensé pour des utilisateurs non techniciens sur téléphones d'entrée de gamme : écrans simples, gros boutons, trois touches au plus vers un écran clé, application légère.
RÈGLES DE TRAVAIL OBLIGATOIRES :
  1. Travaille uniquement sur la branche main. Ne crée aucune branche parallèle.
  2. N'ouvre aucune pull request (PR).
  3. Ne lance, ne déclenche et n'attends aucune vérification CI (aucun workflow GitHub Actions). Les tests se font en local uniquement, et seulement ceux que ce prompt demande.
  4. Ne fais aucun déploiement : ni publication d'APK ou de release, ni migration appliquée à Supabase, ni fonction serveur déployée, ni mise en ligne d'une page. Prépare seulement les fichiers.
  5. Tout ce qui précède est interdit sans mon accord explicite, écrit dans cette conversation, pour chaque action concernée. Si une étape semble l'exiger (y compris un push qui déclencherait un workflow automatique), arrête-toi, explique pourquoi et demande-moi.
  6. Si tu n'as pas accès à mon dépôt, livre les fichiers complets avec leur chemin exact, prêts à copier ; ne suppose pas qu'ils existent déjà.
  7. N'invente pas : si une information manque, pose-moi la question (une seule à la fois) avant de continuer.
MODÈLE DU FICHIER DE PASSATION À PRODUIRE EN FIN DE RÉPONSE :
  FICHIER DE PASSATION — [application] — [numéro du prompt] — [date]
  1. Fait : ce qui est terminé, en une ligne chacun.
  2. Fichiers créés ou modifiés : chemins exacts.
  3. Tables, fonctions et écrans créés : noms exacts.
  4. Décisions techniques retenues et leur raison.
  5. Points ouverts et questions pour moi.
  6. Prochain prompt recommandé (numéro et titre).
  7. Actions qui demandent mon accord explicite (push, migration, déploiement…).
Termine par : « Étape terminée. J'attends ton accord avant de passer à la suivante. »


## PROMPT 0.12 — IA locale commune
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Famille de 7 applications Android (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel) qui partagent la même architecture, le même compte client et un seul backend Supabase. Ce prompt construit le SOCLE COMMUN réutilisé par toutes les applications. Cahiers des charges : Cahier_des_charges_01 à 07 (PDF), que je peux te coller par extraits.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire la bibliothèque d'IA locale réutilisable par les 7 applications.
À FAIRE :
  1. Moteur de règles et de statistiques : prévision de rupture ou d'épuisement (moyennes mobiles et saisonnalité simple), détection d'anomalies, score de santé à pondérations réglables, coach du jour (résumé court).
  2. Chaque suggestion indique pourquoi ; mode dégradé sans IA en ligne ; interface permettant à chaque application de brancher ses propres indicateurs.
  3. Assistant « posez une question sur mes chiffres » : questions prédéfinies hors connexion ; en ligne, appel d'une API d'IA gratuite avec données anonymisées (jamais de numéros ni de SMS bruts) ; saisie vocale Android en français et en anglais, résultat affiché pour confirmation avant tout enregistrement.
CONTRÔLES (en local uniquement, aucune CI) : Tests unitaires locaux sur jeux de données fictifs ; vérification qu'aucune donnée personnelle ne part vers l'API.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Pensé pour des utilisateurs non techniciens sur téléphones d'entrée de gamme : écrans simples, gros boutons, trois touches au plus vers un écran clé, application légère.
RÈGLES DE TRAVAIL OBLIGATOIRES :
  1. Travaille uniquement sur la branche main. Ne crée aucune branche parallèle.
  2. N'ouvre aucune pull request (PR).
  3. Ne lance, ne déclenche et n'attends aucune vérification CI (aucun workflow GitHub Actions). Les tests se font en local uniquement, et seulement ceux que ce prompt demande.
  4. Ne fais aucun déploiement : ni publication d'APK ou de release, ni migration appliquée à Supabase, ni fonction serveur déployée, ni mise en ligne d'une page. Prépare seulement les fichiers.
  5. Tout ce qui précède est interdit sans mon accord explicite, écrit dans cette conversation, pour chaque action concernée. Si une étape semble l'exiger (y compris un push qui déclencherait un workflow automatique), arrête-toi, explique pourquoi et demande-moi.
  6. Si tu n'as pas accès à mon dépôt, livre les fichiers complets avec leur chemin exact, prêts à copier ; ne suppose pas qu'ils existent déjà.
  7. N'invente pas : si une information manque, pose-moi la question (une seule à la fois) avant de continuer.
MODÈLE DU FICHIER DE PASSATION À PRODUIRE EN FIN DE RÉPONSE :
  FICHIER DE PASSATION — [application] — [numéro du prompt] — [date]
  1. Fait : ce qui est terminé, en une ligne chacun.
  2. Fichiers créés ou modifiés : chemins exacts.
  3. Tables, fonctions et écrans créés : noms exacts.
  4. Décisions techniques retenues et leur raison.
  5. Points ouverts et questions pour moi.
  6. Prochain prompt recommandé (numéro et titre).
  7. Actions qui demandent mon accord explicite (push, migration, déploiement…).
Termine par : « Étape terminée. J'attends ton accord avant de passer à la suivante. »


## PROMPT 0.13 — Page de téléchargement et mises à jour
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Famille de 7 applications Android (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel) qui partagent la même architecture, le même compte client et un seul backend Supabase. Ce prompt construit le SOCLE COMMUN réutilisé par toutes les applications. Cahiers des charges : Cahier_des_charges_01 à 07 (PDF), que je peux te coller par extraits.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Préparer la distribution par APK direct des 7 applications, sans rien publier.
À FAIRE :
  1. Page statique unique (hébergement gratuit) listant les 7 applications avec logo, version, empreinte de l'APK et guide d'installation illustré (sources inconnues, paramètres restreints, par marque de téléphone) ; script local qui génère la page.
  2. Vérification de version au démarrage de chaque application, lien de téléchargement, mise à jour obligatoire possible.
  3. Prépare tous les fichiers, mais n'en publie aucun : la publication demande mon accord explicite.
CONTRÔLES (en local uniquement, aucune CI) : Page générée en local, relue ; aucune mise en ligne.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Pensé pour des utilisateurs non techniciens sur téléphones d'entrée de gamme : écrans simples, gros boutons, trois touches au plus vers un écran clé, application légère.
RÈGLES DE TRAVAIL OBLIGATOIRES :
  1. Travaille uniquement sur la branche main. Ne crée aucune branche parallèle.
  2. N'ouvre aucune pull request (PR).
  3. Ne lance, ne déclenche et n'attends aucune vérification CI (aucun workflow GitHub Actions). Les tests se font en local uniquement, et seulement ceux que ce prompt demande.
  4. Ne fais aucun déploiement : ni publication d'APK ou de release, ni migration appliquée à Supabase, ni fonction serveur déployée, ni mise en ligne d'une page. Prépare seulement les fichiers.
  5. Tout ce qui précède est interdit sans mon accord explicite, écrit dans cette conversation, pour chaque action concernée. Si une étape semble l'exiger (y compris un push qui déclencherait un workflow automatique), arrête-toi, explique pourquoi et demande-moi.
  6. Si tu n'as pas accès à mon dépôt, livre les fichiers complets avec leur chemin exact, prêts à copier ; ne suppose pas qu'ils existent déjà.
  7. N'invente pas : si une information manque, pose-moi la question (une seule à la fois) avant de continuer.
MODÈLE DU FICHIER DE PASSATION À PRODUIRE EN FIN DE RÉPONSE :
  FICHIER DE PASSATION — [application] — [numéro du prompt] — [date]
  1. Fait : ce qui est terminé, en une ligne chacun.
  2. Fichiers créés ou modifiés : chemins exacts.
  3. Tables, fonctions et écrans créés : noms exacts.
  4. Décisions techniques retenues et leur raison.
  5. Points ouverts et questions pour moi.
  6. Prochain prompt recommandé (numéro et titre).
  7. Actions qui demandent mon accord explicite (push, migration, déploiement…).
Termine par : « Étape terminée. J'attends ton accord avant de passer à la suivante. »
