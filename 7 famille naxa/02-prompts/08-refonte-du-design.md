> Version Markdown issue de la version texte source.
> Source : `Prompts_08_Refonte_du_design.txt`. Le contenu des consignes est conservé ; seuls le titre et les séparateurs de prompts sont balisés en Markdown.

# Dossier de prompts — Refonte du design (à exécuter en dernier)
Prompts pour ChatGPT · version 1.0 · 31 octobre 2026 · travail sur main, sans branche, PR, CI ni déploiement sans accord explicite

## PROMPT 8.0 — Système de design commun
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Refonte du design des 7 applications de la famille (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel). À exécuter UNIQUEMENT quand les fonctionnalités des applications concernées sont terminées et que leurs recettes sont passées. Directions retenues : Kiosko A, Bootik A, Zipple B, NAXA Services B, CotiZ A, Loyable C, NAXA Hotel C. Chaque application garde la charte de couleurs de son logo. Inspiration : le langage visuel et les animations de l'application NAXA (formes, rythmes, gestes), SANS reprendre son code métier, sa marque ni ses éléments d'identité (mascotte Luciole, intro à pendule, ambulance, code OTP animé). Jusqu'ici les consignes insistaient sur des écrans simples et légers : cette refonte les remplace par une exigence de qualité visuelle premium, sans sacrifier la lisibilité, la rapidité ni le fonctionnement sur téléphones d'entrée de gamme.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Construire le système de design partagé par les 7 applications (jetons, thèmes A, B, C, composants, mouvements).
À FAIRE :
  1. Audit : liste tous les écrans actuels de chaque application, repère ce qui est brut ou incohérent (espacements, typographie, boutons, états vides, chargements, erreurs, hors connexion) et propose un plan de refonte écran par écran. Attends mon accord avant de coder.
  2. Palettes exactes (marque / accent / texte sur accent / fond clair / fond sombre / surface sombre) : Kiosko #0D2E57 / #89B255 / #0D2E57 / #EEF4E6 / #0A1A33 / #12294A ; Bootik #052163 / #FC7820 / #052163 / #FFF1E5 / #0A1432 / #14224F ; Zipple #0E224D / #F56202 / #0E224D / #FFF0E3 / #0A1632 / #15244D ; NAXA Services #111111 / #DD3A33 / #FFFFFF / #FDECEA / #111111 / #1E1E1E ; CotiZ #012952 / #018A44 (+ rouge #D81224, jaune #FDCC1D) / #FFFFFF sur vert, #012952 sur jaune / #E8F5EC / #08203F / #12335C ; Loyable #002C98 / #FD6213 / #111B3D / #E8EEFC / #0A1650 / #14286E ; NAXA Hotel #2058F4 / #FDA601 / #111111 / #FFF4DC / #0B1B4D / #15296E. Couleurs de sens : succès #197A33, alerte #C62828, avertissement #8F5400, toujours avec icône et libellé.
  3. Jetons : rayons (cartes 18 dp, champs 16 dp, boutons en pilule), ombre douce teintée de la couleur de marque (0 6 22 à 9 %), échelle d'espacement 4, 8, 12, 16, 24, 32, échelle typographique 11, 13, 15, 17, 22, 32 sp, polices libres embarquées (Montserrat, Poppins ou Nunito selon l'application, au choix documenté).
  4. Directions : A « Cartes douces » = fond clair teinté de la couleur de marque, cartes blanches très arrondies (22 à 26 dp), pastille d'initiale de l'application en en-tête, grand chiffre du jour (24 sp gras) avec barre de progression à l'accent, liste à filets légers, bouton d'action en pilule à l'accent, barre de navigation blanche arrondie. B « Sombre premium » = fond profond de la marque, cartes surélevées avec liseré blanc à 8 %, chiffre du jour et actions dans la couleur d'accent, bouton d'action contour accent, barre de navigation sur la surface sombre. C « Éditorial épuré » = fond blanc, libellés en petites capitales espacées, très grand chiffre (32 sp) en couleur de marque, filet d'accent de 44 sur 3 dp, lignes à filets fins, appel à l'action souligné suivi d'une flèche, onglets en texte avec soulignement d'accent.
  5. Jetons de mouvement : durées 160 ms (retour de touche), 250 ms (changement d'état), 300 ms (feuilles et cartes), 700 ms (apparition au défilement) ; courbe signature cubic-bezier(0.22, 1, 0.36, 1) (PathInterpolator Android) ; courbe à dépassement cubic-bezier(0.2, 0.85, 0.25, 1.25) pour l'arrivée d'un objet. Gestes : apparition (montée de 24 dp + fondu, flou seulement si l'appareil le supporte, décalage de 0 à 600 ms entre éléments) ; entrée de carte (montée de 12 dp, échelle 0,99 vers 1) ; navigation du bas (l'icône part de +3 dp et échelle 0,92, monte à −2 dp et 1,08, revient à 0 ; le libellé remonte de 65 %) ; squelette de chargement (reflet qui traverse en 1400 ms) ; cloche (oscillations amorties −24°, 22°, −18°, 15°, −11°, 8°, −5°) ; favori (échelle 1, 1,42, 1,05, 1,3, 1) ; objet ajouté (tombe de −16 dp, échelle 0,3 vers 1, rotation −40° vers 0) et compteur qui bat (1,14 puis 1,08) ; validation (rond qui apparaît, coche dessinée en 380 ms, onde qui s'élargit) ; feuille glissante (montée de 24 dp en 300 ms) ; message en haut (descente de 8 dp en 220 ms) ; secousse d'erreur (±4 dp en 260 ms) ; onde de position (échelle 0,75 vers 1,6 en 1,8 s, en boucle) ; respiration douce (échelle 1 vers 1,05 en 3,5 s).
  6. Composants communs premium : bouton principal et secondaire (48 à 52 dp), carte, champ flottant avec coche de validité, liste, puce d'état avec icône et libellé, feuille glissante, message en haut, squelette de chargement, état vide illustré, barre de navigation du bas animée, barre supérieure, indicateur de synchronisation, bandeau hors connexion, graphiques simples (jauge, barres).
  7. États standard : vide, chargement, erreur, hors connexion, succès ; chacun avec une mise en page et un texte soignés (FR et EN).
  8. Thème par application : un seul jeu de variables à définir (marque, accent, texte sur accent, fonds clair et sombre, surface) ; le reste est partagé. Documente comment ajouter une application.
