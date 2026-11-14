> Version Markdown issue de la version texte source.
> Source : `Prompts_01_Kiosko.txt`. Le contenu des consignes est conservé ; seuls le titre et les séparateurs de prompts sont balisés en Markdown.

# Dossier de prompts — Kiosko
Prompts pour ChatGPT · version 1.0 · 31 octobre 2026 · travail sur main, sans branche, PR, CI ni déploiement sans accord explicite

## PROMPT 1.1 — Lecture des SMS et parseur
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « Kiosko » (Fintech & Mobile Services) : gestion des points de vente de mobile money (Orange Money, MTN MoMo, Wave selon corpus). Elle lit les SMS de transaction (permission SMS obligatoire), met à jour caisse, floats et commissions, alerte le livreur par WhatsApp, avec IA locale, hors connexion. Elle porte aussi le MODE ADMIN : le téléphone de l'administration détecte les paiements d'abonnement des 7 applications. Charte : bleu nuit #0D2E57, vert #89B255. Cahier : Cahier_des_charges_01_Kiosko.pdf (texte intégral v1.2 en annexe B).
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire la lecture automatique des SMS de transaction.
À FAIRE :
  1. Récepteur de SMS, permission SMS et assistant d'autorisation (paramètres restreints d'Android), identification du réseau par l'expéditeur officiel (MoMo = MTN, OrangeMoney = Orange, Wave = Wave ; noms exacts à confirmer sur de vrais téléphones), aucune gestion spéciale de la double SIM.
  2. Chaîne : filtre sur l'expéditeur officiel ; SMS contenant un OTP ou un PIN ignorés (jamais lus, stockés, transmis ni affichés) ; analyse par règles versionnées par réseau et par type ; extraction : nature, montant, frais, solde après opération, identifiant de transaction, date et heure, contrepartie masquée.
  3. Texte brut chiffré sur le téléphone ; seuls les champs extraits sont synchronisés. Je te fournirai un corpus de SMS réels masqués : écris le parseur et les tests sur ce corpus, et demande-moi le corpus avant de coder les règles.
CONTRÔLES (en local uniquement, aucune CI) : Tests locaux du parseur sur le corpus ; un SMS avec OTP n'est ni stocké ni affiché.
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


## PROMPT 1.2 — Cohérence des soldes, doublons et file « À classer »
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « Kiosko » (Fintech & Mobile Services) : gestion des points de vente de mobile money (Orange Money, MTN MoMo, Wave selon corpus). Elle lit les SMS de transaction (permission SMS obligatoire), met à jour caisse, floats et commissions, alerte le livreur par WhatsApp, avec IA locale, hors connexion. Elle porte aussi le MODE ADMIN : le téléphone de l'administration détecte les paiements d'abonnement des 7 applications. Charte : bleu nuit #0D2E57, vert #89B255. Cahier : Cahier_des_charges_01_Kiosko.pdf (texte intégral v1.2 en annexe B).
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Fiabiliser le traitement des SMS.
À FAIRE :
  1. Contrôle de cohérence : ancien solde ± montant = nouveau solde, sinon opération marquée « à vérifier » ; dédoublonnage par identifiant de transaction.
  2. File « À classer » pour les SMS non reconnus : le gérant classe, une suggestion locale propose un classement ; règles mises à jour sans nouvelle APK (table parser_rules téléchargée à la synchronisation).
  3. Statistiques par format de SMS non reconnu remontées à l'administration pour corriger les règles.
CONTRÔLES (en local uniquement, aucune CI) : Tests : même SMS deux fois = une opération ; SMS reçus dans le désordre remis dans l'ordre.
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


