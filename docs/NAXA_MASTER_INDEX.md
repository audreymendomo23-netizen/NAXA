# NAXA — MASTER INDEX

> Document canonique de continuité. Toute nouvelle session NAXA doit commencer ici.

## 1. Hiérarchie des autorités

| Niveau | Référence | Autorité |
|---|---|---|
| 1 | Cahier des charges V3.7 | Produit : ce que NAXA doit être |
| 2 | Prompt maître Fusion | Méthode : comment construire, auditer, corriger et valider |
| 3 | GitHub | Réalité technique effectivement présente |
| 4 | NAXA_REPRISE_EXACTE.md | Position exacte de reprise |
| 5 | STATUT.md | État opérationnel synthétique |
| 6 | README.md | Documentation consolidée |
| 7 | Conversations | Historique et contexte, jamais source technique unique |

## 2. Références maîtres

### Cahier des charges
- Version : V3.7
- Date connue : 06/10/2026
- Autorité : PRODUIT
- Règle : aucune implémentation ne peut contredire le cahier sans décision explicite de réconciliation.

### Prompt maître Fusion
- Nom canonique : Prompt maître Fusion
- Autorité : MÉTHODOLOGIE
- Règle : il impose le protocole de travail : audit → contradiction → cause racine → correction → tests/preuves → documentation → VERT → validation utilisateur.

> Le contenu intégral de ces deux références n'est pas dupliqué ici. Ce fichier les désigne comme autorités ; leurs copies/emplacements exacts doivent être référencés lorsqu'ils sont présents dans le dépôt.

## 3. État technique de référence actuel

- Dépôt : `audreymendomo23-netizen/NAXA`
- Branche de reprise : `rewrite/naxa-from-main-20261007`
- SHA courant vérifié : `935026a21dfdadff10b0d44e1bc0aa83da0459a6`
- Base : `main`
- SHA main : `82d2145cea6d6d162405c3e74d3f21400ba5b763`
- `main` : inchangé.
- Production : inchangée.
- Partie 5 : clôturée au vert avec preuve fonctionnelle Supabase + preuve CI CircleCI.

## 4. Dernier état métier validé

- Partie 1 : 🟢 100 %
- Partie 2 : 🟢 100 %
- Partie 3 : 🟢 100 %
- Partie 4 : 🟢 100 %
- Partie 5 : 🟢 100 %
- Cause racine corrigée : contradiction du scope `RESEAU` dans l'attribution des privilèges.
- Preuve fonctionnelle : validation Supabase transactionnelle PASS + ROLLBACK.
- Preuve CI : CircleCI pipeline #3 / workflow `part5_gate` / job `part5_check` = **Success**.
- SHA de clôture : `935026a21dfdadff10b0d44e1bc0aa83da0459a6`.

## 5. Règle de reprise

Une nouvelle session ne crée PAS de nouvelle branche par défaut.

Elle doit :
1. lire ce fichier ;
2. lire `docs/NAXA_REPRISE_EXACTE.md` ;
3. lire `STATUT.md` et `README.md` ;
4. vérifier la branche et le SHA GitHub réels ;
5. comparer la réalité GitHub au checkpoint ;
6. si cohérent, reprendre à `exact_resume_point` ;
7. si divergent, suspendre toute modification et auditer la divergence.

## 6. Règles de sécurité

- Aucun merge vers `main` sans autorisation explicite.
- Aucun déploiement Production sans autorisation explicite.
- Aucun service payant.
- Aucune nouvelle branche sans nécessité technique démontrée et signalée.
- Aucun 🟢 sans preuve.
- Pour la Partie 5, la preuve CI de clôture est désormais fournie par CircleCI : workflow `part5_gate` = Success.


## 7. Clôture Partie 6

- Partie 6 : 🟢 **VERT — 100 %**.
- Contradiction racine corrigée : le moteur de privilèges ne peut plus considérer le Promoteur valide via l'ancien abonnement par pharmacie lorsque l'abonnement Promoteur canonique est expiré.
- Correction : `supabase/migration_048_reconciliation_finale_promoteur.sql`.
- Test : `supabase/tests/048_reconciliation_finale_promoteur.sql`.
- Preuve fonctionnelle : replay Supabase transactionnel PASS + ROLLBACK.
- Preuve CI : CircleCI pipeline #13 / workflow `part6_gate` / job `part6_check` = **Success** sur `4d8fb7c43ebc8642e644e96aeec4f37969c93a82`.
- Sécurité : exécution client retirée des deux fonctions mutantes de synchronisation.
- `main` et Production restent inchangés.

### État de référence
- Branche : `rewrite/naxa-from-main-20261007`
- SHA de clôture Partie 6 : `4d8fb7c43ebc8642e644e96aeec4f37969c93a82`
- Parties 1 à 6 : 🟢 100 %
- Aucun merge `main`.
- Aucun déploiement Production.


## 8. Pilotage 360° — Partie 1

- Partie 1 : 🟢 **VERT — 100 %**.
- Audit canonique : `docs/PILOTAGE_360_AUDIT_PARTIE1.md`.
- Contrôles C1→C6 : PASS.
- Prochaine partie : socle Performance.
- Aucun changement Production ; aucun merge `main`.


## 9. Pilotage 360° — Partie 3

- Partie 3 : 🟢 VERT — 100 %.
- Migration : supabase/migration_050_security_network_hardening.sql.
- Test contradictoire : supabase/tests/050_security_network_hardening.sql.
- Preuve fonctionnelle : replay Supabase réel PASS + ROLLBACK.
- Contradictions corrigées : compatibilité moteur naxa_has_privilege, expiration Promoteur des descendants, bootstrap RESEAU hors réseau, catalogue historique/canonique.
- main et Production restent inchangés.
- Prochaine étape après validation : Partie 4.
