# Preuve d’architecture — Compte Caissière NAXA ERP

- Date de contrôle : 20 octobre 2026
- Branche de référence : `main`
- Référence fonctionnelle unique : `docs/CAHIER_DES_CHARGES_CAISSE_CAISSIERE.md`
- Objet : prouver la couverture statique de l’architecture des parcours et séparer clairement les écrans de démonstration du parcours opérationnel existant.
- Limite de ce contrôle : audit du code source récupéré depuis GitHub. Aucun build, lint, test automatisé, test navigateur ou test de base de données n’a été exécuté pendant ce contrôle. Ce document ne prétend pas prouver ces résultats.

## 1. Sources examinées

| Élément | Fichier sur `main` | Rôle et constat |
|---|---|---|
| Cahier des charges caissière | `docs/CAHIER_DES_CHARGES_CAISSE_CAISSIERE.md` | Référence fonctionnelle et visuelle autonome, §§ 0–13, annexes techniques et prompt d’exécution. |
| Tableau de bord opérationnel | `src/app/pharmacie/caisse/page.tsx` | Route métier existante ; contient des appels Auth, des lectures Supabase et des RPC de caisse/vente/ticket. |
| Sections opérationnelles | `src/app/pharmacie/caisse/[section]/page.tsx` | Parcours connectés des clients, assurances, historique, annulations, rapports, notifications, profil et service. |
| Navigation opérationnelle | `src/components/pharmacie/CaisseSidebar.tsx` | Six liens principaux et une action distincte Déconnexion, soit les sept entrées du § 5.2. |
| Calculs purs de caisse | `src/lib/caisse/calculs.ts` | Module existant pour montants entiers FCFA, total de ligne, total panier, monnaie à rendre et écart de caisse. Présence vérifiée dans le code ; exécution des tests non revendiquée. |
| Tests des calculs caisse | `scripts/test-caisse-calculs.cjs` et script `test:caisse-calculs` de `package.json` | Script existant contenant 15 assertions. Les résultats d'exécution ne sont pas disponibles dans ce contrôle ; le statut est « présent, non exécuté », pas « vert ». |
| Onglets contextuels | `src/components/pharmacie/CaisseSectionTabs.tsx` | Navigation secondaire des sections opérationnelles. |
| Prototype de parcours | `src/app/pharmacie/caisse/parcours-ui/page.tsx` | Prototype navigable séparé, sans opérations métier ni connexions externes. |
| Maquette visuelle | `src/app/pharmacie/caisse/maquette-visuelle/page.tsx` | Maquette de présentation ; ne constitue pas une preuve de comportement métier. |

## 2. Contrôle de couverture statique du prototype

Contrôles effectués sur le contenu de `src/app/pharmacie/caisse/parcours-ui/page.tsx` récupéré depuis `main` :

| Contrôle reproductible | Résultat |
|---|---:|
| Identifiants dans l’union TypeScript `Screen` | 45 |
| Titres dans `titles: Record<Screen, string>` | 45 |
| Identifiants disposant d’une condition de rendu `screen === ...` | 45/45 |
| Identifiants sans titre | 0 |
| Identifiants sans condition de rendu détectée | 0 |
| Cibles des appels `go("...")` inconnues du type `Screen` | 0 |
| Gestionnaires `onClick` présents dans le prototype | 173 |
| Références Supabase / Auth / RPC / `fetch` / stockage local dans ce fichier | 0 détectée |

Ces résultats prouvent une cohérence statique entre les 45 identifiants, leurs titres, leurs conditions de rendu et les cibles de navigation locales. Ils ne prouvent ni compilation, ni accessibilité réelle, ni réussite de parcours en navigateur, ni fonctionnement métier.

### Inventaire des 45 écrans du prototype

`dashboard`, `clients`, `assurances`, `historique`, `ticket`, `annulation`, `service`, `ouverture`, `cloture`, `rapports`, `profil`, `securite`, `notifications`, `demandes`, `vente`, `favoris`, `paniers`, `ordonnances`, `reservations`, `stock`, `catalogue`, `lots`, `import`, `sortie`, `registre`, `offline`, `paiement`, `remise`, `assurance-vente`, `reception`, `commande`, `aide`, `verrouillage`, `deconnexion`, `garde`, `coffre`, `ordonnance-offline`, `pin`, `creances`, `alertes`, `fournisseurs`, `inventaire-refus`, `connexion`, `premiere-connexion`, `mot-de-passe-oublie`.

Les écrans Assurance et Vente assurée sont couverts par une condition de rendu combinée. La clôture dispose d’un rendu dédié. Aucune lacune de rendu n’a été détectée dans cet inventaire statique.

## 2 bis. Audit des clics et gestionnaires React

Contrôle statique du fichier `src/app/pharmacie/caisse/parcours-ui/page.tsx` (blob SHA `6c37e2e5c76fb4999a54d519f51e57b029477628`) :

