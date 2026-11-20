# NAXA — Catalogue maître E2E bulk transversal vers Go Live

**Version :** 1.0 — 20 novembre 2026  
**Dépôt :** audreymendomo23-netizen/NAXA — main  
**HEAD source inspecté :** d050f598fe9731753af4d2f3f4ea9956724cea09  
**Environnement d'exécution :** Supabase Replay et environnements CI/local isolés uniquement  
**Statut :** CONCEPTION DOCUMENTÉE — CAMPAGNE BULK PARTIELLEMENT EXÉCUTÉE (contrôles SQL Replay B00/B01/B02 du 20/11/2026) — NAXA NON CERTIFIÉE GO LIVE

---

## 1. Règle de conception

Le programme comprend **17 lots B00 à B16**. Un lot n'est pas un silo par espace : chaque parcours relie les acteurs, organisations, données et espaces impliqués. Les recettes R01–R09 et les tests SQL/browser déjà présents restent des sous-recettes capitalisables. Ils ne sont pas réexécutés en entier sans raison ; leurs liaisons nouvelles, extensions et dépendances modifiées le sont.

Chaque scénario essentiel est qualifié séparément sur :
- **Web** : navigateur desktop et mobile selon le parcours ;
- **PWA** : installation, lancement autonome, cache, mises à jour, push et hors ligne ;
- **Android natif** : APK depuis le site NAXA, authentification, permissions, stockage, services d'arrière-plan et synchronisation.

Une preuve Web ne vaut pas preuve PWA ou Android. Pour une fonction annoncée sur les trois versions, la sortie est **3/3 PASS**. Une fonction absente d'une plateforme n'est pas un N/A implicite : c'est un défaut de parité.

## 2. Univers et frontières métier inclus

| Univers / service | Parcours Client ou public | Espace professionnel à tester |
|---|---|---|
| Pharmacie | Catalogue, pharmacies, garde, favoris, réservation, ordonnance, achats et suivi | ERP Pharmacie, Promoteur, Responsable, Pharmacien, Stock, Magasinier, Caisse, Comptable, Livreur |
| Parapharmacie | Verrou Client R06 à contrôler ; pas d'ouverture implicite | ERP professionnel Parapharmacie, propriétaire/Promoteur, Responsable et collaborateurs affectés |
| Bébé & Maman | Univers bloqué selon R06 ; refus et zéro effet | Seulement les fonctions professionnelles explicitement autorisées |
| Examens médicaux | Catalogue centres/examens/packs, créneaux, rendez-vous, ticket et résultats publiés | ERP Centre d'examens et ses dix comptes professionnels |
| Soins à domicile | Catalogue, demande, adresse, GPS facultatif, rendez-vous, suivi | Titulaire indépendant, owner, manager, operator |
| Dispositifs connectés | Suivi privé, appareils, mesures, alertes et consentements | Professionnel explicitement habilité dans les limites du partage consenti |
| Services transverses | Profil, FAQ, notifications, messagerie, assistance | Administration NAXA, Agents Support, audit et supervision |

**Contradiction à lever dans B01 :** R06 affirme que le catalogue Client Parapharmacie et Bébé & Maman restent bloqués ; la route source /parapharmacie rend pourtant un composant UniverseCatalog. Le test doit prouver le verrou au niveau registre, middleware, Server Actions, API/RPC et RLS, et l'absence d'effets métier. L'ERP professionnel Parapharmacie est une qualification distincte : le tester ne déverrouille pas l'univers Client.

**Dispositifs connectés :** suivi privé, soumis à consentement ; ce n'est pas un catalogue commercial autonome.

**Examens :** les règlements sont directs auprès du centre ; NAXA ne collecte pas le prix de l'examen.

## 3. Comptes de test obligatoires

Les comptes doivent être distincts lorsque l'isolation ou la séparation des fonctions est testée. Il faut au moins deux Clients, deux établissements de chaque type retenu, deux Livreurs, deux Agents Support et plusieurs utilisateurs professionnels. Aucun compte générique ne peut représenter tous les rôles d'un centre.

### 3.1 Client et identité
- Visiteur majeur, visiteur refusant la déclaration, et profil mineur simulé pour tester le refus.
- Client A et Client B complets/actifs.
- Client incomplet, session expirée et profil global suspendu.
- Identité Client cumulant des espaces professionnels autorisés.

### 3.2 ERP Pharmacie
Comptes séparés : Promoteur/propriétaire du réseau, compte établissement Pharmacie, Responsable, Pharmacien, Gestionnaire de stock, Magasinier, Caissier/Caisse, Comptable et Livreur dédié.

Le Livreur dédié ne reçoit pas un autre poste professionnel actif. Une permanence d'urgence accordée à un membre existant doit respecter le type et la date de fin prévus.

### 3.3 ERP Parapharmacie
Comptes séparés : owner/propriétaire (résolu comme Promoteur dans le modèle courant), manager/Responsable, Caisse, Gestionnaire de stock, Magasinier, Pharmacien et Comptable, dans la limite des affectations permises.

L'écran Affectations Parapharmacie autorise actuellement le Promoteur à attribuer Caisse, Gestionnaire de stock, Magasinier, Pharmacien, Responsable et Comptable ; le Responsable est limité à Caisse. Le Livreur n'est pas dans la liste actuelle des rôles attribuables : le refus doit être prouvé, pas contourné.

### 3.4 ERP Centre d'examens — dix rôles explicites
Créer un compte distinct pour chacun des rôles déclarés dans src/lib/examens/access.ts :

1. Directeur — direction et gestion du centre.
2. Accueil — admissions et rendez-vous.
3. Caissier — opérations de caisse autorisées.
4. Comptable — comptabilité et approbations financières autorisées.
5. Technicien de laboratoire — préparation des résultats.
6. Biologiste — lecture, validation et publication des résultats biologiques.
7. Manipulateur d'imagerie — préparation des résultats d'imagerie.
8. Radiologue — lecture, validation et publication des résultats d'imagerie.
9. Responsable qualité — qualité, équipements et incidents dans son périmètre.
10. Responsable sécurité — sécurité, incidents et lecture du personnel autorisée.