CONTRÔLES (en local uniquement, aucune CI) : Écrans de démonstration de chaque composant en clair et en sombre pour au moins deux applications ; contraste vérifié par calcul ; tests existants inchangés.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Aucune logique métier, aucun calcul, aucune règle de sécurité, aucun schéma de données ne change : la refonte ne touche que l'apparence, la mise en page, les composants et les animations. Les tests existants doivent continuer à passer.
  - Qualité visuelle premium : hiérarchie typographique nette, espacements réguliers, alignements précis, cartes soignées, états vides illustrés, transitions fluides. Pas de rendu brut, générique ou « de démonstration ».
  - Lisibilité d'abord : texte courant à 4,5 : 1 de contraste au moins, cibles tactiles d'au moins 48 dp, textes qui supportent un agrandissement de la police à 130 %, états toujours doublés d'une icône et d'un libellé.
  - Performance sur téléphone d'entrée de gamme : animations uniquement sur transformation et opacité, jamais sur la mise en page ; pas de flou animé ni d'ombres lourdes sur les appareils lents (repli en simple fondu) ; images compressées ; aucune bibliothèque d'animation lourde ; démarrage et défilement fluides.
  - Respecter le réglage « supprimer les animations » du téléphone : sans animation, toutes les fonctions restent utilisables et lisibles.
  - Chaque application garde STRICTEMENT la charte de couleurs de son logo ; le thème est un jeu de variables, pas du code copié application par application.
  - Français et English : aucun texte en dur ; les libellés plus longs en anglais ne doivent pas casser les mises en page.
  - Mode clair et mode sombre pour chaque application (le sombre est le mode par défaut de NAXA Services et de Zipple).
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


