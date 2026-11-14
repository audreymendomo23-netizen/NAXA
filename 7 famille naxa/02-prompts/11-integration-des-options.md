> Version Markdown issue de la version texte source.
> Source : `Prompts_11_Integration_des_options.txt`. Le contenu des consignes est conservé ; seuls le titre et les séparateurs de prompts sont balisés en Markdown.

# Dossier de prompts — Intégration des options (après les nouveautés)
Prompts pour ChatGPT · version 1.0 · 31 octobre 2026 · travail sur main, sans branche, PR, CI ni déploiement sans accord explicite

## PROMPT 11.1 — Audit d'intégration sur le code réel
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Intégration de 6 options choisies avec moi : 4 trésorerie unifiée, 5 prévision de trésorerie à 30 jours, 6 copilote « pourquoi ? », 7 briefing audio, 17 addition partagée (Zipple), 18 écran cuisine (Zipple). À exécuter UNIQUEMENT après les séries 0 à 10 (dont la commande par QR de Zipple, qui est un prérequis de 17 et 18). Les applications existent déjà : AUDITE d'abord le code réel, réutilise les modules existants (lecture des SMS, stock, recettes, briefings, IA locale, notifications, thème) et n'en réécris aucun.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Auditer le code existant pour planifier précisément l'intégration des 8 options, sans rien coder.
À FAIRE :
  1. Pour chacune des 6 options (4, 5, 6, 7, 17, 18), liste : les modules existants à réutiliser, les tables et écrans à ajouter, les points d'extension, les conflits possibles, l'effort estimé et les tests à prévoir.
  2. Vérifie en particulier : (a) le double comptage possible quand deux applications du même téléphone lisent les mêmes SMS ; (b) l'espace de stockage de l'offre gratuite de Supabase face aux historiques ; (c) la dépendance de 17 et 18 aux commandes par QR de Zipple (série 10) ; (d) les jeux de SMS bancaires manquants pour 4 ; (e) la disponibilité des voix de synthèse hors connexion pour 7.
  3. Propose l'ordre d'intégration (par défaut : 4, 5, 6, 7, puis 18, 17) et signale ce que je dois te fournir (corpus de SMS bancaires).
  4. Rends un rapport d'audit et un plan. Arrête-toi et attends mon accord explicite avant de coder quoi que ce soit.
CONTRÔLES (en local uniquement, aucune CI) : Rapport d'audit complet ; aucun code modifié.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Réutiliser avant de créer : chaque option s'appuie sur des modules existants ; justifie toute nouvelle table ou nouveau module par ce qui manque réellement.
  - Plusieurs applications de la famille peuvent être installées sur le même téléphone : un seul lecteur de SMS par téléphone et par point (« lecteur principal » choisi par le gérant), et le dédoublonnage par point et identifiant de transaction doit empêcher tout double comptage.
  - Respecter le design final de chaque application (série 8) et ses mouvements ; respecter les limites de l'offre gratuite de Supabase (historiques : limiter et archiver).
  - Aucune promesse chiffrée trompeuse : toute prévision affiche une fourchette et son niveau de confiance ; toute explication affiche les chiffres qui la fondent ; l'IA propose, l'humain décide.
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


## PROMPT 11.2 — Trésorerie unifiée (option 4)
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Intégration de 6 options choisies avec moi : 4 trésorerie unifiée, 5 prévision de trésorerie à 30 jours, 6 copilote « pourquoi ? », 7 briefing audio, 17 addition partagée (Zipple), 18 écran cuisine (Zipple). À exécuter UNIQUEMENT après les séries 0 à 10 (dont la commande par QR de Zipple, qui est un prérequis de 17 et 18). Les applications existent déjà : AUDITE d'abord le code réel, réutilise les modules existants (lecture des SMS, stock, recettes, briefings, IA locale, notifications, thème) et n'en réécris aucun.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Afficher en un écran le solde réel de tous les comptes d'un commerçant : mobile money, banque, caisse.
À FAIRE :
  1. Modèle : comptes de trésorerie par point (mobile money par réseau, compte bancaire, caisse en espèces, autre) ; pour chaque compte, dernier solde connu avec son heure et sa source (SMS automatique, partagé, saisie manuelle) ; historique des soldes pour les courbes. Réutilise les soldes déjà lus par Kiosko et par le moteur de lecture des SMS.
  2. Affichage : total consolidé, détail par compte avec « il y a X h », courbe sur 30 jours, alerte si un compte n'a pas été mis à jour depuis longtemps, mise à jour manuelle en une touche ; compte mère : consolidation par point et pour tout le groupe, selon les droits.
  3. SMS bancaires : demande-moi un corpus de SMS réels de ma banque avant d'écrire les règles ; les règles sont des données versionnées (parser_rules) ; OTP et PIN toujours ignorés ; un SMS partagé reste « à vérifier ».
  4. Un seul lecteur de SMS par téléphone et par point, dédoublonnage par point et identifiant de transaction ; fonctionne hors connexion avec synchronisation sans doublon.
  5. Disponible dans Kiosko, Bootik, Zipple, NAXA Services, Loyable et NAXA Hotel ; accès réservé aux postes autorisés (propriétaire, manager, comptable).