Le Directeur est exclu de la liste des rôles proposés par le formulaire de personnel courant ; son provisionnement initial doit être testé séparément. Les neuf autres postes sont créés par ajout direct ou invitation acceptée. Une invitation en attente n'est pas une affectation active.

### 3.5 Soins à domicile, suivi, Admin et Support
- Soins : titulaire indépendant et memberships Partenaire owner, manager, operator, avec comptes séparés.
- Suivi connecté : Client propriétaire des mesures et professionnel autorisé par affectation/consentement réel, sans inventer un rôle professionnel non déclaré.
- Administration : Admin actif et compte non-admin pour les refus.
- Support : Agents A/B/C distincts, Client et Professionnel demandeurs. Un Agent Support n'hérite pas des privilèges Admin.

### 3.6 Multi-organisation
Prévoir au minimum deux pharmacies de Promoteurs distincts, deux partenaires Parapharmacie, deux centres d'examens, deux Clients, deux Livreurs et deux Agents. Les tests doivent prouver qu'aucun utilisateur ne lit, modifie, valide ou exporte les données d'une autre organisation sans partage explicite.

---

## 4. Les 17 recettes bulk transversales

### B00 — Identité unique, cycle de vie, session et changement d'espace

**Chaîne :** Visiteur → Client → propriétaire/Promoteur → collaborateurs → professionnel d'un partenaire/centre → Admin/Support.

**Parcours :**
1. Déclaration de majorité, inscription, confirmation et complétion du profil.
2. Ouverture d'un espace professionnel sur une identité existante sans dupliquer auth.uid().
3. Cumul Client + Pharmacie + Parapharmacie/Partenaire/Centre, uniquement selon les affectations autorisées.
4. Sélection/changement d'espace ; un seul contexte professionnel actif à la fois.
5. Invitation, acceptation, activation, expiration, changement de poste et révocation.
6. Profil global suspendu, partenaire suspendu, abonnement expiré et affectation révoquée : vérifier les effets séparément.
7. Déconnexion, session expirée, réauthentification, renouvellement et révocation serveur.
8. Refus des profils Auth dupliqués, de l'auto-approbation et des affectations non confirmées.

**Contradictions :** profil Client complet mais abonnement professionnel expiré ; partenaire suspendu avec identité active ; identité suspendue avec dossier validé ; même identité dans plusieurs organisations ; invitation d'un compte déjà affecté ; changement de rôle en session.

**Preuves :** UI, session Auth, rôle/espace actif côté serveur, affectations avant/après, RLS/RPC et audit sur les trois versions.

**Sous-recettes :** docs/IDENTITE_UNIQUE_CUMUL_ESPACES_SPEC_E2E.md et les cinq suites SQL de cumul du 16/11/2026. Le PASS SQL ne remplace pas l'E2E de changement d'espace UI Web/PWA/Android.

### B01 — Registre des univers, routes, droits et verrous métier

**Chaîne :** Visiteur/Client → sélecteur → portail public/Client → ERP propriétaire → Admin de contrôle.

**Parcours :**
1. Afficher les six écosystèmes Client et distinguer univers autonomes, connectés et services d'aide.
2. Pharmacie : catalogue public et parcours Client autorisés.
3. Examens : catalogue, centre actif et réservation.
4. Soins à domicile : catalogue et demande autorisés.
5. Dispositifs : suivi privé, pas de catalogue commercial autonome.
6. Parapharmacie et Bébé & Maman : verrou au menu, URL directe, API, Server Actions, RPC, RLS, panier et checkout.
7. Compte professionnel Parapharmacie : accès ERP autorisé sans ouverture de la boutique Client.
8. Modifier temporairement flags, état partenaire et session sur Replay ; vérifier le recalcul exact des accès.
9. Liens profonds, favoris, notifications, historique et routes secondaires pointant vers un univers bloqué.

**Critère :** un univers verrouillé est refusé côté serveur et ne crée aucune réservation, ligne, hold, sortie de stock, transaction, paiement ou notification de succès. Les autres univers restent fonctionnels.

**Sous-recettes :** RECETTE_06_UNIVERS_BLOQUES.md et RECETTE_09_CONTRADICTIONS_TRANSVERSALES.md. R06 est NON EXÉCUTÉE ; la contradiction route/registre doit être résolue par preuve Replay.

### B02 — Organisations, équipes, comptes métier et délégations

**Chaîne :** Promoteur/owner → Responsable/manager → personnel métier → Admin d'arbitrage lorsque la règle l'exige.

**Parcours :**
1. Pharmacie : comptes distincts Promoteur, Responsable, Pharmacien, Caisse, Gestionnaire stock, Magasinier, Comptable et Livreur.
2. Plafonds Responsable fixés par Promoteur, privilèges explicites, révocation et isolation pharmacie.
3. Promoteur propose l'accréditation Pharmacien ; activation uniquement après validation métier correcte.
4. Parapharmacie : owner/manager et comptes Caisse, Responsable, Comptable, Pharmacien, Gestionnaire stock, Magasinier ; refus de toute fonction non autorisée.
5. Centre : compte Directeur et neuf comptes de personnel ; tester ajout direct, invitation acceptée, expiration, destinataire incorrect, doublon et révocation.
6. Tester chaque capacité Centre : staff_manage, appointments_manage, results_draft, results_validate, results_publish, finance_approve, security_manage, quality_manage, etc.
7. Soins : owner/manager/operator et titulaire indépendant ; distinguer membership et accord indépendant.
8. Deux organisations : même utilisateur si le cumul est autorisé, révocation d'une seule source et recalcul sans supprimer les autres espaces.
9. Appels directs RPC/API : chaque rôle tente les actions des rôles voisins et reçoit le refus attendu.

**Critère :** l'autorisation est alignée entre UI, Server Actions, RPC et RLS. Aucune élévation via URL, payload ou rôle local.

