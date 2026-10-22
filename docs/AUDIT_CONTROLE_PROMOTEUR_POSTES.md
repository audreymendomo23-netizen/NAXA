# Audit — contrôle Promoteur transversal des postes

Date de l'audit : 22 octobre 2026  
Périmètre : branche `main`, sources applicatives et migrations existantes.  
But : consolider des indicateurs de supervision sans remplacer les postes métier, sans contourner les autorisations, et sans exposer de données patient nominatives.

## 1. Règles de consolidation

- Le périmètre d'un Promoteur est issu de `promoteur_pharmacies` et limité aux liens actifs et pharmacies opérationnelles. Les pharmacies de démonstration sont exclues par le moteur canonique de pilotage.
- Le chiffre d'affaires est lu via `stats_pilotage_scope`, dont la règle canonique s'appuie sur `v_reservations_ca` : une réservation qualifiante a le statut `payee` ou `retiree`. Ne pas sommer les ventes caisse et les réservations Marketplace séparément.
- Le coût courant de `stocks_couts` ne constitue pas un coût historique de vente. Aucun indicateur de marge/rentabilité n'est calculé tant que le coût au moment de la vente n'est pas figé.
- Les contrôles transversaux affichent des agrégats uniquement. Ordonnances, observations de consultation, identité et données de santé restent dans le poste Pharmacien, soumis à ses autorisations et à sa traçabilité.
- Une source en erreur doit apparaître « Indisponible », jamais comme un zéro métier.
- Les seuils d'alerte doivent provenir des règles du poste ou de paramètres de pharmacie. Le seuil existant « quantité ≤ 5 » est une alerte opérationnelle du Gestionnaire de stock, pas une règle réglementaire.

## 2. Audit par poste

| Poste | Sources déjà présentes | Indicateurs que le Promoteur peut superviser | Limites / suite nécessaire |
|---|---|---|---|
| Caissier / Caisses | `profiles`, `caisses`, `caisses_sessions`, `stats_caisse_scope`, réservations | Comptes actifs/bloqués, opérations et paiements agrégés, clôtures et écarts à vérifier | Le détail transactionnel reste dans les écrans autorisés. L'historique des écarts chargé par le dashboard est plafonné aux 20 dernières lignes : ne pas le présenter comme un total exhaustif. |
| Responsable | `profiles.fonction_interne`, accréditations, périmètre pharmacie, pilotage canonique | Nombre de Responsables actifs, supervision réseau des Caisses, réservations, stocks et alertes déjà agrégés | Vérifier que toute action d'équipe reste limitée aux Caisses directes ou privilèges délégués; le Promoteur ne doit pas hériter d'une permission simplement parce qu'un compte est rattaché. |
| Pharmacien | `prescriptions`, `prescription_preparations`, `consultations_pharmaceutiques`, journal d'audit Pharmacien | Nombre de pharmaciens actifs, ordonnances client en attente, préparations soumises ou nécessitant un complément | Le Promoteur ne reçoit aucun dossier, nom de patient, motif clinique, posologie ou contenu d'ordonnance. Les consultations sensibles restent journalisées côté Pharmacien. |
| Gestionnaire de stock / Magasinier | `stocks`, `stocks_lots`, `inventaires`, `inventaire_ajustements`, réservations et journal des mouvements | Nombre de comptes actifs, références à stock bas (règle actuelle ≤ 5), lots bloqués/sans date/à moins de 30 jours, réservations à traiter | La liste détaillée des lots, emplacements, ajustements et mouvements demeure dans le poste Stock. Les décomptes transversaux ne remplacent pas le détail de l'inventaire. |
| Marketplace / réservations | `reservations`, `v_reservations_ca`, événements canoniques | Réservations en attente/confirmées, conversion agrégée si la fonction canonique fournit toutes les composantes | Ne pas additionner `recherche_events` à `evenements` pour les KPI; ne pas compter une réservation payée puis retirée deux fois dans le CA. |
| Comptabilité (contrôle adjacent) | `ventes`, `depenses`, `tresorerie_mouvements`, `compta_ecriture`, contrôles de clôture et audit | Renvoi vers les états comptables autorisés et statut agrégé des contrôles, selon les permissions prévues | Ne pas produire une marge, une balance complète ou un bilan réglementaire sans sources/mappings validés. Le Promoteur ne doit pas pouvoir modifier les écritures depuis le panneau de contrôle. |

## 3. Implémentation réalisée sur le tableau Promoteur