## PROMPT 8.1 — Refonte de Kiosko (direction A)
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Refonte du design des 7 applications de la famille (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel). À exécuter UNIQUEMENT quand les fonctionnalités des applications concernées sont terminées et que leurs recettes sont passées. Directions retenues : Kiosko A, Bootik A, Zipple B, NAXA Services B, CotiZ A, Loyable C, NAXA Hotel C. Chaque application garde la charte de couleurs de son logo. Inspiration : le langage visuel et les animations de l'application NAXA (formes, rythmes, gestes), SANS reprendre son code métier, sa marque ni ses éléments d'identité (mascotte Luciole, intro à pendule, ambulance, code OTP animé). Jusqu'ici les consignes insistaient sur des écrans simples et légers : cette refonte les remplace par une exigence de qualité visuelle premium, sans sacrifier la lisibilité, la rapidité ni le fonctionnement sur téléphones d'entrée de gamme.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Appliquer le système de design à Kiosko avec la direction A et sa charte (bleu nuit, vert).
À FAIRE :
  1. Écrans à refondre : tableau de bord (float par réseau avec pastilles orange et jaune réservées à Orange Money et MTN MoMo, jauge de float animée, espèces, commissions du jour, trous non résolus), caisse et clôture, liste des transactions (étiquettes de source), secours de lecture (partager, coller, saisie guidée avec l'effet affiché avant validation), alertes livreur avec aperçu du message WhatsApp, santé de l'appli, écran de paiement d'abonnement, mode admin (file des paiements).
  2. Mouvement signature : la jauge de float se remplit à l'ouverture ; la notification de seuil fait sonner la cloche ; une opération confirmée dessine la coche.
  3. Vert de marque : en fond seulement (texte bleu nuit dessus) ; pour le texte et les icônes utiliser le vert foncé #5E8A2E ; le succès utilise #197A33 avec l'icône ✓, jamais le vert de marque seul.
CONTRÔLES (en local uniquement, aucune CI) : Captures de chaque écran listé en clair et en sombre ; fonctions inchangées ; parseur et calculs non touchés.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Aucune logique métier, aucun calcul, aucune règle de sécurité, aucun schéma de données ne change : la refonte ne touche que l'apparence, la mise en page, les composants et les animations. Les tests existants doivent continuer à passer.
  - Qualité visuelle premium : hiérarchie typographique nette, espacements réguliers, alignements précis, cartes soignées, états vides illustrés, transitions fluides. Pas de rendu brut, générique ou « de démonstration ».
  - Lisibilité d'abord : texte courant à 4,5 : 1 de contraste au moins, cibles tactiles d'au moins 48 dp, textes qui supportent un agrandissement de la police à 130 %, états toujours doublés d'une icône et d'un libellé.
  - Performance sur téléphone d'entrée de gamme : animations uniquement sur transformation et opacité, jamais sur la mise en page ; pas de flou animé ni d'ombres lourdes sur les appareils lents (repli en simple fondu) ; images compressées ; aucune bibliothèque d'animation lourde ; démarrage et défilement fluides.
  - Respecter le réglage « supprimer les animations » du téléphone : sans animation, toutes les fonctions restent utilisables et lisibles.
  - Chaque application garde STRICTEMENT la charte de couleurs de son logo ; le thème est un jeu de variables, pas du code copié application par application.
  - Français et English : aucun texte en dur ; les libellés plus longs en anglais ne doivent pas casser les mises en page.
  - Mode clair et mode sombre pour chaque application (le sombre est le mode par défaut de NAXA Services et de Zipple).
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


## PROMPT 8.2 — Refonte de Bootik (direction A)
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Refonte du design des 7 applications de la famille (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel). À exécuter UNIQUEMENT quand les fonctionnalités des applications concernées sont terminées et que leurs recettes sont passées. Directions retenues : Kiosko A, Bootik A, Zipple B, NAXA Services B, CotiZ A, Loyable C, NAXA Hotel C. Chaque application garde la charte de couleurs de son logo. Inspiration : le langage visuel et les animations de l'application NAXA (formes, rythmes, gestes), SANS reprendre son code métier, sa marque ni ses éléments d'identité (mascotte Luciole, intro à pendule, ambulance, code OTP animé). Jusqu'ici les consignes insistaient sur des écrans simples et légers : cette refonte les remplace par une exigence de qualité visuelle premium, sans sacrifier la lisibilité, la rapidité ni le fonctionnement sur téléphones d'entrée de gamme.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Appliquer le système de design à Bootik avec la direction A et sa charte (bleu nuit, orange).
À FAIRE :
  1. Écrans à refondre : accueil (ventes du jour), caisse (grille de produits, panier), catalogue et fiche produit, stock avec alertes de rupture et de péremption, ardoise et clients, profil Dépôt de gaz (échange de bouteilles, consignes, livraison), fournisseurs et commande WhatsApp, rapports et compta.
  2. Mouvement signature : l'article ajouté tombe dans le panier et le compteur bat ; pour l'échange de gaz, les compteurs « pleines » et « vides » s'échangent avec une transition fluide.
  3. L'orange de marque ne signale jamais une erreur : l'alerte garde son propre rouge avec icône.
CONTRÔLES (en local uniquement, aucune CI) : Captures de chaque écran listé en clair et en sombre ; saisie rapide préservée (trois touches au plus vers un écran clé).
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Aucune logique métier, aucun calcul, aucune règle de sécurité, aucun schéma de données ne change : la refonte ne touche que l'apparence, la mise en page, les composants et les animations. Les tests existants doivent continuer à passer.
  - Qualité visuelle premium : hiérarchie typographique nette, espacements réguliers, alignements précis, cartes soignées, états vides illustrés, transitions fluides. Pas de rendu brut, générique ou « de démonstration ».
  - Lisibilité d'abord : texte courant à 4,5 : 1 de contraste au moins, cibles tactiles d'au moins 48 dp, textes qui supportent un agrandissement de la police à 130 %, états toujours doublés d'une icône et d'un libellé.
  - Performance sur téléphone d'entrée de gamme : animations uniquement sur transformation et opacité, jamais sur la mise en page ; pas de flou animé ni d'ombres lourdes sur les appareils lents (repli en simple fondu) ; images compressées ; aucune bibliothèque d'animation lourde ; démarrage et défilement fluides.
  - Respecter le réglage « supprimer les animations » du téléphone : sans animation, toutes les fonctions restent utilisables et lisibles.
  - Chaque application garde STRICTEMENT la charte de couleurs de son logo ; le thème est un jeu de variables, pas du code copié application par application.
  - Français et English : aucun texte en dur ; les libellés plus longs en anglais ne doivent pas casser les mises en page.
  - Mode clair et mode sombre pour chaque application (le sombre est le mode par défaut de NAXA Services et de Zipple).
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


## PROMPT 8.3 — Refonte de Zipple (direction B)
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Refonte du design des 7 applications de la famille (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel). À exécuter UNIQUEMENT quand les fonctionnalités des applications concernées sont terminées et que leurs recettes sont passées. Directions retenues : Kiosko A, Bootik A, Zipple B, NAXA Services B, CotiZ A, Loyable C, NAXA Hotel C. Chaque application garde la charte de couleurs de son logo. Inspiration : le langage visuel et les animations de l'application NAXA (formes, rythmes, gestes), SANS reprendre son code métier, sa marque ni ses éléments d'identité (mascotte Luciole, intro à pendule, ambulance, code OTP animé). Jusqu'ici les consignes insistaient sur des écrans simples et légers : cette refonte les remplace par une exigence de qualité visuelle premium, sans sacrifier la lisibilité, la rapidité ni le fonctionnement sur téléphones d'entrée de gamme.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Appliquer le système de design à Zipple avec la direction B (sombre par défaut) et sa charte (bleu nuit, orange).
À FAIRE :
  1. Écrans à refondre : plan de salle (tables par statut avec icône et lettre, pas seulement la couleur), ticket de table et addition fractionnée, carte avec photos compressées, cuisine et ingrédients, consignes de casiers, profil Braiseur (jauge de rendement, invendus), clôture de caisse.
  2. Mouvement signature : une commande en attente fait pulser sa table ; le passage d'un statut à l'autre bascule avec une transition courte ; les feuilles glissent depuis le bas.
  3. Le mode sombre est le mode par défaut ; le mode clair reste proposé et lisible en plein soleil pour le braiseur.
CONTRÔLES (en local uniquement, aucune CI) : Captures en sombre et en clair ; saisie à une main testée ; contraste vérifié sur fond sombre.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Aucune logique métier, aucun calcul, aucune règle de sécurité, aucun schéma de données ne change : la refonte ne touche que l'apparence, la mise en page, les composants et les animations. Les tests existants doivent continuer à passer.
  - Qualité visuelle premium : hiérarchie typographique nette, espacements réguliers, alignements précis, cartes soignées, états vides illustrés, transitions fluides. Pas de rendu brut, générique ou « de démonstration ».
  - Lisibilité d'abord : texte courant à 4,5 : 1 de contraste au moins, cibles tactiles d'au moins 48 dp, textes qui supportent un agrandissement de la police à 130 %, états toujours doublés d'une icône et d'un libellé.
  - Performance sur téléphone d'entrée de gamme : animations uniquement sur transformation et opacité, jamais sur la mise en page ; pas de flou animé ni d'ombres lourdes sur les appareils lents (repli en simple fondu) ; images compressées ; aucune bibliothèque d'animation lourde ; démarrage et défilement fluides.
  - Respecter le réglage « supprimer les animations » du téléphone : sans animation, toutes les fonctions restent utilisables et lisibles.
  - Chaque application garde STRICTEMENT la charte de couleurs de son logo ; le thème est un jeu de variables, pas du code copié application par application.
  - Français et English : aucun texte en dur ; les libellés plus longs en anglais ne doivent pas casser les mises en page.
  - Mode clair et mode sombre pour chaque application (le sombre est le mode par défaut de NAXA Services et de Zipple).
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


## PROMPT 8.4 — Refonte de NAXA Services (direction B)
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Refonte du design des 7 applications de la famille (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel). À exécuter UNIQUEMENT quand les fonctionnalités des applications concernées sont terminées et que leurs recettes sont passées. Directions retenues : Kiosko A, Bootik A, Zipple B, NAXA Services B, CotiZ A, Loyable C, NAXA Hotel C. Chaque application garde la charte de couleurs de son logo. Inspiration : le langage visuel et les animations de l'application NAXA (formes, rythmes, gestes), SANS reprendre son code métier, sa marque ni ses éléments d'identité (mascotte Luciole, intro à pendule, ambulance, code OTP animé). Jusqu'ici les consignes insistaient sur des écrans simples et légers : cette refonte les remplace par une exigence de qualité visuelle premium, sans sacrifier la lisibilité, la rapidité ni le fonctionnement sur téléphones d'entrée de gamme.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Appliquer le système de design à NAXA Services avec la direction B (sombre par défaut) et sa charte (noir, rouge).
À FAIRE :
  1. Écrans à refondre : agenda par prestataire (créneaux, rendez-vous), prise de rendez-vous, dépôt de pressing avec frise de statuts (reçu, en cours, prêt, retiré), caisse, commissions par prestataire, fiche client et fidélité.
  2. Mouvement signature : la frise des statuts du pressing progresse en s'animant d'une étape à l'autre ; un rendez-vous confirmé dessine la coche.
  3. Le rouge est la couleur de marque : l'alerte utilise un rouge plus profond #8E0000 avec l'icône ! et un libellé. Le monogramme N de la marque NAXA peut être utilisé car la marque est distincte et à vous.
CONTRÔLES (en local uniquement, aucune CI) : Captures en sombre et en clair ; états lisibles sans la couleur.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Aucune logique métier, aucun calcul, aucune règle de sécurité, aucun schéma de données ne change : la refonte ne touche que l'apparence, la mise en page, les composants et les animations. Les tests existants doivent continuer à passer.
  - Qualité visuelle premium : hiérarchie typographique nette, espacements réguliers, alignements précis, cartes soignées, états vides illustrés, transitions fluides. Pas de rendu brut, générique ou « de démonstration ».
  - Lisibilité d'abord : texte courant à 4,5 : 1 de contraste au moins, cibles tactiles d'au moins 48 dp, textes qui supportent un agrandissement de la police à 130 %, états toujours doublés d'une icône et d'un libellé.
  - Performance sur téléphone d'entrée de gamme : animations uniquement sur transformation et opacité, jamais sur la mise en page ; pas de flou animé ni d'ombres lourdes sur les appareils lents (repli en simple fondu) ; images compressées ; aucune bibliothèque d'animation lourde ; démarrage et défilement fluides.
  - Respecter le réglage « supprimer les animations » du téléphone : sans animation, toutes les fonctions restent utilisables et lisibles.
  - Chaque application garde STRICTEMENT la charte de couleurs de son logo ; le thème est un jeu de variables, pas du code copié application par application.
  - Français et English : aucun texte en dur ; les libellés plus longs en anglais ne doivent pas casser les mises en page.
  - Mode clair et mode sombre pour chaque application (le sombre est le mode par défaut de NAXA Services et de Zipple).
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


## PROMPT 8.5 — Refonte de CotiZ (direction A)
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Refonte du design des 7 applications de la famille (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel). À exécuter UNIQUEMENT quand les fonctionnalités des applications concernées sont terminées et que leurs recettes sont passées. Directions retenues : Kiosko A, Bootik A, Zipple B, NAXA Services B, CotiZ A, Loyable C, NAXA Hotel C. Chaque application garde la charte de couleurs de son logo. Inspiration : le langage visuel et les animations de l'application NAXA (formes, rythmes, gestes), SANS reprendre son code métier, sa marque ni ses éléments d'identité (mascotte Luciole, intro à pendule, ambulance, code OTP animé). Jusqu'ici les consignes insistaient sur des écrans simples et légers : cette refonte les remplace par une exigence de qualité visuelle premium, sans sacrifier la lisibilité, la rapidité ni le fonctionnement sur téléphones d'entrée de gamme.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Appliquer le système de design à CotiZ avec la direction A et sa charte (bleu nuit, vert, rouge, jaune).
À FAIRE :
  1. Écrans à refondre : tableau du groupe (« qui a payé, qui doit »), cotisations, tirage des tours, présences et absences, épargne avec objectifs, caisse de solidarité, prêts internes (derrière leur interrupteur).
  2. Mouvement signature : le tirage au sort des tours — les cartes des membres se retournent une à une puis se rangent dans l'ordre tiré ; affichage de la graine et du message « tirage journalisé » ; durée courte, jamais d'attente inutile ; sans animation, l'ordre s'affiche directement.
  3. Le vert et le rouge sont à la fois des couleurs de marque et des états : chaque état a une icône et un mot (✓ payé, ! en retard). Interface chaleureuse, claire, adaptée à un public peu à l'aise avec le numérique.
CONTRÔLES (en local uniquement, aucune CI) : Captures de chaque écran listé ; l'ordre de tirage affiché est identique à celui du journal.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Aucune logique métier, aucun calcul, aucune règle de sécurité, aucun schéma de données ne change : la refonte ne touche que l'apparence, la mise en page, les composants et les animations. Les tests existants doivent continuer à passer.
  - Qualité visuelle premium : hiérarchie typographique nette, espacements réguliers, alignements précis, cartes soignées, états vides illustrés, transitions fluides. Pas de rendu brut, générique ou « de démonstration ».
  - Lisibilité d'abord : texte courant à 4,5 : 1 de contraste au moins, cibles tactiles d'au moins 48 dp, textes qui supportent un agrandissement de la police à 130 %, états toujours doublés d'une icône et d'un libellé.
  - Performance sur téléphone d'entrée de gamme : animations uniquement sur transformation et opacité, jamais sur la mise en page ; pas de flou animé ni d'ombres lourdes sur les appareils lents (repli en simple fondu) ; images compressées ; aucune bibliothèque d'animation lourde ; démarrage et défilement fluides.
  - Respecter le réglage « supprimer les animations » du téléphone : sans animation, toutes les fonctions restent utilisables et lisibles.
  - Chaque application garde STRICTEMENT la charte de couleurs de son logo ; le thème est un jeu de variables, pas du code copié application par application.
  - Français et English : aucun texte en dur ; les libellés plus longs en anglais ne doivent pas casser les mises en page.
  - Mode clair et mode sombre pour chaque application (le sombre est le mode par défaut de NAXA Services et de Zipple).
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


## PROMPT 8.6 — Refonte de Loyable (direction C)
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Refonte du design des 7 applications de la famille (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel). À exécuter UNIQUEMENT quand les fonctionnalités des applications concernées sont terminées et que leurs recettes sont passées. Directions retenues : Kiosko A, Bootik A, Zipple B, NAXA Services B, CotiZ A, Loyable C, NAXA Hotel C. Chaque application garde la charte de couleurs de son logo. Inspiration : le langage visuel et les animations de l'application NAXA (formes, rythmes, gestes), SANS reprendre son code métier, sa marque ni ses éléments d'identité (mascotte Luciole, intro à pendule, ambulance, code OTP animé). Jusqu'ici les consignes insistaient sur des écrans simples et légers : cette refonte les remplace par une exigence de qualité visuelle premium, sans sacrifier la lisibilité, la rapidité ni le fonctionnement sur téléphones d'entrée de gamme.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Appliquer le système de design à Loyable avec la direction C et sa charte (bleu, orange).
À FAIRE :
  1. Écrans à refondre : tableau de bord (grand chiffre des loyers encaissés), liste des biens, fiche locataire, calendrier des loyers, quittance (aperçu fidèle du document), états des lieux (photos, signature à l'écran), relances graduées.
  2. Mouvement signature : la quittance est « tamponnée » payée d'un geste court ; les autres mouvements restent discrets (apparition en 250 ms) pour un ton sérieux et de confiance.
  3. L'orange de marque est proche de l'avertissement : les loyers en retard utilisent la couleur d'alerte avec icône.
CONTRÔLES (en local uniquement, aucune CI) : Captures de chaque écran ; aperçu de quittance identique au PDF généré.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Aucune logique métier, aucun calcul, aucune règle de sécurité, aucun schéma de données ne change : la refonte ne touche que l'apparence, la mise en page, les composants et les animations. Les tests existants doivent continuer à passer.
  - Qualité visuelle premium : hiérarchie typographique nette, espacements réguliers, alignements précis, cartes soignées, états vides illustrés, transitions fluides. Pas de rendu brut, générique ou « de démonstration ».
  - Lisibilité d'abord : texte courant à 4,5 : 1 de contraste au moins, cibles tactiles d'au moins 48 dp, textes qui supportent un agrandissement de la police à 130 %, états toujours doublés d'une icône et d'un libellé.
  - Performance sur téléphone d'entrée de gamme : animations uniquement sur transformation et opacité, jamais sur la mise en page ; pas de flou animé ni d'ombres lourdes sur les appareils lents (repli en simple fondu) ; images compressées ; aucune bibliothèque d'animation lourde ; démarrage et défilement fluides.
  - Respecter le réglage « supprimer les animations » du téléphone : sans animation, toutes les fonctions restent utilisables et lisibles.
  - Chaque application garde STRICTEMENT la charte de couleurs de son logo ; le thème est un jeu de variables, pas du code copié application par application.
  - Français et English : aucun texte en dur ; les libellés plus longs en anglais ne doivent pas casser les mises en page.
  - Mode clair et mode sombre pour chaque application (le sombre est le mode par défaut de NAXA Services et de Zipple).
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


## PROMPT 8.7 — Refonte de NAXA Hotel (direction C)
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Refonte du design des 7 applications de la famille (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel). À exécuter UNIQUEMENT quand les fonctionnalités des applications concernées sont terminées et que leurs recettes sont passées. Directions retenues : Kiosko A, Bootik A, Zipple B, NAXA Services B, CotiZ A, Loyable C, NAXA Hotel C. Chaque application garde la charte de couleurs de son logo. Inspiration : le langage visuel et les animations de l'application NAXA (formes, rythmes, gestes), SANS reprendre son code métier, sa marque ni ses éléments d'identité (mascotte Luciole, intro à pendule, ambulance, code OTP animé). Jusqu'ici les consignes insistaient sur des écrans simples et légers : cette refonte les remplace par une exigence de qualité visuelle premium, sans sacrifier la lisibilité, la rapidité ni le fonctionnement sur téléphones d'entrée de gamme.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Appliquer le système de design à NAXA Hotel avec la direction C et sa charte (bleu vif, jaune-orangé).
À FAIRE :
  1. Écrans à refondre : calendrier d'occupation (grille chambres par jours, barres de séjour), réservation, arrivée et départ, compte du séjour (note détaillée), ménage (statuts avec lettre et icône), planning des équipes et passation, clôture de nuit, comparatif multi-hôtels.
  2. Mouvement signature : les barres de séjour glissent à leur place dans le calendrier ; un changement de statut de chambre bascule avec une transition courte.
  3. Lisibilité des grilles denses prioritaire ; le réceptionniste de nuit peut basculer en mode sombre ; le jaune-orangé sert en fond avec texte noir, jamais en texte sur blanc.
CONTRÔLES (en local uniquement, aucune CI) : Captures de chaque écran listé en clair et en sombre ; grille lisible avec police agrandie à 130 %.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Aucune logique métier, aucun calcul, aucune règle de sécurité, aucun schéma de données ne change : la refonte ne touche que l'apparence, la mise en page, les composants et les animations. Les tests existants doivent continuer à passer.
  - Qualité visuelle premium : hiérarchie typographique nette, espacements réguliers, alignements précis, cartes soignées, états vides illustrés, transitions fluides. Pas de rendu brut, générique ou « de démonstration ».
  - Lisibilité d'abord : texte courant à 4,5 : 1 de contraste au moins, cibles tactiles d'au moins 48 dp, textes qui supportent un agrandissement de la police à 130 %, états toujours doublés d'une icône et d'un libellé.
  - Performance sur téléphone d'entrée de gamme : animations uniquement sur transformation et opacité, jamais sur la mise en page ; pas de flou animé ni d'ombres lourdes sur les appareils lents (repli en simple fondu) ; images compressées ; aucune bibliothèque d'animation lourde ; démarrage et défilement fluides.
  - Respecter le réglage « supprimer les animations » du téléphone : sans animation, toutes les fonctions restent utilisables et lisibles.
  - Chaque application garde STRICTEMENT la charte de couleurs de son logo ; le thème est un jeu de variables, pas du code copié application par application.
  - Français et English : aucun texte en dur ; les libellés plus longs en anglais ne doivent pas casser les mises en page.
  - Mode clair et mode sombre pour chaque application (le sombre est le mode par défaut de NAXA Services et de Zipple).
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


## PROMPT 8.8 — Recette visuelle et performance finale
RÔLE : Tu es un ingénieur logiciel senior (Android, Supabase et PostgreSQL, sécurité, interfaces mobiles pour téléphones d'entrée de gamme). Je suis porteur de projet et non développeur : explique brièvement, puis livre du code complet et prêt à l'emploi.
PROJET : Refonte du design des 7 applications de la famille (Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA Hotel). À exécuter UNIQUEMENT quand les fonctionnalités des applications concernées sont terminées et que leurs recettes sont passées. Directions retenues : Kiosko A, Bootik A, Zipple B, NAXA Services B, CotiZ A, Loyable C, NAXA Hotel C. Chaque application garde la charte de couleurs de son logo. Inspiration : le langage visuel et les animations de l'application NAXA (formes, rythmes, gestes), SANS reprendre son code métier, sa marque ni ses éléments d'identité (mascotte Luciole, intro à pendule, ambulance, code OTP animé). Jusqu'ici les consignes insistaient sur des écrans simples et légers : cette refonte les remplace par une exigence de qualité visuelle premium, sans sacrifier la lisibilité, la rapidité ni le fonctionnement sur téléphones d'entrée de gamme.
ÉTAT DE DÉPART : voici le fichier de passation de l'étape précédente : [COLLE ICI LE FICHIER DE PASSATION]. S'il est vide ou absent, dis-le-moi avant de commencer.
MISSION : Contrôler la cohérence, la qualité visuelle et la performance des 7 applications.
À FAIRE :
  1. Pour chaque application : captures des écrans clés en clair et en sombre, en français et en English, avec police agrandie à 130 % ; liste des écarts avec la charte et la direction retenue.
  2. Accessibilité : contrastes mesurés (4,5 : 1 pour le texte), cibles de 48 dp, états lisibles sans la couleur, réglage « supprimer les animations » respecté.
  3. Performance sur téléphone d'entrée de gamme : temps de démarrage, fluidité du défilement et des animations (pas de saccades visibles), poids de l'APK, consommation de batterie ; liste des animations désactivées automatiquement sur appareil lent.
  4. Cohérence de la famille : mêmes composants, mêmes gestes, mêmes durées d'une application à l'autre ; seules les couleurs, le logo, la police et le vocabulaire changent.
  5. Établis un rapport avec les écarts restants et leur priorité. Ne publie rien.
CONTRÔLES (en local uniquement, aucune CI) : Rapport complet avec captures ; aucun test fonctionnel ne régresse.
LIVRABLES : Code complet avec chemins exacts, migrations SQL ordonnées (non appliquées), textes FR/EN, tests locaux demandés, et le fichier de passation.
CONTRAINTES DU PROJET :
  - Aucune logique métier, aucun calcul, aucune règle de sécurité, aucun schéma de données ne change : la refonte ne touche que l'apparence, la mise en page, les composants et les animations. Les tests existants doivent continuer à passer.
  - Qualité visuelle premium : hiérarchie typographique nette, espacements réguliers, alignements précis, cartes soignées, états vides illustrés, transitions fluides. Pas de rendu brut, générique ou « de démonstration ».
  - Lisibilité d'abord : texte courant à 4,5 : 1 de contraste au moins, cibles tactiles d'au moins 48 dp, textes qui supportent un agrandissement de la police à 130 %, états toujours doublés d'une icône et d'un libellé.
  - Performance sur téléphone d'entrée de gamme : animations uniquement sur transformation et opacité, jamais sur la mise en page ; pas de flou animé ni d'ombres lourdes sur les appareils lents (repli en simple fondu) ; images compressées ; aucune bibliothèque d'animation lourde ; démarrage et défilement fluides.
  - Respecter le réglage « supprimer les animations » du téléphone : sans animation, toutes les fonctions restent utilisables et lisibles.
  - Chaque application garde STRICTEMENT la charte de couleurs de son logo ; le thème est un jeu de variables, pas du code copié application par application.
  - Français et English : aucun texte en dur ; les libellés plus longs en anglais ne doivent pas casser les mises en page.
  - Mode clair et mode sombre pour chaque application (le sombre est le mode par défaut de NAXA Services et de Zipple).
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