**Sous-recettes :** tests Promoteur 024–039 et 140–157, tests 295–299, Parapharmacie 123/315 et contrat 20261111163814_exam_staff_invites_contract.sql. Présence d'un fichier ≠ exécution PASS.

### B03 — Client multi-univers : découverte, sélection, demande et historique

**Chaîne :** Client A → Pharmacie/Centre/Partenaire/Professionnel → Client → notification/historique.

**Parcours :**
1. Même identité Client dans Pharmacie, Examens, Soins et Dispositifs.
2. Recherche, filtres, comparaison, fiche, favori, retour et historique.
3. Cloisonnement des paniers, réservations, rendez-vous, demandes et historiques par univers.
4. Panier Marketplace multi-pharmacies : propriétaire réel de chaque ligne, stock réel, retrait/livraison et absence de données fictives.
5. Examens : centre, examen/pack, créneau et capacité.
6. Soins : prestation publiée, zone, adresse et date souhaitée.
7. Dispositifs : accès seulement après activation et consentement.
8. Refus Client Parapharmacie et Bébé & Maman tant que R06 reste en vigueur.
9. Comparer l'état Client à celui des professionnels sans fuite entre Clients.
10. Offres retirées, liens expirés, produits indisponibles et retour depuis un lien profond.

**Critère :** seul un état confirmé serveur est présenté comme confirmé ; aucune disponibilité, réservation ou offre n'est inventée.

**Sous-recettes :** RECETTE_01 à RECETTE_08. Le noyau B2 de R01 est réutilisable pour recherche, favoris, réservation simple, anti-survente, confirmation, annulation, restitution stock et historique. Extensions R01 et parcours R03–R08 restent à exécuter.

### B04 — ERP multi-établissements Pharmacie + Parapharmacie : catalogue, fournisseur, stock

**Chaîne :** Promoteur/owner → Responsable → Gestionnaire stock/Magasinier → Pharmacien → Client ou canal de publication autorisé → Comptable/Admin en contrôle.

**Branche Pharmacie :**
1. Créer/modifier une fiche et son stock propre ; la pharmacie reste responsable de son contenu, NAXA ne valide pas ses fiches à sa place.
2. Fournisseur, commande d'approvisionnement, réception, quantités, lots, dates et pièces.
3. Inventaire initial, mouvements, ajustements autorisés, transferts, journal et valorisation.
4. FEFO, lots bloqués/périmés, réservations, seuils et rappels.
5. Publication/retrait, fraîcheur du stock et visibilité Marketplace.
6. Vente POS interne d'une pharmacie non publiée : ne pas appliquer à tort les filtres de publication Marketplace.
7. Comparer lots, réservations, POS et disponibilité Client après chaque mutation.

**Branche Parapharmacie professionnelle :**
1. Owner/Promoteur ouvre son partenaire et définit les fonctions permises.
2. Responsable et collaborateurs agissent uniquement dans le partenaire actif.
3. Catalogue cosmétique/hygiène, image/Storage, brouillon, activation ou archivage suivant les contrôles métier.
4. Tester réellement fournisseur, réception, stock, lots, inventaire, caisse et comptabilité lorsqu'ils sont annoncés dans le périmètre ERP. Un écran descriptif ou une maquette de deux pages ne prouve pas un ERP opérationnel.
5. Refuser les médicaments dans le catalogue Parapharmacie selon le garde-fou 123 ; garder les produits non médicamenteux autorisés.
6. Aucun produit ou stock de Parapharmacie ne devient propriété Pharmacie ou Bébé & Maman par confusion d'espace.
7. Le verrou Client reste indépendant : pas de vente publique Parapharmacie tant que R06 n'est pas explicitement levée.

**Contradictions :** réception répétée, lot périmé, réservation pendant inventaire, ajustement sans privilège, Promoteur révoqué, partenaire suspendu, médicament en Parapharmacie, employé révoqué.

**Critère :** mutation atomique et auditable ; aucune lecture ou écriture inter-établissements.

**Sous-recettes :** tests 043, 046, 047, 053, 177, 184, 193–208, 210–221, 268–277, 307, 123 et 315. Les statuts sont repris depuis les runs réels, pas depuis le nom des fichiers.

### B05 — Ordonnance, Pharmacien, délivrance et confidentialité Client

**Chaîne :** Client → scanner/ordonnance → Pharmacien habilité → Gestionnaire stock/Magasinier → Caisse → Comptable → Client.

**Parcours :**
1. Scanner une ordonnance depuis caméra, galerie et PDF ; multi-pages, taille, rotation, OCR, résultat vide et correction manuelle.
2. Envoyer le document à la pharmacie destinataire ; vérifier URL signée, expiration, destinataire et note.
3. Pharmacien destinataire traite la demande ; Pharmacien d'une autre pharmacie est refusé.
4. Employeur, Promoteur et collaborateurs non habilités n'accèdent pas aux données médicales personnelles du Client.
5. Lier la dispensation au stock et aux lots réels ; quantité et journal cohérents.
6. Caisse encaisse selon les moyens autorisés et émet le ticket ; Comptable lit les pièces autorisées.
7. Client voit le statut réel, le reçu/historique et les messages autorisés.
8. Compte suspendu, dossier incomplet, fichier invalide, URL expirée, mauvais destinataire et double soumission.

**Critère :** tout accès et toute transition sont contrôlés côté serveur ; un résultat OCR ou cache n'est pas une validation pharmaceutique.

**Sous-recettes :** sections ordonnance/scanner de RECETTE_01, RECETTE_08 et test Pharmacien 061/297.

### B06 — ERP Centre d'examens : Client → dix comptes professionnels → résultat

**Chaîne :** Client → owner/manager partenaire → Directeur → Accueil → Technicien/Manipulateur → Biologiste/Radiologue → Qualité/Sécurité → Caissier/Comptable → Client.

