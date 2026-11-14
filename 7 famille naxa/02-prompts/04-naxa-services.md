> Version Markdown issue de la version texte source.
> Source : `Prompts_04_NAXA_Services.txt`. Le contenu des consignes est conservé ; seuls le titre et les séparateurs de prompts sont balisés en Markdown.

# Dossier de prompts — NAXA Services
Prompts pour ChatGPT · version 1.0 · 31 octobre 2026 · travail sur main, sans branche, PR, CI ni déploiement sans accord explicite

## PROMPT 4.1 — Catalogue de prestations et caisse
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « NAXA Services » (marque NAXA distincte) : gestion du pressing et du salon de coiffure : prestations, rendez-vous, dépôts et statuts, commissions par prestataire. Charte : noir #111111, rouge #DD3A33, mode sombre par défaut. Cahier : Cahier_des_charges_04_NAXA_Services.pdf.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire la base des prestations.
À FAIRE :
  1. Prestations avec prix, durée, prestataire habilité, forfaits et formules ; prix par type de vêtement (pressing) ; produits vendus au comptoir.
  2. Caisse : espèces, mobile money confirmé, mixte, reçu WhatsApp, impression Bluetooth, ouverture et clôture avec écart.
  3. Thème sombre par défaut (charte NAXA Services) avec mode clair en option.
CONTRÔLES (en local uniquement, aucune CI) : Tests : prestation facturée au bon prix et au bon prestataire.
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


## PROMPT 4.2 — Agenda et rendez-vous
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « NAXA Services » (marque NAXA distincte) : gestion du pressing et du salon de coiffure : prestations, rendez-vous, dépôts et statuts, commissions par prestataire. Charte : noir #111111, rouge #DD3A33, mode sombre par défaut. Cahier : Cahier_des_charges_04_NAXA_Services.pdf.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire la prise de rendez-vous.
À FAIRE :
  1. Agenda par prestataire ou par poste, créneaux libres, durée par prestation, rendez-vous en quelques touches, rappel WhatsApp avant l'heure (message préparé), acompte payé par mobile money confirmé, annulation, absences non excusées suivies, liste d'attente.
CONTRÔLES (en local uniquement, aucune CI) : Tests : deux rendez-vous ne peuvent pas se chevaucher sur le même prestataire.
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


## PROMPT 4.3 — Pressing : dépôts, statuts et retraits
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « NAXA Services » (marque NAXA distincte) : gestion du pressing et du salon de coiffure : prestations, rendez-vous, dépôts et statuts, commissions par prestataire. Charte : noir #111111, rouge #DD3A33, mode sombre par défaut. Cahier : Cahier_des_charges_04_NAXA_Services.pdf.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire le profil pressing.
À FAIRE :
  1. Dépôt avec numéro de ticket, liste des pièces, tarif, acompte, date de retrait promise ; étiquettes ; statuts reçu, en cours, prêt, retiré ; message WhatsApp « votre linge est prêt ».
  2. Vêtements non retirés : alerte après un délai réglable, relances, règle de conservation ; reçu par WhatsApp.
CONTRÔLES (en local uniquement, aucune CI) : Tests : passage à « prêt » prépare le message ; alerte après le délai.
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


## PROMPT 4.4 — Prestataires, commissions et équipe
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « NAXA Services » (marque NAXA distincte) : gestion du pressing et du salon de coiffure : prestations, rendez-vous, dépôts et statuts, commissions par prestataire. Charte : noir #111111, rouge #DD3A33, mode sombre par défaut. Cahier : Cahier_des_charges_04_NAXA_Services.pdf.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire la rémunération.
À FAIRE :
  1. Part de chaque prestation par coiffeur ou employé, commissions par prestataire et par période, avances, primes, pointage et présences, classement et défis, droits par rôle, écart de caisse par employé.
CONTRÔLES (en local uniquement, aucune CI) : Tests : commission calculée exactement par prestation.
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


## PROMPT 4.5 — Clients et fidélité
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « NAXA Services » (marque NAXA distincte) : gestion du pressing et du salon de coiffure : prestations, rendez-vous, dépôts et statuts, commissions par prestataire. Charte : noir #111111, rouge #DD3A33, mode sombre par défaut. Cahier : Cahier_des_charges_04_NAXA_Services.pdf.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire la relation client.
À FAIRE :
  1. Fiche et historique client (prestations, préférences, dernière visite), points de fidélité, carte QR, anniversaires et offres, parrainage client, roue de la chance clients, relance des clients qui ne reviennent plus.
CONTRÔLES (en local uniquement, aucune CI) : Tests : relance proposée après un délai réglable sans visite.
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


## PROMPT 4.6 — Consommables, compta et multi-salons
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « NAXA Services » (marque NAXA distincte) : gestion du pressing et du salon de coiffure : prestations, rendez-vous, dépôts et statuts, commissions par prestataire. Charte : noir #111111, rouge #DD3A33, mode sombre par défaut. Cahier : Cahier_des_charges_04_NAXA_Services.pdf.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Compléter la gestion.
À FAIRE :
  1. Consommables simples (produits de coiffure, lessive) avec alerte de rupture, sans stock détaillé par code-barres ; dépenses ; journal ; SYSCOHADA et TVA datée ; tableau de bord du jour, taux de remplissage de l'agenda ; multi-salons via compte mère.
CONTRÔLES (en local uniquement, aucune CI) : Tests : taux de remplissage calculé sur données fictives.
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


## PROMPT 4.7 — IA, briefings et recette
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Application « NAXA Services » (marque NAXA distincte) : gestion du pressing et du salon de coiffure : prestations, rendez-vous, dépôts et statuts, commissions par prestataire. Charte : noir #111111, rouge #DD3A33, mode sombre par défaut. Cahier : Cahier_des_charges_04_NAXA_Services.pdf.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Terminer NAXA Services.
À FAIRE :
  1. Prévision de l'affluence, suggestion de créneaux, détection d'anomalies (prestation non encaissée, remises répétées), conseil de tarifs, score de santé, assistant ; briefing du matin (rendez-vous, dépôts à rendre) et du soir (recette, commissions du jour).
  2. Passe les critères de recette du cahier 04 ; applique la charte graphique ; liste les écarts. Ne publie rien.
CONTRÔLES (en local uniquement, aucune CI) : Rapport de recette complet.
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
