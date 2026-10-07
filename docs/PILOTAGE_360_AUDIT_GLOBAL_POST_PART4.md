# NAXA — Audit métier/global post-Direction 360°

Date : 07/10/2026
Branche : `rewrite/naxa-from-main-20261007`

## Objet

Contrôler, après validation de la Partie 4 Direction 360°, la cohérence globale entre :
- cahier V3.7 / prompt maître ;
- migrations et tests présents sur la branche ;
- état réel Supabase Production ;
- documentation de continuité.

## Constats

### C1 — Documentation de reprise divergente
Le checkpoint affiché en tête de `docs/NAXA_REPRISE_EXACTE.md` restait CP-0004 / Partie 2, alors que CP-0006 clôture la Partie 4 Direction 360°.

**Cause racine :** les mises à jour successives ont ajouté les nouveaux checkpoints sans remplacer l'en-tête de reprise courant.

### C2 — STATUT et README contenaient encore des anciens « prochains chantiers » présentés comme courants
Les historiques sont utiles, mais plusieurs formulations n'étaient plus alignées sur CP-0006.

**Cause racine :** documentation appendée sans réconciliation du bloc d'état courant.

### C3 — Contradiction métier dans Direction 360°
Le compteur `responsables_actifs` utilisait `role='pharmacie'`. Or le modèle canonique établit Responsable comme **fonction interne**, et `public.naxa_business_function()` résout `fonction_interne='responsable'` avant le legacy `role_type`.

**Impact :** le cockpit pouvait sous-compter les Responsables en données réelles.

**Correction :** compter `fonction_interne='responsable'` et ajouter un test contradictoire dédié.

### C4 — Production et branche restent volontairement séparées
Supabase Production est toujours à la migration 042. Les migrations 043→052 ne sont pas persistées. C'est conforme à la règle de sécurité du projet ; la Partie 4 est donc une implémentation validée sur branche par replay transactionnel, pas une fonctionnalité déclarée déployée en Production.

### C5 — État métier Production actuel
Production contient 3 pharmacies, 2 profils, 0 lien Promoteur→pharmacie et 0 privilège effectif au moment de l'audit. Cela confirme que la configuration réseau réelle n'est pas encore une preuve de mise en service terrain ; aucune donnée fictive ne doit être injectée pour « verdir » cet état.

### C6 — Alertes Supabase hors périmètre
L'advisor sécurité signale Leaked Password Protection désactivée. L'advisor performance signale 24 index inutilisés. Ces points restent des chantiers distincts : aucune suppression d'index ni modification d'Auth n'est incluse dans cet audit métier/global.

## Résultat de l'audit

Après correction de C3 et réconciliation documentaire, aucun conflit bloquant ne subsiste dans le périmètre de l'audit métier/global post-Direction 360°.

**Statut cible : 🟢 100 %**, sous réserve de la preuve transactionnelle de la correction C3 et de la relecture finale des documents mis à jour.

## Prochaine position

Après clôture de cet audit, reprendre uniquement le chantier canonique suivant indiqué par le cahier/prompt maître. Aucun merge `main`, aucune persistance Production et aucun service payant.