**Parcours :**
1. Owner/manager crée ou rattache le centre ; Directeur configure fiche, services, packs, horaires, capacités, équipements et équipe.
2. Client découvre centre/examen/pack, choisit créneau et réserve.
3. Accueil confirme, reprogramme ou annule selon les transitions admises ; capacité réservée/libérée exactement une fois.
4. Technicien de laboratoire prépare un brouillon sans pouvoir valider ou publier.
5. Biologiste lit, valide, publie ou refuse le résultat biologique selon ses droits.
6. Manipulateur d'imagerie prépare ; Radiologue valide et publie le résultat d'imagerie.
7. Caissier réalise seulement les opérations financières autorisées ; Comptable dispose des approbations prévues, sans modifier le résultat clinique.
8. Responsable qualité traite les éléments qualité/équipement/incidents autorisés ; Responsable sécurité traite sécurité/incidents et lit le personnel selon sa capacité.
9. Directeur exerce les capacités d'organisation sans contourner les rôles spécialisés.
10. Client ne lit que les résultats publiés ; journal des lectures, fichiers privés, liens signés et expiration.
11. Client A tente d'accéder aux tickets, résultats, fichiers et conversations du Client B ; Centre A tente d'accéder au Centre B.
12. Règlement direct au centre ; aucune recette NAXA ni commission NAXA.

**Matrice de refus obligatoire :**
- Accueil ne valide/publie pas les résultats.
- Technicien et Manipulateur ne publient pas le résultat final.
- Biologiste et Radiologue ne se substituent pas l'un à l'autre hors capacité explicitement accordée.
- Caissier ne fait pas une approbation Comptable.
- Comptable ne modifie pas les résultats cliniques.
- Responsable qualité/sécurité n'accède pas aux données cliniques complètes sans capacité explicite.
- Un membre d'un autre centre ne lit ni ne modifie rendez-vous, équipements, résultats, fichiers ou messages.

**Critère :** dix comptes authentifiés et testés individuellement ; UI + Server Action/RPC + RLS + base ; brouillon invisible au Client.

**Sous-recettes :** RECETTE_03_EXAMENS_MEDICAUX.md ; tests 122, 20261102105033_admin_exam_centers_public_scope.sql, 20261102105542_admin_exam_catalog_active_read.sql, 20261111065609_exam_center_erp_foundation.sql, 20261111163814_exam_staff_invites_contract.sql et 269. Ces contrats ne remplacent pas l'E2E UI complet des dix comptes sur les trois plateformes.

### B07 — Soins à domicile : demande, affectation, intervention et clôture

**Chaîne :** Client → titulaire indépendant ou owner/manager Partenaire → operator → Client → Support si incident.

**Parcours :**
1. Publier/modifier offre, zone, tarif, disponibilité et statut.
2. Client recherche ; GPS autorisé/refusé/indisponible et adresse manuelle.
3. Client envoie demande avec date/heure/adresse ; seules les personnes nécessaires et autorisées voient les données.
4. Owner/manager traite ; operator agit dans ses droits.
5. Rendez-vous confirmé selon disponibilités réelles ; date passée, hors zone et date indisponible refusées.
6. Confirmation, intervention, annulation autorisée/interdite et historique.
7. Accord indépendant personnel du titulaire séparé du membership owner/manager/operator.
8. Retrait GPS/consentement et refus des accès futurs.
9. Paiement direct au prestataire ; aucun encaissement NAXA simulé.

**Sous-recettes :** RECETTE_04_SOINS_DOMICILE_PRESTATIONS.md, tests 113–117, 124 et 20261111160000_home_services_appointments_reminders_contract.sql. R04 est NON EXÉCUTÉE.

### B08 — Commande, préparation, livraison et preuve de remise

**Chaîne :** Client → Pharmacie/Promoteur → Gestionnaire stock → Livreur → Client → Caisse/Comptable.

**Parcours :**
1. Commande d'un ou plusieurs établissements ; chaque ligne garde son propriétaire.
2. Confirmation/refus Pharmacie et réservation réelle du stock.
3. Gestionnaire de stock prépare ; événement de préparation persistant.
4. Aucune proposition ni retrait Livreur avant les gardes serveur de préparation/paiement.
5. Mission transmise uniquement aux Livreurs autorisés dans le bon périmètre.
6. Livreur A accepte ; Livreur B ne peut pas accepter la même mission.
7. GPS, statut, retard, incident, chat et suivi Client.
8. Retrait refusé si préparation ou paiement requis non vérifiés.
9. Remise, preuve de réception, reçu, clôture et historique.
10. Annulation, expiration, suspension Livreur, perte de réseau et reprise.
11. Réaffectation explicite, urgence expirée, multi-pharmacies et isolation Promoteurs.
12. Caisse/Comptable reflètent une seule opération réellement faite.

**Critère :** une seule acceptation, un seul débit de stock et une seule clôture ; l'ordre préparation → mission → acceptation → remise est prouvé UI et base.

**Sous-recettes :** AUDIT_WORKFLOW_LIVREUR_NAXA.md, tests 309–312, 151400, 151600 et 151610. PASS SQL ciblés conservés ; comptes Auth, push, Android physique et pilote sont des preuves à part.

### B09 — Crédit, paiement, caisse, abonnement et comptabilité multi-structures

**Chaîne :** Client/Promoteur payeur → opérateur/banque → pharmacie/partenaire bénéficiaire → Admin de vérification → Caisse/Comptable.