CONTRÔLES (en local uniquement, aucune CI) : Tests : le total correspond à la somme des derniers soldes ; deux applications sur le même téléphone ne comptent pas deux fois le même SMS ; compte mère exact.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Réutiliser avant de créer : chaque option s'appuie sur des modules existants ; justifie toute nouvelle table ou nouveau module par ce qui manque réellement.
  - Plusieurs applications de la famille peuvent être installées sur le même téléphone : un seul lecteur de SMS par téléphone et par point (« lecteur principal » choisi par le gérant), et le dédoublonnage par point et identifiant de transaction doit empêcher tout double comptage.
  - Respecter le design final de chaque application (série 8) et ses mouvements ; respecter les limites de l'offre gratuite de Supabase (historiques : limiter et archiver).
  - Aucune promesse chiffrée trompeuse : toute prévision affiche une fourchette et son niveau de confiance ; toute explication affiche les chiffres qui la fondent ; l'IA propose, l'humain décide.
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


## PROMPT 11.3 — Prévision de trésorerie à 30 jours (option 5)
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Intégration de 6 options choisies avec moi : 4 trésorerie unifiée, 5 prévision de trésorerie à 30 jours, 6 copilote « pourquoi ? », 7 briefing audio, 17 addition partagée (Zipple), 18 écran cuisine (Zipple). À exécuter UNIQUEMENT après les séries 0 à 10 (dont la commande par QR de Zipple, qui est un prérequis de 17 et 18). Les applications existent déjà : AUDITE d'abord le code réel, réutilise les modules existants (lecture des SMS, stock, recettes, briefings, IA locale, notifications, thème) et n'en réécris aucun.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Prévoir le solde des 30 prochains jours et alerter avant un manque.
À FAIRE :
  1. Entrées : solde unifié (option 4), échéances connues (loyers à payer, fournisseurs, salaires, charges récurrentes, tontine, remboursements), ventes attendues estimées à partir de l'historique avec effet du jour de la semaine et des fêtes.
  2. Résultat : courbe prévue avec une fourchette (scénario prudent, probable, favorable), date et montant du premier manque éventuel, et le « ce qu'il faut encaisser ou reporter pour tenir » ; seuil d'alerte réglable ; mode « et si » (retarder un paiement, avancer un encaissement).
  3. Calcul entièrement local, fonction pure testable, avec explication de chaque hypothèse ; si l'historique est trop court (moins de 4 semaines), l'application le dit et réduit la confiance affichée ; aucune promesse de précision.
  4. Réutilise la bibliothèque d'IA locale commune ; notifications d'alerte avec clé anti-doublon ; briefing du matin enrichi d'une ligne de prévision.
CONTRÔLES (en local uniquement, aucune CI) : Tests sur données fictives : fourchette cohérente, alerte déclenchée une seule fois, comportement avec historique court.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Réutiliser avant de créer : chaque option s'appuie sur des modules existants ; justifie toute nouvelle table ou nouveau module par ce qui manque réellement.
  - Plusieurs applications de la famille peuvent être installées sur le même téléphone : un seul lecteur de SMS par téléphone et par point (« lecteur principal » choisi par le gérant), et le dédoublonnage par point et identifiant de transaction doit empêcher tout double comptage.
  - Respecter le design final de chaque application (série 8) et ses mouvements ; respecter les limites de l'offre gratuite de Supabase (historiques : limiter et archiver).
  - Aucune promesse chiffrée trompeuse : toute prévision affiche une fourchette et son niveau de confiance ; toute explication affiche les chiffres qui la fondent ; l'IA propose, l'humain décide.
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


