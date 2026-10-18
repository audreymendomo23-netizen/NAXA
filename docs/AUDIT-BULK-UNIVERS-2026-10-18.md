# Audit groupé NAXA — six univers et réservations
Date : 18 octobre 2026  
Référence : branche `main`  
Portée : audit statique des routes et des fonctions SQL du périmètre univers ; aucune écriture Supabase Production.

## Résultats par domaine

| Domaine | Contrôle effectué | Résultat statique | Preuve manquante |
|---|---|---|---|
| Parapharmacie / Bébé & Maman | Garde-fou des produits, réservation, disponibilité, transitions de retrait | Contrôles présents sur le RPC : authentification, univers autorisé, partenaire/univers/feature flag actifs, quantités bornées, lignes produit verrouillées dans un ordre déterministe, stock réservé et mouvements au retrait | Rejouer les migrations et tests SQL sur un projet de test connecté ; test de parcours navigateur |
| Exclusions Bébé & Maman | Termes FR/EN et faux positif « lait de toilette bébé » | Migration 119 et test ciblé présents ; le garde-fou est limité à `bebe-maman` | Le succès historique du test 119 est une preuve ciblée, pas une validation de bout en bout de la version actuelle |
| Prestations à domicile | Authentification client, rôle, offre active, partenaire autorisé, adresse/téléphone privés | RPC de demande contrôlée ; reçus limités au client propriétaire ou à l’administration ; partenaire autorisé à lire les coordonnées seulement après confirmation/achèvement ; pas d’écriture directe sur les tables de demandes/adresses | Rejouer les migrations 112–120 et vérifier le parcours navigateur client/partenaire |
| Publication des prestations | Séparation partenaire/administration | Migration 113 limite la création partenaire aux brouillons et réserve la publication à la RPC administrative ; celle-ci vérifie l’état du partenaire, l’univers et le feature flag | Test de refus partenaire et test d’approbation admin sur environnement isolé |
| Notifications prestations | Création, transitions et marquage comme lu | Migration 114 n'inclut pas l'adresse exacte ni le téléphone dans les notifications ; migrations 115/117 séparent le marquage comme lu et les notifications de validation | Test d'intégration sur une base de test et vérification du badge dans le navigateur |
| Examens médicaux | Disponibilité UI et action de réservation | Les boutons sont désactivés si le centre n'a aucun créneau ouvert avec capacité restante ; l'action serveur vérifie l'identité, les UUID et l'exclusivité examen/pack, puis appelle `book_exam_appointment` | Contrôle SQL de la capacité concurrente et parcours navigateur non exécutés ici |
| Navigation et états UI | Menu partagé, routes, univers dispositifs | Les routes des univers sont explicites ; Dispositifs médicaux reste désactivé en phase 1 ; les messages d'erreur ne révèlent plus les numéros de migration | Build Next.js et test de navigation au clavier/mobile |

## Correction de cause racine ajoutée

L'audit des migrations 099 et 116 a révélé que deux fonctions `SECURITY DEFINER` de réservation multi-univers n'avaient pas été incluses dans le durcissement du `search_path` :

- `public.reserve_universe_products(uuid,text,jsonb,text)`
- `public.transition_universe_reservation(uuid,text)`

La migration additive 120 fixe leur `search_path` à `public, extensions, pg_temp`, avec `pg_temp` explicitement en dernier. Elle ne modifie pas les règles métier ni les objets du parcours Pharmacie.

- Migration : `supabase/migration_120_harden_universe_reservation_search_paths.sql`
- Test structurel : `supabase/tests/120_universe_reservation_search_path.sql`
- État : fichiers créés sur `main` ; test non exécuté dans cette session faute de connexion Supabase éligible.
- La migration 120 n'a pas été appliquée à Supabase Production.

## Vérification globale et limites

- L'inspection des fichiers et des fonctions SQL a été effectuée en parallèle sur le code de `main`.
- Le connecteur Supabase a refusé l'accès à la liste des projets avec `link_id must identify an eligible linked account`. Aucun projet n'a été modifié et aucune donnée n'a été écrite.
- Vercel renvoie une limite de build `upgradeToPro=build-rate-limit` ; la compilation complète et les parcours navigateur ne sont donc pas prouvés.
- CircleCI n'est pas utilisé comme gate, conformément à `AGENTS.md`.
- Aucun déploiement Production n'est revendiqué ; aucun déploiement Vercel Production récent n'a été retourné par la vérification effectuée.

## Statut final de l'audit

**Audit statique groupé : effectué.**  
**Correction SQL : écrite sur `main`, test préparé.**  
**Validation technique complète : en attente** de l'exécution du test 120 et du replay SQL sur un projet de test accessible, du build Next.js et des parcours navigateur. Ne pas marquer les univers comme validés en Production avant ces preuves.



## Complément — étape 2 : exclusion des médicaments de Parapharmacie

- Correctif client dans `src/components/universes/UniverseProductGrid.tsx` : les produits reconnus comme médicaments ne sont plus affichés dans le catalogue Parapharmacie ; les descriptions de produits médicamenteux de Bébé & Maman sont masquées et remplacées par un avertissement demandant conseil au pharmacien, sans posologie fournie par NAXA.
- Migration additive 123 `supabase/migration_123_parapharmacy_medicine_guard.sql` ajoute un contrôle de base de données sur les champs nom, marque, catégorie et description, limité à l’univers `parapharmacie`. Test ciblé : `supabase/tests/123_parapharmacy_medicine_guard.sql`.
- La règle ne modifie pas les données ni le parcours historique Pharmacie et ne bloque pas les produits médicamenteux Bébé & Maman par ce contrôle Parapharmacie.
- État honnête : code et migration écrits sur `main`; 18 cas regex côté outil réussis ; test SQL 123 non exécuté dans cette session, migration non appliquée à Production, build/parcours navigateur/déploiement non confirmés. Le filtre lexical n’identifie pas de manière exhaustive tous les noms commerciaux inconnus.

- Contrôle serveur avant réservation : `reserverProduit` et `reserverGroupeProduits` appellent maintenant le catalogue public et vérifient que chaque article appartient encore au partenaire et à l’univers demandés, et respecte les exclusions lexicales. Les règles sont partagées entre interface et actions serveur via `src/lib/universe-product-rules.ts`. Commit : `f5d9e300e1f05ff858523443dfc87cdb8442934d`.