**Parcours :**
1. Vente comptoir et Marketplace : moyen, montant, reçu, statut et éventuelle confirmation.
2. Caisse : session, encaissement, monnaie, ticket, annulation, clôture et écart.
3. Crédit Marketplace : demande, plafond, décision Promoteur, débit stock unique, échéance et historique.
4. Responsable approuve seulement avec privilège délégué et dans les plafonds/établissements autorisés.
5. Abonnement Promoteur payé hors NAXA : intention, référence déclarée, candidat SMS/notification, rapprochement, décision et reçu.
6. Distinguer valeur générée, déclaration utilisateur et paiement réellement reçu/vérifié. Un SMS seul n'est pas une confirmation.
7. Droits de capture Android : Client partage volontairement ; lecture SMS/notifications professionnelle uniquement Pharmacie/Partenaire/Admin, jamais Client.
8. Comptable Pharmacie : écritures, créances, rejets, rapprochement, exports et clôtures ; aucun accès hors périmètre.
9. Centre : caisse/comptabilité interne ; règlement direct au centre.
10. ERP Parapharmacie : modules financiers réellement livrés ; maquette non connectée = défaut.
11. NAXA ne prélève aucune commission et n'encaisse pas dans l'espace Client ; aucun solde local définitif ni doublon.

**Critère :** une opération par action logique, montants cohérents, état du paiement correctement qualifié et rapport par organisation.

**Sous-recettes :** RECETTE_02_CREDIT_MARKETPLACE.md, tests 247, 281/284, 295–299, 169, 20261104140000_credit_marketplace_approval_stock_debit.sql et scripts browser Credit/Accounting.

### B10 — Dispositifs connectés, mesures et partage consenti

**Chaîne :** Client propriétaire → Web/PWA/Android → professionnel explicitement autorisé → Client.

**Parcours :**
1. Feature activée/désactivée ; refus si non activée.
2. Ajout, appairage, déconnexion, retrait et reconnexion Bluetooth.
3. Mesures automatiques : unité, horodatage, doublon, valeur hors plage.
4. Saisie manuelle, correction et validation.
5. Historique, pagination, filtres, fuseau Africa/Douala et données absentes.
6. Alertes, seuils, rappels, programmations et permissions.
7. Partager uniquement les familles de données choisies avec un professionnel autorisé.
8. Révoquer le partage : accès et notifications futurs refusés, même via ancien lien ou session ouverte.
9. Promoteur, employeur, Responsable et autre professionnel non destinataire n'accèdent pas aux mesures.
10. Coupure BLE/réseau, fermeture forcée, redémarrage et synchronisation sans perte/doublon.

**Sous-recettes :** RECETTE_05_DISPOSITIFS_MEDICAUX_CONNECTES.md, tests 125–133 et 142, plus contrats de file BLE. R05 est NON EXÉCUTÉE au niveau recette Client complète.

### B11 — Messagerie, notifications et assistance multiespace

**Chaîne :** Client/Professionnel → destinataire métier (Pharmacie/Centre/Partenaire) → Agent Support → Admin.

**Parcours :**
1. Fil associé à réservation, examen, prestation, livraison ou ticket.
2. Envoi/réception, lecture, archivage, restauration et clôture ; isolation par Client, organisation et Agent.
3. Notifications in-app et push : création, destinataire, réception réelle, lien profond, jeton renouvelé, permission refusée, désinscription et doublon.
4. Distinguer outbox, acceptation fournisseur et réception sur appareil.
5. SMS/e-mail selon préférences ; pas de WhatsApp automatique, wa.me uniquement.
6. Audio : consentement, demande, affectation, acceptation, média bidirectionnel, reconnexion, expiration, raccrochage et audit.
7. Partage écran facultatif : consentement NAXA, permission OS, refus, deux partages successifs, arrêt manuel/système et clôture.
8. Aucun contrôle distant, enregistrement automatique ou média hors session.
9. Client et Professionnel testés séparément ; Agent Support limité aux dossiers et permissions affectés.
10. Web, PWA installée et Android natif ; capture Canvas synthétique ≠ sélecteur OS réel.

**Preuves :** Web Chromium Desktop run 44681037772 SUCCESS pour Client + Comptable ↔ Agent. Le code Android natif et son workflow ont été ajoutés au HEAD d050f598fe9731753af4d2f3f4ea9956724cea09 ; run 44692082796 observé EN COURS, donc aucun PASS Android enregistré. PWA installée et appareils physiques restent à qualifier.

### B12 — Hors ligne et synchronisation métier de tous les espaces

**Lot transversal obligatoire dans chaque parcours et sur les trois versions.**

Classer chaque action :
- **Consultation cache** : lecture datée et potentiellement ancienne.
- **Brouillon local** : conservé sans confirmation métier.
- **File différée** : identifiant idempotent, séquence, utilisateur et contexte ; le serveur revalide rôle, organisation, état et version.
- **En ligne obligatoire** : action bloquée sans serveur (approbation, publication/validation sensible, suspension, droit ou confirmation financière nécessitant vérification).

**Scénarios :**
1. Couper le réseau avant/pendant/après l'action ; réseau lent, perte et reconnexion.
2. Fermer de force navigateur, onglet, PWA et processus Android ; redémarrer.
3. File après expiration de session, déconnexion, changement de compte et suspension.
4. Client : brouillons panier/demandes, messages, notification et pièces ; aucun rendez-vous confirmé sans serveur.
5. Pharmacie/Parapharmacie : stock, réception, inventaire ; conflit appareil/serveur, aucune quantité inventée.
6. Caisse : vente offline autorisée, séquence appareil, prix, stock, idempotence, clôture et reprise.
7. Examens : brouillon résultat admissible ; pas de résultat publié ni de réservation confirmée fictive.
8. Livreur : position/événements différés ; acceptation/retrait/remise soumis aux gardes et à la revalidation serveur.
9. Dispositifs : mesures BLE persistées, file durable, unité, horodatage et reprise.
10. Support : appel/partage média indisponible sans connectivité requise ; messages différés uniquement si le contrat l'autorise.
11. Fichiers : téléversement interrompu, reprise si supportée, checksum, URL signée expirée et nettoyage.
12. Deux appareils modifient le même objet ; politique de conflit vérifiée.
13. Horloge décalée, événements désordonnés, doublons, rejeu, crash avant/après ACK.
14. Isolation des files/caches entre Client A/B, comptes professionnels et espaces.

**Implémentation à valider par plateforme :**
- Web : stockage navigateur, reprise après reload/fermeture et session.
- PWA : Service Worker, app-shell, stockage persistant, mise à jour et synchronisation différée.
- Android : stockage local chiffré, file durable par compte, Worker/service adapté, redémarrage et Bearer.