## PROMPT 11.4 — Copilote « pourquoi ? » (option 6)
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Intégration de 6 options choisies avec moi : 4 trésorerie unifiée, 5 prévision de trésorerie à 30 jours, 6 copilote « pourquoi ? », 7 briefing audio, 17 addition partagée (Zipple), 18 écran cuisine (Zipple). À exécuter UNIQUEMENT après les séries 0 à 10 (dont la commande par QR de Zipple, qui est un prérequis de 17 et 18). Les applications existent déjà : AUDITE d'abord le code réel, réutilise les modules existants (lecture des SMS, stock, recettes, briefings, IA locale, notifications, thème) et n'en réécris aucun.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Expliquer en une phrase pourquoi les ventes, la marge ou la caisse ont varié.
À FAIRE :
  1. Définis une interface commune de mesures (chiffre d'affaires, volume, marge, caisse) et des dimensions d'analyse (produit, catégorie, heure, jour, employé, client, canal) ; un adaptateur par application pour la brancher à ses données.
  2. Calcul : compare deux périodes et décompose l'écart en effets de volume, de prix et de composition ; classe les causes par ampleur ; garde les 2 ou 3 plus fortes.
  3. Sortie : une phrase claire en français ou en English construite à partir de modèles et de chiffres calculés (« ventes −18 % : 3 jours sans bière pression, et −40 % le jeudi »), avec un lien « voir le détail ». Aucune affirmation qui ne soit pas appuyée par un chiffre calculé.
  4. Option en ligne : reformulation par une IA gratuite à partir de chiffres anonymisés (jamais de noms, de numéros ni de SMS) ; sans connexion, les phrases de modèle suffisent.
CONTRÔLES (en local uniquement, aucune CI) : Tests : décomposition exacte sur cas d'école ; la phrase ne cite que des faits calculés ; mode hors connexion.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Réutiliser avant de créer : chaque option s'appuie sur des modules existants ; justifie toute nouvelle table ou nouveau module par ce qui manque réellement.
  - Plusieurs applications de la famille peuvent être installées sur le même téléphone : un seul lecteur de SMS par téléphone et par point (« lecteur principal » choisi par le gérant), et le dédoublonnage par point et identifiant de transaction doit empêcher tout double comptage.
  - Respecter le design final de chaque application (série 8) et ses mouvements ; respecter les limites de l'offre gratuite de Supabase (historiques : limiter et archiver).
  - Aucune promesse chiffrée trompeuse : toute prévision affiche une fourchette et son niveau de confiance ; toute explication affiche les chiffres qui la fondent ; l'IA propose, l'humain décide.
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


## PROMPT 11.5 — Briefing audio (option 7)
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Intégration de 6 options choisies avec moi : 4 trésorerie unifiée, 5 prévision de trésorerie à 30 jours, 6 copilote « pourquoi ? », 7 briefing audio, 17 addition partagée (Zipple), 18 écran cuisine (Zipple). À exécuter UNIQUEMENT après les séries 0 à 10 (dont la commande par QR de Zipple, qui est un prérequis de 17 et 18). Les applications existent déjà : AUDITE d'abord le code réel, réutilise les modules existants (lecture des SMS, stock, recettes, briefings, IA locale, notifications, thème) et n'en réécris aucun.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Faire lire le briefing du jour à voix haute et le partager en message vocal.
À FAIRE :
  1. Génère un script court (45 secondes au plus) à partir du moteur de briefings existant ; lecture par la synthèse vocale d'Android ; détecte l'absence de voix française ou English hors connexion et guide l'installation de la voix.
  2. Partage : enregistre la voix dans un fichier audio (synthèse vers fichier) et propose de l'envoyer par WhatsApp en un clic ; réglage de la vitesse et de la voix ; lecture automatique possible à l'ouverture le matin si le gérant l'active.
  3. Langues locales : ne les promets pas ; prépare seulement le point d'entrée pour des clips enregistrés par des locuteurs natifs (lié à l'étude de CotiZ).
