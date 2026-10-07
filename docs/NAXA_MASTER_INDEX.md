# NAXA — MASTER INDEX

> **Point d'entrée unique de continuité.**
>
> Le présent index ne contient pas les détails des anciens chantiers. Il désigne les sources canoniques afin d'éviter les équivalences concurrentes.

## 1. Hiérarchie des autorités

| Niveau | Référence | Autorité |
|---|---|---|
| 1 | `docs/CAHIER_DES_CHARGES.md` | Produit : ce que NAXA doit être |
| 2 | Prompt maître Fusion | Méthode : comment construire, auditer, corriger et valider |
| 3 | GitHub | Réalité technique effectivement présente |
| 4 | `docs/NAXA_REPRISE_EXACTE.md` | **Position opérationnelle unique** |
| 5 | `STATUT.md` | État synthétique |
| 6 | `README.md` | Documentation consolidée |
| 7 | Conversations | Historique, jamais source technique unique |

## 2. État technique courant

- dépôt : `audreymendomo23-netizen/NAXA`
- branche unique de continuation : `rewrite/naxa-from-main-20261007`
- SHA courant vérifié : `3b5e38f9f11ab184124abb4296f665d91e2c2619`
- SHA `main` : `82d2145cea6d6d162405c3e74d3f21400ba5b763`
- `main) : inchangé
- Production : inchangée
- Supabase Production : migration `042_stats_pilotage_facade_security`, inchangée
- Parties 1 à 6 : 🟢 100 %
- Pilotage 360° Parties 1 à 4 : 🟢 100 %
- Réconciliation v3.7 : 🟢 clôturée
- **Chantier courant : Qualité — EN COURS / non vert**

## 3. Parcours déjà traité — une seule ligne par jalon

1. Reconstruction du socle → 🟢
2. Partie 2 — DB canonique → 🟢
3. Partie 3 — convention/réseau/abonnement Promoteur → 🟢
4. Partie 4 — privilèges/délégation → 🟢
5. Partie 5 — scope réseau/Pilotage Promoteur → 🟢
6. Partie 6 — réconciliation finale Promoteur → 🟢
7. Pilotage 360° Partie 1 → 🟢
8. Pilotage 360° Partie 2 — Performance → 🟢
9. Pilotage 360° Partie 3 — Sécurité/Réseau → 🟢
10. Pilotage 360° Partie 4 — Direction 360° → 🟢
11. Réconciliation documentaire v3.7 → 🟢
12. **Qualité → 🟡 en cours**

Pour les preuves et détails, consulter `docs/NAXA_CHECKPOINTS.md`, pas recopier ces jalons dans le checkpoint courant.

## 4. Contrat de continuité

Toute nouvelle conversation doit :

1. rester sur la branche de continuation existante ;
2. lire `docs/NAXA_REPRISE_EXACTE.md` ;
3. vérifier le SHA réel de cette branche ;
4. vérifier `main` et Production ;
5. reprendre uniquement au `exact_resume_point` ;
6. ne jamais recréer une partie déjà clôturée ;
7. lorsqu'un bloc devient 🟢 et est validé, remplacer son état opérationnel par le bloc suivant.

**Une conversation n'est pas une branche. Un ancien checkpoint n'est pas un nouveau chantier.**

## 5. Sécurité

- aucun merge `main` sans autorisation explicite ;
- aucun déploiement/mutation Production sans autorisation explicite ;
- aucun service payant ;
- aucun 🟢 sans preuve ;
- aucune nouvelle branche sans nécessité technique démontrée et documentée.

## 6. Sources de détail

- position actuelle : `docs/NAXA_REPRISE_EXACTE.md`
- historique des checkpoints : `docs/NAXA_CHECKPOINTS.md`
- traçabilité : `docs/TRACABILITE.md`
- protocole : `docs/CONTINUITE_NAXA.md`
- cahier canonique : `docs/CAHIER_DES_CHARGES.md`