**Critère :** aucune perte silencieuse, double mutation ou contournement d'autorisation. État explicite : en attente, synchronisée, refusée, en conflit ou brouillon.

**Sous-recettes :** tests 220, 221, 268–277, 281, 283 et 284. Le test 284 est PASS Replay ciblé ; les autres fichiers ne sont pas déclarés exécutés ici sans run. Le README Android indique que l'offline métier et la synchronisation complète restent à couvrir : B12 est donc un écart de parité Android à fermer.

### B13 — Parité fonctionnelle Web / PWA / Android

1. Web desktop : interface large, clavier/souris, navigation, fichiers et permissions.
2. Web mobile : viewport mobile, tactile, caméra, GPS, fichiers et session.
3. PWA installée : installation, lancement autonome, icône, cache, mise à jour, notifications, liens profonds et offline.
4. Android APK : installation propre, mise à jour, stockage sécurisé, deep links et permissions.
5. Connexion de chaque profil professionnel ; vérifier que les dix rôles Centre, fonctions Pharmacie et ERP Parapharmacie sont réellement opérationnels, et non de simples pages descriptives.
6. Caméra, galerie, PDF, GPS, Bluetooth, push, audio et partage d'écran selon les fonctions annoncées.
7. Rotation, fermeture, permission refusée, économie batterie, redémarrage, changement de compte et d'appareil.
8. Android réel sur les modèles/versions cibles ; émulateur = étape automatisée, pas homologation physique.
9. APK Release signé, installation/mise à jour depuis le site NAXA, sans Play Store.

**Constat actuel :** android/README.md décrit une tranche native limitée (majorité, authentification, catalogue, scanner local, recherche pharmacies, historique Client et FCM). Le README précise que panier, commandes, livraison, fonctions ERP et offline métier ne sont pas encore couverts. NativeRoleRouting/NativeWorkspaceCatalog sont des fondations de routage/catalogue, pas des preuves de transactions. Le test NativeWorkspaceCatalog limite notamment le workspace Parapharmacie à deux pages et un statut d'attente d'activation. Toute fonction annoncée mais absente sur Android fait échouer B13.

### B14 — Sécurité, confidentialité, Storage et audit

**Chaîne :** Client A/B → collaborateurs de deux organisations → Admin → Agent Support.

1. Accès anonyme, Client, chaque rôle ERP, Admin actif/inactif et Agent Support.
2. RLS de toutes tables sensibles, RPC exposées, Server Actions et API.
3. Deux pharmacies, partenaires, centres et Clients : accès inter-tenant refusé.
4. Storage : ordonnances, résultats, photos, justificatifs, exports, URL signée, expiration et révocation.
5. Données Client/santé : aucun accès employeur/Promoteur par défaut ; partage explicite et révocation.
6. Suspension/révocation : session, cache, file offline, push token, lien profond et job de fond.
7. Audit append-only : acteur, motif, date et corrélation.
8. IDOR, identifiants forgés, pagination, export, mass assignment et concurrence.
9. Aucun secret service-role dans le Web public, PWA ou APK.
10. Sauvegarde et restauration Replay réellement exécutées, intégrité et procédure d'urgence.

**Critère :** zéro fuite P0/P1, mutation non autorisée ou secret privilégié exposé ; chaque décision sensible est explicable par l'audit.

### B15 — Administration 360°, exploitation et continuité

**Chaîne :** Client/Promoteur/Partenaire → Admin → Agent Support → responsable métier → retour utilisateur.

1. Admin : dossiers, abonnements, règlements, alertes, univers, réservations, examens, prestations, livraisons, rapports et journaux.
2. L'Admin ne valide pas les fiches produit/médicament à la place de la pharmacie.
3. Support : attribution, transfert, note interne, réponse publique, escalade et clôture.
4. Suspension, retrait de droits et désactivation propagent les gardes à tous les espaces et plateformes.
5. Rapports CSV/PDF, filtres et chiffres cohérents avec les données.
6. Incident : notification, qualification, responsable, résolution, reprise et traçabilité.
7. Migrations Replay ordonnées, schéma, fonctions/RLS et restauration.
8. Métriques Admin sans divulgation des contenus Client ou données de santé.

### B16 — Pilote terrain multi-établissements et décision finale

**Cohorte minimale :**
- Une pharmacie pilote : Promoteur, Responsable, Pharmacien, Gestionnaire stock, Caisse, Comptable et Livreur si livraison au lancement.
- Un ERP Parapharmacie professionnel : owner/Promoteur, Responsable et comptes des modules ouverts.
- Un centre d'examens avec les dix profils et un Client volontaire.
- Un prestataire à domicile avec owner/manager/operator et un Client.
- Clients A/B ; Admin et Agents Support.
- Web, PWA et appareils Android représentatifs.

**Déroulé :**
1. Geler un candidat précis, ses migrations et ses artefacts Web/PWA/APK.
2. Créer comptes/données pilotes autorisés ; vérifier identité, affectation et périmètre.
3. Exécuter commande Pharmacie jusqu'à livraison, ordonnance, rendez-vous et résultat d'examens, prestation à domicile, ERP Parapharmacie et mesures connectées si le module est annoncé.
4. Rejouer les parcours essentiels sur les trois versions.
5. Couper réseau, redémarrer, reprendre et rapprocher les données.
6. Tester assistance, incident, notifications et reprise.
7. Vérifier caisse, stock, paiements, pièces, journaux, exports et nettoyage.
8. Recueillir acceptation des représentants et consigner tous défauts/risques.

**Porte de sortie :** aucun P0/P1 ouvert ; aucune fuite ni incohérence stock/finance ; chaque parcours essentiel 3/3 ; offline PASS ; APK signé et installé depuis le site NAXA ; sauvegarde/restauration prouvée ; acceptation métier enregistrée.

---

## 5. Matrice de capitalisation des recettes déjà exécutées