CONTRÔLES (en local uniquement, aucune CI) : Tests : script court et exact ; fichier audio produit hors connexion avec une voix installée.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Réutiliser avant de créer : chaque option s'appuie sur des modules existants ; justifie toute nouvelle table ou nouveau module par ce qui manque réellement.
  - Plusieurs applications de la famille peuvent être installées sur le même téléphone : un seul lecteur de SMS par téléphone et par point (« lecteur principal » choisi par le gérant), et le dédoublonnage par point et identifiant de transaction doit empêcher tout double comptage.
  - Respecter le design final de chaque application (série 8) et ses mouvements ; respecter les limites de l'offre gratuite de Supabase (historiques : limiter et archiver).
  - Aucune promesse chiffrée trompeuse : toute prévision affiche une fourchette et son niveau de confiance ; toute explication affiche les chiffres qui la fondent ; l'IA propose, l'humain décide.
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


## PROMPT 11.6 — Zipple : écran cuisine (option 18)
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Intégration de 6 options choisies avec moi : 4 trésorerie unifiée, 5 prévision de trésorerie à 30 jours, 6 copilote « pourquoi ? », 7 briefing audio, 17 addition partagée (Zipple), 18 écran cuisine (Zipple). À exécuter UNIQUEMENT après les séries 0 à 10 (dont la commande par QR de Zipple, qui est un prérequis de 17 et 18). Les applications existent déjà : AUDITE d'abord le code réel, réutilise les modules existants (lecture des SMS, stock, recettes, briefings, IA locale, notifications, thème) et n'en réécris aucun.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Afficher les commandes validées en cuisine sur une tablette bon marché.
À FAIRE :
  1. Mode « cuisine » dans l'application Zipple (rôle cuisine) : commandes validées en file, triées par urgence et compte à rebours, texte très lisible à distance, son à l'arrivée, écran qui reste allumé ; un toucher passe « en préparation » puis « prête ».
  2. Reprends les statuts et les échéances des commandes par QR (prompts 10.1 à 10.4) ; commandes en retard en rouge avec icône ; modification d'une commande visible en cuisine ; plats épuisés signalés.
  3. Coupure réseau : bandeau clair et secours par ticket imprimé en Bluetooth ; reconnexion automatique ; aucune commande perdue ni doublée.
  4. Statistiques de temps de préparation par plat et par heure, alimentant le compte à rebours et le copilote « pourquoi ? ».
CONTRÔLES (en local uniquement, aucune CI) : Tests : une commande validée apparaît en cuisine en quelques secondes ; passage « prête » alerte la serveuse ; coupure puis retour du réseau sans doublon.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Réutiliser avant de créer : chaque option s'appuie sur des modules existants ; justifie toute nouvelle table ou nouveau module par ce qui manque réellement.
  - Plusieurs applications de la famille peuvent être installées sur le même téléphone : un seul lecteur de SMS par téléphone et par point (« lecteur principal » choisi par le gérant), et le dédoublonnage par point et identifiant de transaction doit empêcher tout double comptage.
  - Respecter le design final de chaque application (série 8) et ses mouvements ; respecter les limites de l'offre gratuite de Supabase (historiques : limiter et archiver).
  - Aucune promesse chiffrée trompeuse : toute prévision affiche une fourchette et son niveau de confiance ; toute explication affiche les chiffres qui la fondent ; l'IA propose, l'humain décide.
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


## PROMPT 11.7 — Zipple : addition partagée par QR (option 17)
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Intégration de 6 options choisies avec moi : 4 trésorerie unifiée, 5 prévision de trésorerie à 30 jours, 6 copilote « pourquoi ? », 7 briefing audio, 17 addition partagée (Zipple), 18 écran cuisine (Zipple). À exécuter UNIQUEMENT après les séries 0 à 10 (dont la commande par QR de Zipple, qui est un prérequis de 17 et 18). Les applications existent déjà : AUDITE d'abord le code réel, réutilise les modules existants (lecture des SMS, stock, recettes, briefings, IA locale, notifications, thème) et n'en réécris aucun.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Permettre aux convives de se partager l'addition et de payer chacun leur part.
À FAIRE :
  1. Le QR de l'addition ouvre la liste des plats ; chaque convive choisit ses lignes, une part égale ou un montant libre ; chaque part a sa référence et son montant, recalculés côté serveur ; règle d'arrondi explicite (le reste va à la dernière part).
  2. Chaque part est payée en mobile money (rapprochée par SMS comme la commande, prompt 10.2) ou en espèces à la serveuse ; la page affiche « 3 parts sur 4 payées » en direct ; la table se solde quand toutes les parts sont payées ; une part impayée reste visible pour la serveuse, qui décide.
  3. Reçu par part (prompt 10.2) et reçu global ; protection contre le paiement d'une même part par deux personnes et contre les parts qui ne totalisent pas l'addition ; annulation et réaffectation par la serveuse avec journal.