## PROMPT 1.3 — Natures d'opérations, floats et espèces
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « Kiosko » (Fintech & Mobile Services) : gestion des points de vente de mobile money (Orange Money, MTN MoMo, Wave selon corpus). Elle lit les SMS de transaction (permission SMS obligatoire), met à jour caisse, floats et commissions, alerte le livreur par WhatsApp, avec IA locale, hors connexion. Elle porte aussi le MODE ADMIN : le téléphone de l'administration détecte les paiements d'abonnement des 7 applications. Charte : bleu nuit #0D2E57, vert #89B255. Cahier : Cahier_des_charges_01_Kiosko.pdf (texte intégral v1.2 en annexe B).
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire le moteur de soldes.
À FAIRE :
  1. Natures et effets : dépôt (float −, espèces +) ; retrait (float +, espèces −) ; approvisionnement en float (float +, espèces −) ; déstockage (float −, espèces +) ; C2C (float ± selon le sens) ; crédit et Good Deal : approvisionnement (float −, stock de crédit +) et vente (espèces +, stock de crédit −, marge = commission). Définitions de déstockage et de C2C à me faire confirmer.
  2. Wallets par réseau et par service ; deux numéros du même réseau alimentent le même float ; chaque ligne porte sa source (SMS automatique, partagé, import, manuel).
  3. Cartes SIM (stock, vente, bénéfice), identification et reconduction (prestation et montant, aucune pièce d'identité conservée), service OTP (prestation et montant seulement, jamais le code), autres ventes libres.
CONTRÔLES (en local uniquement, aucune CI) : Tests unitaires : chaque nature met à jour les bons soldes au franc près.
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


## PROMPT 1.4 — Solutions de secours de lecture
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « Kiosko » (Fintech & Mobile Services) : gestion des points de vente de mobile money (Orange Money, MTN MoMo, Wave selon corpus). Elle lit les SMS de transaction (permission SMS obligatoire), met à jour caisse, floats et commissions, alerte le livreur par WhatsApp, avec IA locale, hors connexion. Elle porte aussi le MODE ADMIN : le téléphone de l'administration détecte les paiements d'abonnement des 7 applications. Charte : bleu nuit #0D2E57, vert #89B255. Cahier : Cahier_des_charges_01_Kiosko.pdf (texte intégral v1.2 en annexe B).
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Ne jamais perdre une opération même si la lecture automatique échoue.
À FAIRE :
  1. Partage d'un SMS vers l'application (menu Partager, deux touches) et bouton « Coller un SMS » (plusieurs SMS d'un coup séparés puis analysés un par un), sans permission SMS ; ligne marquée « partagé » ; un SMS partagé n'active jamais un abonnement.
  2. Notification « SMS partagé à vérifier » si le contrôle de cohérence échoue ou si le réseau est inconnu ; la ligne reste « à vérifier » jusqu'à confirmation, correction ou annulation.
  3. Saisie manuelle guidée par nature d'opération avec effet affiché avant validation (par exemple float MoMo − 20 000 F, espèces + 20 000 F), montants fréquents en gros boutons, rapprochement automatique avec le SMS réel arrivé ensuite.
  4. Alerte de trou dans la chaîne des soldes : solde attendu comparé au solde du SMS, par réseau ; messages non reconnus pris en compte, SMS remis dans l'ordre, délai de quelques minutes, une alerte par trou ; actions : importer, partager, saisir, marquer comme écart justifié avec raison.
CONTRÔLES (en local uniquement, aucune CI) : Tests : saisie manuelle fusionnée avec le SMS réel sans doublon ; fausse alerte évitée pour SMS en désordre.
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


## PROMPT 1.5 — Téléphone de dépannage et import
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « Kiosko » (Fintech & Mobile Services) : gestion des points de vente de mobile money (Orange Money, MTN MoMo, Wave selon corpus). Elle lit les SMS de transaction (permission SMS obligatoire), met à jour caisse, floats et commissions, alerte le livreur par WhatsApp, avec IA locale, hors connexion. Elle porte aussi le MODE ADMIN : le téléphone de l'administration détecte les paiements d'abonnement des 7 applications. Charte : bleu nuit #0D2E57, vert #89B255. Cahier : Cahier_des_charges_01_Kiosko.pdf (texte intégral v1.2 en annexe B).
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Gérer la puce déplacée sur un autre téléphone.
À FAIRE :
  1. Connexion sur le téléphone de dépannage avec notification du propriétaire ; à l'activation, import des SMS de transaction de la boîte de réception depuis la dernière synchronisation, sans doublon ; bouton « Importer les SMS manquants » aussi après réinstallation.
  2. Jusqu'à 2 appareils actifs par point, fermeture du plus ancien ; au retour de la puce, le premier téléphone récupère tout par synchronisation.
CONTRÔLES (en local uniquement, aucune CI) : Test local : import sans doublon après réinstallation.
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


## PROMPT 1.6 — Tableau de bord, caisse et float
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « Kiosko » (Fintech & Mobile Services) : gestion des points de vente de mobile money (Orange Money, MTN MoMo, Wave selon corpus). Elle lit les SMS de transaction (permission SMS obligatoire), met à jour caisse, floats et commissions, alerte le livreur par WhatsApp, avec IA locale, hors connexion. Elle porte aussi le MODE ADMIN : le téléphone de l'administration détecte les paiements d'abonnement des 7 applications. Charte : bleu nuit #0D2E57, vert #89B255. Cahier : Cahier_des_charges_01_Kiosko.pdf (texte intégral v1.2 en annexe B).
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire l'écran principal du gérant.
À FAIRE :
  1. Tableau de bord : soldes par réseau et en espèces, ventes et commissions du jour, alertes, état de synchronisation, trous non résolus.
  2. Ouverture de journée (fond de caisse et floats), clôture avec écart signalé, solde attendu contre réel ; commandes de float (demandée, en route, reçue) ; seuil minimum par réseau et montant à demander réglables.
  3. Alertes livreur et chef secteur : contacts enregistrés ; au seuil, calcul du montant et message WhatsApp prérempli (modèles de l'annexe B de la v1.2, jamais de PIN) ; une seule notification par franchissement de seuil.
CONTRÔLES (en local uniquement, aucune CI) : Test : franchissement du seuil = une notification et un message prérempli.
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


## PROMPT 1.7 — Transactions, commissions, crédits et exports
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « Kiosko » (Fintech & Mobile Services) : gestion des points de vente de mobile money (Orange Money, MTN MoMo, Wave selon corpus). Elle lit les SMS de transaction (permission SMS obligatoire), met à jour caisse, floats et commissions, alerte le livreur par WhatsApp, avec IA locale, hors connexion. Elle porte aussi le MODE ADMIN : le téléphone de l'administration détecte les paiements d'abonnement des 7 applications. Charte : bleu nuit #0D2E57, vert #89B255. Cahier : Cahier_des_charges_01_Kiosko.pdf (texte intégral v1.2 en annexe B).
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Compléter le quotidien du gérant.
À FAIRE :
  1. Listing filtrable et recherche, bouton « + Vente » pour les opérations sans SMS, correction ou annulation avec raison obligatoire et journal, détection des doublons.
  2. Commissions par opération, service, jour, semaine, mois ; charges (transport, forfait, loyer, salaires) puis bénéfice net ; carnet de clients et de crédits avec rappel WhatsApp ; services Camtel, Canal+ et bouton « Autre service » (solde et commission propres).
  3. Bilans jour, semaine, mois ; export des données (PDF simple et Excel) pour tous les paliers ; rapports mis en forme à partir du palier Services.
CONTRÔLES (en local uniquement, aucune CI) : Tests locaux sur données fictives ; exports marqués du nom du point et de la date.
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


## PROMPT 1.8 — Tests sur 4 ou 5 téléphones courants
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « Kiosko » (Fintech & Mobile Services) : gestion des points de vente de mobile money (Orange Money, MTN MoMo, Wave selon corpus). Elle lit les SMS de transaction (permission SMS obligatoire), met à jour caisse, floats et commissions, alerte le livreur par WhatsApp, avec IA locale, hors connexion. Elle porte aussi le MODE ADMIN : le téléphone de l'administration détecte les paiements d'abonnement des 7 applications. Charte : bleu nuit #0D2E57, vert #89B255. Cahier : Cahier_des_charges_01_Kiosko.pdf (texte intégral v1.2 en annexe B).
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Préparer le protocole de compatibilité.
À FAIRE :
  1. Écris le protocole des 10 scénarios (installation et paramètres restreints, SMS écran éteint pendant une heure, application balayée de la mémoire, économie de batterie, redémarrage, double SIM, perte de réseau, rafale de 50 SMS, mise à jour par-dessus, test continu de 72 heures).
  2. Objectifs : 0 SMS perdu sur 200 messages de test ; opération visible quelques secondes après le SMS ; consommation de batterie faible (cible à fixer, par exemple moins de 5 % par jour).
  3. Livrables : modèle de fiche de compatibilité par modèle (fonctionne, fonctionne avec réglages, ne fonctionne pas), guide de réglages par marque réutilisable dans l'assistant de configuration, outil de mesure dans l'application (journal de réception des SMS).
CONTRÔLES (en local uniquement, aucune CI) : Protocole et journal prêts ; les tests physiques sont faits par moi sur mes téléphones.
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


## PROMPT 1.9 — Mode admin : détection des paiements d'abonnement
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « Kiosko » (Fintech & Mobile Services) : gestion des points de vente de mobile money (Orange Money, MTN MoMo, Wave selon corpus). Elle lit les SMS de transaction (permission SMS obligatoire), met à jour caisse, floats et commissions, alerte le livreur par WhatsApp, avec IA locale, hors connexion. Elle porte aussi le MODE ADMIN : le téléphone de l'administration détecte les paiements d'abonnement des 7 applications. Charte : bleu nuit #0D2E57, vert #89B255. Cahier : Cahier_des_charges_01_Kiosko.pdf (texte intégral v1.2 en annexe B).
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire le mode admin qui active les abonnements des 7 applications.
À FAIRE :
  1. Le téléphone admin lit le SMS de paiement et vérifie expéditeur officiel, montant exact, identifiant jamais utilisé, numéro du payeur et horaire postérieur à l'affichage du montant ; tout concorde : activation automatique et notification au client ; sinon file de validation manuelle.
  2. Prise en charge des 7 applications : le montant exact dépend de l'application, du palier, de la durée et du nombre de points ; un paiement dont le numéro du payeur diffère du compte part en validation manuelle sans rejet automatique.
  3. Deuxième téléphone admin de secours (dédoublonnage par identifiant), alerte si le téléphone n'a pas synchronisé depuis plus de 2 h, journal complet (qui a validé, quand, avec quel SMS) ; un SMS partagé n'active jamais un abonnement.
CONTRÔLES (en local uniquement, aucune CI) : Tests : paiement exact activé ; même identifiant deux fois refusé ; demandes simultanées = un seul paiement.
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


## PROMPT 1.10 — Compte mère, transferts, Wave et services additionnels
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « Kiosko » (Fintech & Mobile Services) : gestion des points de vente de mobile money (Orange Money, MTN MoMo, Wave selon corpus). Elle lit les SMS de transaction (permission SMS obligatoire), met à jour caisse, floats et commissions, alerte le livreur par WhatsApp, avec IA locale, hors connexion. Elle porte aussi le MODE ADMIN : le téléphone de l'administration détecte les paiements d'abonnement des 7 applications. Charte : bleu nuit #0D2E57, vert #89B255. Cahier : Cahier_des_charges_01_Kiosko.pdf (texte intégral v1.2 en annexe B).
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire le multi-points et les réseaux paramétrables.
À FAIRE :
  1. Compte mère : tableau de bord consolidé, comparaison entre points, alertes de tous les points, création et désactivation d'un point, règles communes, transfert de float entre points tracé des deux côtés et confirmé par le receveur.
  2. Réseaux paramétrables (nom, expéditeur officiel, règles d'analyse, couleur de pastille) : ajout de Wave dès qu'un corpus réel est disponible, sinon saisie manuelle guidée ; pastilles orange et jaune réservées à Orange Money et MTN MoMo.
  3. Tarification des points : le 1er point est inclus, +500 F par mois à partir du 2e (paliers Services et Complet seulement, Essentiel limité à un point), prorata en cours de période.
CONTRÔLES (en local uniquement, aucune CI) : Tests : un point ne voit jamais les données d'un autre ; transfert confirmé des deux côtés.
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


## PROMPT 1.11 — Commercial, partenaire, parrainage et roue promotionnelle
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « Kiosko » (Fintech & Mobile Services) : gestion des points de vente de mobile money (Orange Money, MTN MoMo, Wave selon corpus). Elle lit les SMS de transaction (permission SMS obligatoire), met à jour caisse, floats et commissions, alerte le livreur par WhatsApp, avec IA locale, hors connexion. Elle porte aussi le MODE ADMIN : le téléphone de l'administration détecte les paiements d'abonnement des 7 applications. Charte : bleu nuit #0D2E57, vert #89B255. Cahier : Cahier_des_charges_01_Kiosko.pdf (texte intégral v1.2 en annexe B).
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire les espaces de croissance.
À FAIRE :
  1. Espace commercial : points de la zone avec statut, échéance, contact, quartier, géolocalisation (enregistrée avec consentement, confirmée sur place), notes, visites, boutons Itinéraire et WhatsApp ; jamais d'accès aux transactions.
  2. Espace partenaire : code de parrainage unique, vue à 360° de ses points parrainés, commission de 100 F au premier paiement validé seulement, une fois par point, jamais sur un mois offert ; anti-fraude : pas d'auto-parrainage.
  3. Roue de la chance promotionnelle : tirage réel avec probabilités et stocks de lots réglés par l'administration, budget plafonné, règlement visible, journal de chaque tirage, un tour par période.
CONTRÔLES (en local uniquement, aucune CI) : Tests : commission créditée une seule fois ; tirage conforme aux probabilités et stocks.
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


## PROMPT 1.12 — IA, assistant et sauvegarde Drive
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « Kiosko » (Fintech & Mobile Services) : gestion des points de vente de mobile money (Orange Money, MTN MoMo, Wave selon corpus). Elle lit les SMS de transaction (permission SMS obligatoire), met à jour caisse, floats et commissions, alerte le livreur par WhatsApp, avec IA locale, hors connexion. Elle porte aussi le MODE ADMIN : le téléphone de l'administration détecte les paiements d'abonnement des 7 applications. Charte : bleu nuit #0D2E57, vert #89B255. Cahier : Cahier_des_charges_01_Kiosko.pdf (texte intégral v1.2 en annexe B).
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Brancher l'IA de l'application et la sauvegarde.
À FAIRE :
  1. Branche sur la bibliothèque commune : prévision d'épuisement de float avec l'heure estimée, anomalies (écart de caisse, doublons, activité étrange d'un employé, SMS suspect), coach du jour, lecture des SMS par règles puis IA en secours, relances de crédits, assistant en langage naturel au palier Complet.
  2. Briefings : matin (float de chaque réseau, commissions d'hier, livraisons attendues) et soir (bilan, trous non résolus).
  3. Sauvegarde automatique quotidienne sur le Drive du client (palier Complet) : autorisation une seule fois, dossier créé par l'application, restauration en un clic sur un nouveau téléphone ; export manuel pour les clients sans compte Google.
CONTRÔLES (en local uniquement, aucune CI) : Tests locaux : prévision cohérente sur données fictives ; restauration simulée.
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


## PROMPT 1.13 — BI admin, recette et finition
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « Kiosko » (Fintech & Mobile Services) : gestion des points de vente de mobile money (Orange Money, MTN MoMo, Wave selon corpus). Elle lit les SMS de transaction (permission SMS obligatoire), met à jour caisse, floats et commissions, alerte le livreur par WhatsApp, avec IA locale, hors connexion. Elle porte aussi le MODE ADMIN : le téléphone de l'administration détecte les paiements d'abonnement des 7 applications. Charte : bleu nuit #0D2E57, vert #89B255. Cahier : Cahier_des_charges_01_Kiosko.pdf (texte intégral v1.2 en annexe B).
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Terminer l'application et préparer la recette.
À FAIRE :
  1. BI et pilotage admin : revenus (récurrent, par palier et par application), acquisition, fidélité, usage, qualité (SMS non reconnus, trous de solde par réseau et par modèle de téléphone, notifications lues).
  2. Passe la recette de la v1.2 (annexe C) et les critères de la section 14 du cahier ; applique la charte graphique Kiosko ; liste les écarts restants.
  3. Prépare le dossier de recette : liste des tests, résultats, anomalies connues. Ne publie rien.
CONTRÔLES (en local uniquement, aucune CI) : Rapport de recette complet ; je décide de la suite par écrit.
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