| Contrôle | Résultat |
|---|---:|
| Éléments JSX `<Action>` | 159 |
| Éléments JSX natifs `<button>` | 14 |
| Total de contrôles cliquables recensés | 173 |
| Contrôles `<Action>` sans prop `onClick` | 0 |
| Boutons natifs sans `onClick` | 0 |
| Cibles littérales `go("…")` hors du type `Screen` | 0 détectée |
| Contrôles de navigation via `go(...)` | 92 gestionnaires, avec cibles parfois dérivées de listes typées |
| Actions de démonstration via `demoAction(...)` | 77 gestionnaires |
| Gestionnaires de changement d’état local (langue/recherche) | 2 |
| Contrôle de fermeture de dialogue | 1 |

**Interprétation :** les 173 éléments cliquables ont un gestionnaire attaché ; aucun bouton ou composant `Action` sans `onClick` n’a été détecté. Le chiffre 173 désigne les contrôles cliquables, pas 173 opérations métier. Les gestionnaires `demoAction` ouvrent un dialogue qui explique que l’opération n’est pas connectée : ils sont liés au clic, mais ne réalisent pas l’action métier demandée. Ils ne doivent donc pas être comptés comme fonctionnalités opérationnelles. Les 2 gestionnaires locaux modifient un état d’interface ; le bouton de fermeture est branché sur `closeDialog`.

Le contrôle porte sur les boutons et composants cliquables de ce prototype uniquement. Il ne certifie pas les interactions clavier dans le navigateur, la compilation, ni les fonctions des routes métier connectées.

## 3. Barre latérale — exigence § 5.2

Les sept entrées du prototype et leur correspondance avec le cahier sont :

1. Tableau de bord — `dashboard`
2. Clients et Assurances — `clients`
3. Historique des ventes — `historique`
4. Prise / fin de service — `service`
5. Rapports & Performances — `rapports`
6. Profil — `profil`
7. Déconnexion — `deconnexion`

Dans la navigation opérationnelle, les six premières sont des liens de la liste de navigation ; Déconnexion est un bouton séparé en bas de la barre latérale. Le comptage est donc bien de sept entrées, sans prétendre que Déconnexion est un lien de navigation.

## 4. Parcours opérationnel existant — périmètre observé

Les fichiers opérationnels ne sont pas des maquettes isolées. La route principale utilise notamment les tables `ventes`, `vente_lignes`, `caisses_sessions`, `profiles`, `pharmacies`, `caisses` et `vente_paiements`, ainsi que des RPC telles que `caisse_ouvrir`, `vente_creer`, `caisse_rechercher_produit`, `caisse_rechercher_codes`, `vente_ajouter_produit`, `vente_encaisser_finaliser`, `vente_ticket` et `caisse_cloturer`.

La route à section charge des données depuis Supabase pour les sections `clients`, `assurances`, `historique`, `annulations`, `rapports`, `notifications`, `profil` et `service`, et utilise des RPC pour consulter un ticket, demander une annulation, rembourser un crédit et marquer une notification lue.

Ce constat est une preuve de présence de connexions dans le code source, pas une preuve que chaque RPC est déployée, autorisée, sûre ou testée en base. Les contrats SQL, RLS, contraintes et résultats des RPC doivent être vérifiés séparément avant de déclarer un parcours métier validé.

## 5. Matrice d’architecture contre le cahier caissière

| Exigence de référence | Emplacement à examiner | Statut de preuve actuel |
|---|---|---|
| § 5.2 — sept entrées | `CaisseSidebar.tsx` et `parcours-ui/page.tsx` | Couverture statique confirmée ; détail du bouton Déconnexion documenté ci-dessus. |
| §§ 5.3–5.5 — KPI, vente et réservation QR | Route opérationnelle + prototype | Écrans/zone de parcours repérés ; données et opérations réelles non validées par ce contrôle. |
| §§ 6.1, 6.2, 6.4, 6.9 — ouverture, vente, paiements, clôture | `caisse/page.tsx`, écrans prototype correspondants | Appels métier présents dans le code ; tests bout-en-bout non exécutés. |
| §§ 6.3, 6.6, 6.10–6.12 — assurance, crédit, historique, rapports, profil | `[section]/page.tsx` et prototype | Sections et connexions partielles observées ; couverture fonctionnelle complète non prouvée. |
| § 6.13 — verrouillage temporisé et sortie avec file hors ligne vide | Prototype + `CaisseSidebar.tsx` | État visuel représenté ; le composant de déconnexion vérifié ne contrôle que `navigator.onLine`, pas une file IndexedDB en attente. Exigence non prouvée. |
| § 7 — file hors ligne idempotente et synchronisation | Fichiers de logique hors ligne/API à auditer séparément | Non prouvé par ce contrôle. |
| §§ 8–9 — notifications, RLS, journal d’audit, sécurité | API, migrations, policies et tests SQL à auditer séparément | Non prouvé par ce contrôle. |
| § 10 — tests, concurrence, RLS, immutabilité et responsive | Tests automatisés, Supabase et navigateur | Non exécutés ici. |
| § 12 — rapport honnête des livrables | Ce document et les audits complémentaires | La séparation « prouvé / non prouvé » est explicite ; les livrables métier restent à vérifier. |