CONTRÔLES (en local uniquement, aucune CI) : Tests : parts qui totalisent exactement l'addition ; paiement d'une part reconnu sans doublon ; abandon d'un convive géré par la serveuse.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Réutiliser avant de créer : chaque option s'appuie sur des modules existants ; justifie toute nouvelle table ou nouveau module par ce qui manque réellement.
  - Plusieurs applications de la famille peuvent être installées sur le même téléphone : un seul lecteur de SMS par téléphone et par point (« lecteur principal » choisi par le gérant), et le dédoublonnage par point et identifiant de transaction doit empêcher tout double comptage.
  - Respecter le design final de chaque application (série 8) et ses mouvements ; respecter les limites de l'offre gratuite de Supabase (historiques : limiter et archiver).
  - Aucune promesse chiffrée trompeuse : toute prévision affiche une fourchette et son niveau de confiance ; toute explication affiche les chiffres qui la fondent ; l'IA propose, l'humain décide.
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


## PROMPT 11.8 — Recette de l'intégration
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Intégration de 6 options choisies avec moi : 4 trésorerie unifiée, 5 prévision de trésorerie à 30 jours, 6 copilote « pourquoi ? », 7 briefing audio, 17 addition partagée (Zipple), 18 écran cuisine (Zipple). À exécuter UNIQUEMENT après les séries 0 à 10 (dont la commande par QR de Zipple, qui est un prérequis de 17 et 18). Les applications existent déjà : AUDITE d'abord le code réel, réutilise les modules existants (lecture des SMS, stock, recettes, briefings, IA locale, notifications, thème) et n'en réécris aucun.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Contrôler l'ensemble des 6 options.
À FAIRE :
  1. Pour chaque option : parcours complet, cas d'erreur, hors connexion, performance sur téléphone d'entrée de gamme ; vérification que les modules existants n'ont pas régressé (tests des séries précédentes).
  2. Contrôles transverses : double comptage de SMS entre applications sur un même téléphone, espace Supabase consommé, confidentialité des numéros, cohérence visuelle avec la série 8.
  3. Établis un rapport avec les écarts, leur priorité et les points qui demandent mon accord. Ne publie rien.
CONTRÔLES (en local uniquement, aucune CI) : Rapport complet avec mesures ; aucun test existant ne régresse.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Android uniquement. Hors connexion d'abord : tout fonctionne sur la base locale, la synchronisation se fait au retour du réseau.
  - Uniquement des solutions gratuites (Supabase offre gratuite partagée, Firebase Cloud Messaging, bibliothèques libres, GitHub). Aucune dépense sans mon accord.
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké, transmis ni affiché ; un SMS qui en contient est ignoré. Aucun message WhatsApp ne contient de PIN ou d'OTP.
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule ; chaque suggestion explique pourquoi ; aucun numéro ni SMS brut envoyé à un service externe.
  - Aucun texte en dur dans le code : tout est dans des fichiers de langue français et English. Montants en francs CFA, formatés (45 000 F), calculs exacts au franc près.
  - Les accès clients sont créés uniquement par l'administration ; pas d'inscription libre dans l'application. Un seul backend Supabase partagé par les 7 applications, avec règles RLS strictes.
  - L'application suit la charte graphique de son logo (couleurs, police, thème) ; états toujours doublés d'une icône et d'un libellé ; contraste texte d'au moins 4,5 : 1.
  - Réutiliser avant de créer : chaque option s'appuie sur des modules existants ; justifie toute nouvelle table ou nouveau module par ce qui manque réellement.
  - Plusieurs applications de la famille peuvent être installées sur le même téléphone : un seul lecteur de SMS par téléphone et par point (« lecteur principal » choisi par le gérant), et le dédoublonnage par point et identifiant de transaction doit empêcher tout double comptage.
  - Respecter le design final de chaque application (série 8) et ses mouvements ; respecter les limites de l'offre gratuite de Supabase (historiques : limiter et archiver).
  - Aucune promesse chiffrée trompeuse : toute prévision affiche une fourchette et son niveau de confiance ; toute explication affiche les chiffres qui la fondent ; l'IA propose, l'humain décide.
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
