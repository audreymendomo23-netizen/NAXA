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

## 3. État technique de référence au gel de continuité

- Dépôt : `audreymendomo23-netizen/NAXA`
- Branche de reprise : `rewrite/naxa-from-main-20261007`
- SHA de l'état fonctionnel avant installation du système de continuité : `f644b4d42a48cda57cc1a7d9c6f26867852ac56e`
- SHA courant vérifié : `940aea76e2553378d56be49b451e2c41d1b11771`
- Base : `main`
- SHA main : `82d2145cea6d6d162405c3e74d3f21400ba5b763`
- Écart constaté : branche +46 / -0 par rapport à main au moment du gel.
- `main` : inchangé.
- Production : inchangée.

## 4. Dernier état métier validé

- Partie 1 : 🟢 100 %
- Partie 2 : 🟢 100 %
- Partie 3 : 🟢 100 %
- Partie 4 : 🟢 100 %
- Partie 5 : 🟡 non clôturée.
- Cause du jaune : CI GitHub bloquée avant l'exécution des steps ; les validations Supabase transactionnelles sont passées mais ne remplacent pas la preuve CI exigée.

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
- Le runner GitHub doit être réellement exécuté ; `steps=null` et `0 ms` ne constituent pas une preuve CI.