| Sous-recette / preuve | Réutilisation permise | Reste à exécuter |
|---|---|---|
| R01 Pharmacie Client | Noyau B2 : recherche, favoris, réservation simple, anti-survente, confirmation, annulation, restitution stock, historique | Extensions ordonnance/scanner, multi-pharmacies, checkout, paiement déclaré, livraison et lien ERP ; extensions initialement NON EXÉCUTÉES |
| R02 Crédit | Preuves historiques ciblées conservées | UI des demandes, limites, notifications, décision, concurrence et remboursement ; extensions initialement NON EXÉCUTÉES |
| R03 Examens | Contrats structurels/RLS existants à rattacher à leurs runs | Client → centre → dix rôles → résultat publié → retour Client ; initialement NON EXÉCUTÉ |
| R04 Soins à domicile | Contrats SQL ciblés présents | Client → owner/manager/operator → intervention ; initialement NON EXÉCUTÉ |
| R05 Dispositifs connectés | Contrats de consentement/partage/BLE selon runs réels | Parcours complet et appareils réels ; initialement NON EXÉCUTÉ |
| R06 Univers bloqués | Décision métier de verrouillage conservée | Refus UI + serveur + RPC/RLS et zéro effet ; initialement NON EXÉCUTÉ |
| R07 Profil/compte | Code et tests ciblés à rattacher | Parcours complet trois plateformes ; initialement NON EXÉCUTÉ |
| R08 Messagerie/notifications | Tests ciblés à rattacher à leur run | Réception réelle et parcours complet par univers ; initialement NON EXÉCUTÉ |
| R09 Contradictions | Historique conservé ; ne pas recréer R09 | R09-01 validation dynamique, R09-02 à R09-08 et certaines validations Client/Admin encore explicitement non exécutées ; retester les gardes touchées |
| Identité/cumul | 5/5 suites SQL Replay du 16/11/2026 documentées PASS | UI et parité trois versions |
| POS hors ligne | Test 284 Replay PASS ; 295–299, 36 assertions PASS selon la recette pilote | UI authentifiée, PWA/Android métier et appareils physiques |
| Livraison | Contrats SQL ciblés 151400/151600/151610 PASS documentés ; tests 309–312 présents | Auth multi-comptes, réception notifications, appareils et pilote |
| Support Web | Run 44681037772 SUCCESS Client + Comptable sur Chromium Desktop | PWA installée, appareils physiques et sélecteur OS réel |
| Support Android | Code natif ajouté et workflow dans le dépôt | Run 44692082796 EN COURS au contrôle ; aucun PASS Android enregistré |
| Android ERP/offline | Routage et catalogue natifs présents | README Android indique ERP complet, commandes/livraison et offline métier non couverts |
| Parapharmacie ERP | Routes professionnelles Catalogue/Affectations et affectations rôle présentes côté Web | ERP complet, rôles, modules réels et parité Android ; ne pas confondre avec le verrou Client |
| Centre d'examens | Dix rôles, capacités, invitations, tables et contrats SQL présents | E2E UI des dix comptes, trois plateformes et confidentialité résultats |

### Règle de réutilisation d'une preuve
Une preuve ancienne n'est réutilisable que si elle couvre le même scénario/règle, si le commit et ses dépendances (code, RPC, migration, RLS) sont identifiés, si aucune modification ultérieure ne l'affecte, si le nettoyage est confirmé et si le niveau de preuve requis est présent. Sinon : RETEST CIBLÉ ou RÉGRESSION. Un fichier de test présent dans Git n'est jamais compté comme un run.

## 6. Contrat de preuve commun

Pour chaque scénario Bxx-XX : ID stable, lot, commit SHA, versions Web/PWA/APK, navigateur/OS/appareil, environnement Replay, comptes synthétiques et organisations, préconditions, espace/rôle actif, étapes, résultat UI, API/RPC, état DB avant/après, journal, isolation négative, concurrence, état offline/sync, captures/logs expurgés, nettoyage, verdict et lien du run.

Un test SQL seul n'est pas un E2E utilisateur. Playwright seul ne démontre pas l'intégrité DB. Build APK ≠ fonctions métier. Push créé ≠ push reçu. Émulateur ≠ appareil physique. Un PASS ancien ≠ validation du candidat final.

### Statuts
- RÉUTILISÉ — PREUVE VALIDE : sous-recette encore applicable.
- PASS WEB / PASS PWA / PASS ANDROID : preuve complète de cette version.
- RETEST CIBLÉ : liaison nouvelle ou dépendance modifiée.
- PARTIEL, NON EXÉCUTÉ, BLOQUÉ, FAIL : aucun n'est assimilé à PASS.

Un lot ferme seulement lorsque tous ses scénarios essentiels passent sur les versions annoncées, contrôles négatifs et nettoyage inclus. N/A exige une exclusion de lancement approuvée et documentée ; une fonctionnalité annoncée mais absente est un défaut.

## 7. Portes de sortie « NAXA prête pour Go Live »

1. B00–B16 clôturés et rattachés au même candidat applicatif.
2. Zéro P0/P1 sécurité, confidentialité, permission ou intégrité.
3. Tous les rôles de lancement testés avec comptes séparés.
4. Univers autorisés testés et univers verrouillés bloqués partout.
5. Parcours essentiels 3/3 Web, PWA, Android.
6. B12 offline/sync PASS, y compris fermeture, redémarrage et reprise.
7. Notifications réellement reçues ; Storage, audio, partage écran et capteurs testés dans les environnements annoncés.
8. Sauvegarde/restauration effectivement testées.
9. APK Release signé et installé/mis à jour depuis le site NAXA, sans Play Store.
10. Pilote représentatif et acceptation métier enregistrée.
11. Migrations/configuration du candidat identifiées, observabilité et rollback éprouvés.
12. Aucune fixture test publique, aucun faux PASS, aucune recette sur Production.

Les preuves CI, build, sécurité, pilote et compatibilité appareils doivent concerner le même candidat. Un ancien commit ne certifie pas le nouveau.