- Ajout d'un bloc « Contrôle opérationnel par poste » avec cartes Responsables, Caisses, Pharmaciens, Gestionnaires de stock/Magasiniers, réservations Marketplace, lots et préparations.
- Les cartes sont liées aux modules existants plutôt que de dupliquer leurs formulaires d'action.
- Les agrégats de postes sont limités aux pharmacies opérationnelles rattachées au Promoteur.
- Le chargement transversal ne demande aucun contenu nominatif de consultation ou d'ordonnance.
- Les métriques CA, ruptures et alertes affichent « Indisponible » si la fonction de pilotage échoue, au lieu de masquer l'erreur par un zéro.
- La gestion des Caisses n'affiche plus dans son composant de sécurité les comptes rattachés à des pharmacies inactives ou hors du sous-ensemble opérationnel.

## 4. Contradictions identifiées à surveiller

1. **Réseau vs hiérarchie de comptes** : l'ancien chargement des Caisses par `parent_profile_id = Promoteur` omettait les Caisses rattachées à un Responsable. La vue Promoteur doit agréger par pharmacies autorisées, tout en gardant les actions de gestion d'équipe soumises aux privilèges et à la hiérarchie.
2. **Zéro vs indisponible** : le dashboard ne doit pas afficher `0 FCFA`, zéro rupture ou zéro alerte si le RPC échoue.
3. **Périmètre service-role** : tout accès de lecture via `supabaseAdmin` doit être précédé d'une authentification et strictement filtré sur les identifiants du réseau du Promoteur; aucune requête globale sur les patients ou ordonnances.
4. **Préparations Pharmacien** : le statut de préparation est distinct du statut pharmaceutique de l'ordonnance. Les préparations ouvertes utilisent les statuts de schéma `soumise` et `complement_requis`; `revue` est terminal pour ce suivi.
5. **Marge** : le coût courant du stock ne permet pas de reconstituer la marge d'une vente passée.

## 5. Vérifications restantes

- Exécuter TypeScript, lint, build et tests SQL ciblés sur le commit exact lorsque les moyens d'exécution sont disponibles.
- Vérifier sur une base de test que les tables et politiques RLS de chaque environnement correspondent aux migrations installées.
- Ajouter un contrôle SQL automatisé qui prouve qu'un Promoteur A ne voit aucun KPI ni compte du réseau B.
- Compléter l'analyse de performance par pharmacie et par période avec une fonction serveur canonique dédiée, si le RPC actuel ne fournit pas le grain requis. Ne pas faire ces agrégations dans le navigateur.
- Ne pas déployer sans instruction explicite de l'utilisateur.

## Mise à jour d'implémentation sur main — 22 octobre 2026

Les éléments ci-dessous sont codés dans `src/app/pharmacie/promoteur/page.tsx` :

- Les sessions Caisse, Pharmacien et Gestionnaire de stock sont regroupées en lecture seule, bornées aux pharmacies actives, publiées et liées au Promoteur ; les erreurs de sources sont signalées.
- Les clôtures de caisse récentes affichent les soldes théorique/compté et les écarts, y compris les clôtures avec écart nul. L'historique affiché est limité aux 30 dernières clôtures présentes parmi les 50 sessions les plus récentes chargées ; il ne constitue donc pas un historique exhaustif.
- Les indicateurs comptables agrégés couvrent les périodes ouvertes, les événements à traiter/en erreur et les écritures des 30 derniers jours. Une erreur de source produit « Indisponible », pas un zéro.
- Une comparaison par pharmacie affiche le CA et le nombre de ventes qualifiées des 30 derniers jours depuis `v_reservations_ca`, les caisses actives, les services ouverts et la période comptable la plus récente.
- Le CA suit la règle canonique `v_reservations_ca` : statuts qualifiants `payee` et `retiree`, sans double comptage de la même réservation. Les marges historiques restent masquées tant que le coût au moment de la vente n'est pas figé.
- La palette visuelle est codée dans le bandeau de l'espace Promoteur avec les proportions demandées : vert 40 %, jaune canari 25 %, blanc 15 %, orange canari 10 %, bleu canari 5 %, rouge 5 %.

### Limites de preuve

Ces modifications sont enregistrées directement sur `main`. Elles n'ont pas été déployées. Le contrôle structurel existant `supabase/tests/148_promoteur_pilotage_scope_guard.sql` vérifie la garde du périmètre réseau de la RPC de pilotage ; aucun nouveau test SQL d'isolation n'a été exécuté pendant cette modification. La compilation TypeScript, le lint et les tests d'intégration restent à exécuter séparément avant de qualifier la révision de validée.