## 6. Contradictions et limites qui restent ouvertes

0. **Tests existants ≠ tests réussis.** `scripts/test-caisse-calculs.cjs` existe et contient 15 assertions appelant `src/lib/caisse/calculs.ts`; `package.json` expose `npm run test:caisse-calculs`. Aucune exécution n'a été réalisée lors de ce contrôle. Les assertions visibles couvrent les montants entiers, total de ligne/panier, monnaie, écart, format FCFA et erreurs, mais pas toute la formule d'assurance, les paiements mixtes, le crédit ou les transactions serveur.
1. **Prototype ≠ application opérationnelle.** Les 173 gestionnaires d’événements sont des interactions locales ; ils ne prouvent pas une opération métier. Le fichier affiche explicitement qu’il est non connecté.
2. **La présence d’une RPC ≠ son intégrité.** Il faut examiner le SQL réellement présent sur `main`, les permissions, les transactions, l’idempotence, les contraintes, les triggers et les policies RLS.
3. **Déconnexion et mode hors ligne.** La barre latérale opérationnelle bloque la déconnexion si le navigateur est hors ligne, mais le code examiné ne vérifie pas l’existence d’une file de ventes en attente. Cela ne satisfait pas à lui seul le § 6.13.
4. **Sécurité et périmètre de pharmacie.** Les filtres présents côté application ne remplacent pas les tests RLS d’accès inter-pharmacies et par rôle.
5. **Critères non testés.** Aucun résultat de build, lint, tests unitaires, tests SQL, navigation réelle, responsive 360/768/1280 px, impression thermique, scanner caméra, ni synchronisation hors ligne n’est revendiqué.

## 7. Définition de « preuve complète »

L’architecture de navigation et de rendu du prototype est **statiquement couverte à 45/45 écrans**. L’architecture générale des routes opérationnelles est repérée et documentée. Cela ne suffit pas à déclarer le compte caisse complet au sens du cahier des charges.

Pour établir une preuve complète de livraison, les preuves restantes sont : (1) build TypeScript/lint réussis ; (2) tests unitaires des calculs FCFA ; (3) tests SQL/RLS et RPC sur une base de test ; (4) tests de parcours de bout en bout avec données de test identifiées comme telles ; (5) vérification de la file hors ligne, idempotence et conflits ; (6) revue clavier/accessibilité et viewport mobile/tablette/desktop ; (7) vérification de l’impression/duplicata et des réservations ; (8) rapport de résultats avec logs et SHA du commit testé.

## 8. Périmètre d’intervention

Cette preuve est limitée à l’architecture et à la documentation du compte Caissière. Elle n’ajoute aucune connexion métier, ne modifie pas les règles de vente, ne change pas la base de données et ne constitue pas une autorisation de déploiement.

## 9. Empreintes des sources examinées

Empreintes de contenu (blob SHA) relevées sur `main` pendant le contrôle du 20/10/2026 :

| Source | Blob SHA |
|---|---|
| `docs/CAHIER_DES_CHARGES_CAISSE_CAISSIERE.md` | `1f2fc17e25d163d13a8a903576a888cfece024df` |
| `src/app/pharmacie/caisse/page.tsx` | `6caadf05ec514025ccd2e6a6d484f9ed1d0519b3` |
| `src/app/pharmacie/caisse/[section]/page.tsx` | `f9b424854311f5b91badf3e981287ba8d32d551f` |
| `src/components/pharmacie/CaisseSidebar.tsx` | `70497aad7905bc4a113ff44e1c152dc022298d15` |
| `src/components/pharmacie/CaisseSectionTabs.tsx` | `e8d857fdb3fdfca23ce14c2ee0efc4c8e6089a71` |
| `src/lib/caisse/calculs.ts` | `ce3e38732814de74f4d129e692b027195369942f` |
| `scripts/test-caisse-calculs.cjs` | `1315fb5f1a9baf51768a8f06b5c381e8f26dc33b` |
| `src/app/pharmacie/caisse/parcours-ui/page.tsx` | `6c37e2e5c76fb4999a54d519f51e57b029477628` |
| `src/app/pharmacie/caisse/maquette-visuelle/page.tsx` | `1bdfc0e24b0849af668e6b3b9bc7d4f695391e04` |

Ces SHA permettent de savoir exactement quelles versions de fichier ont été lues lors du contrôle. Ils ne remplacent pas le SHA du commit qui sera testé par les outils de build/recette.