## 8. Ordre de démarrage et checkpoint

**Ordre :** B00 → B01 → B02 → B03 → B04 → B05 → B06 → B07 → B08 → B09 → B10 → B11 → B12 → B13 → B14 → B15 → B16.

Commencer avec les comptes Auth séparés et les fixtures multi-organisations Replay. B00/B01/B02 sont préalables. Ne pas ouvrir le lot suivant si une garde P0/P1 précédente échoue. B12 et B13 accompagnent chaque parcours, ils ne sont pas reportés à la fin.

**Premier checkpoint :**
1. Créer les comptes distincts Client A/B, Pharmacie, Parapharmacie, Centre, partenaire de soins, Admin et Agents Support.
2. Créer les organisations et affectations ; vérifier sessions, rôles actifs, invitations et permissions.
3. Exécuter B00/B01/B02 sur Web, PWA installée et APK.
4. Enregistrer preuves, défauts, rollback et nettoyage avant B03.

## 9. Environnement et sécurité
- Replay uniquement pour les tests automatisés ; aucune écriture Supabase Production.
- Données médicales et personnelles synthétiques ; données pilotes uniquement avec consentement et procédure autorisée.
- Aucun secret dans fichiers, rapports ou captures.
- Pas de Play Store.
- Pas de déploiement pendant la campagne sans ordre explicite.
- vercel.json contient deploymentEnabled.main=false ; aucune opération de déploiement n'est demandée par cette mise à jour documentaire.

**Verdict au 20/11/2026 :** conception transversale documentée ; B00–B16 non exécutés comme campagne globale ; NAXA non certifiée prête pour Go Live.


## 10. Journal d'exécution bulk — checkpoint SQL Replay du 20/11/2026

**Périmètre de cette passe :** contrôles SQL en lecture seule, Supabase Replay `pwfftcsjyeibxxqhwysw`. Aucun fixture, compte Auth, rôle, organisation, stock ou donnée métier n'a été créé/modifié. Les tests navigateur/PWA/APK ne sont pas couverts par ces requêtes.

| ID de preuve | Lot | Contrôle bulk | Résultat | Verdict |
|---|---|---|---|---|
| B00-SQL-IDENTITY-SNAPSHOT-01 | B00 | Auth ↔ profiles, activité, majorité, consentement, rôles de base | 11 Auth / 11 profils ; 11 emails confirmés ; 0 Auth sans profil ; 0 profil sans Auth ; 11 profils actifs, âge vérifié et consentants ; répartition 9 Client / 1 Promoteur / 1 Admin | PASS référentiel, limité |
| B00-SQL-ROLE-CONTEXT-02 | B00 | Rôles professionnels actifs et unicité du contexte | 10 lignes de rôle actif ; 0 profil avec plusieurs contextes actifs ; l'Admin ne figure pas dans cette table de contexte métier | PARTIEL — session Auth réelle et sélection/changement UI non testés |
| B01-SQL-UNIVERSE-FLAGS-01 | B01 | Cohérence feature_flags ↔ universes | Parapharmacie : feature flag false, registre true ; Bébé & Maman false/false ; Examens false/true ; Prestations false/true ; Suivi false/false | FAIL configuration incohérente pour Parapharmacie, Examens et Prestations |
| B01-SQL-PUBLIC-CATALOG-02 | B01 | Catalogue public et visibilité produit inconnu | Aucun résultat catalogue pour les univers interrogés sur le Replay vide ; UUID produit inconnu : `marketplace_produit_visible=false` | PARTIEL — absence de fixtures éligibles, ne prouve pas le verrou complet ni le parcours positif |
| B02-SQL-ORG-ASSIGNMENT-INTEGRITY-01 | B02 | Organisations, affectations actives, profils/établissements cibles | 1 partenaire actif ; 10 pharmacies actives (9 démo) ; 9 affectations professionnelles Pharmacie actives ; 1 adhésion partenaire ; 0 affectation professionnelle partenaire ; 0 centre d'examens ; 0 affectation/personnel Centre | BLOQUÉ — cohortes multi-organisations et Centre non provisionnées |
| B02-SQL-ASSIGNMENT-GUARDS-02 | B02 | Affectations vers profils/organisations inactifs, rôles actifs multiples, expiration | 0 affectation active vers profil ou organisation absent/inactif ; 0 contexte de rôle actif multiple ; 0 affectation active expirée ; 5 affectations actives concernent des pharmacies démo | PASS structurel limité ; confirmer le périmètre des fixtures démo |

### Décisions de campagne à conserver
- B00 n'est pas fermé : la cohérence Auth/Profile est PASS, mais le changement d'espace, les sessions expirées/révoquées et les tests Web/PWA/APK restent à prouver.
- B01 n'est pas fermé : ne pas modifier les flags par automatisme. La contradiction Parapharmacie doit rester verrouillée côté Client ; Examens et Prestations sont prévus au catalogue maître mais leurs feature flags sont désactivés. Vérifier la décision de lancement et le code de consommation des flags avant toute mutation de configuration.
- B02 ne peut pas passer au vert avec zéro centre d'examens, zéro affectation Centre et un seul partenaire. Les affectations sur pharmacies démo restent des fixtures Replay et ne valent pas une cohorte métier.
- Les lots B03 à B16 ne sont pas déclarés exécutés par cette passe. L'ordre officiel reste B00 → B01 → B02 → B03 … → B16.
- Ne pas réexécuter intégralement les sous-recettes R01–R09 déjà prouvées ; capitaliser seulement les scénarios dont le commit, les dépendances et le niveau de preuve sont toujours valides.

**Verdict au 20/11/2026 :** première passe de requêtes bulk B00/B01/B02 exécutée partiellement sur Replay ; B00 référentiel PASS limité ; B01 configuration FAIL/PARTIEL ; B02 BLOQUÉ par les fixtures et organisations manquantes ; campagne globale non terminée ; NAXA non certifiée Go Live.
