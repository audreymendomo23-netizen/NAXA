# Réconciliation de la feuille de route canonique — NAXA
Date : 19 octobre 2026  
Référence : dépôt `audreymendomo23-netizen/NAXA`, branche `main`

## Règle de lecture

Le cahier canonique est **« NAXA — Cahier des charges des 6 univers »**. La numérotation de travail a dérivé : le suivi connecté a été appelé « étape 6 » dans un dossier technique, alors que le plan canonique le place à l’étape 3. Le Bluetooth est le sujet de l’étape 6. Le verrouillage de l’univers commercial « Dispositifs médicaux » (migration 125) est une mesure de sécurité transversale, pas une étape fonctionnelle supplémentaire.

Le document technique de suivi connecté a été renommé pour signaler ce décalage, sans supprimer son historique ni réécrire les résultats de tests.

## Ordre canonique et état réel

| Étape canonique | Périmètre | État sur `main` | Ce qui manque pour la considérer validée |
|---|---|---|---|
| **1** | Socle des univers, partenaires, thèmes, pages et espace admin | Les routes et écrans d’administration existent ; les six univers sont représentés. | Vérification complète du build et des parcours réels, notamment mobile et droits admin. Ne pas confondre présence du code et validation de bout en bout. |
| **2** | Panneaux partenaires Parapharmacie puis Bébé & Maman | Catalogues, import/export, réservations et garde-fous sont présents. | Replay SQL intégral de la version actuelle, tests de parcours partenaire/client et build. Certains tests et migrations de ce périmètre ont historiquement été vérifiés seulement sur un projet isolé. |
| **3** | Suivi connecté manuel/photo, en cohorte de test | Tables, RLS, consentements, saisies, historique, rappels, alertes personnelles et partage à un professionnel vérifié sont implémentés. Migrations 126–131 et tests de sécurité documentés comme réussis. | Build Next.js et E2E navigateur restent non exécutés. La liste de comptes de test Production était vide : aucun compte ordinaire n’a accès à cette expérimentation. OCR dépend d’une API expérimentale et les rappels ne garantissent pas de push. |
| **4** | Examens médicaux puis Prestations à domicile | Réservation d’examens, demandes de prestation, notifications et protections de confidentialité sont présentes. Des tests ciblés existent, dont 124 sur projet isolé. | Replay complet de toutes les migrations nécessaires et validation des parcours navigateur. La migration 122 n’était pas appliquée en Production selon le dernier audit ; la migration 124 a été validée sur le projet isolé, pas en Production. |
| **5** | « Besoin d’aide ? » — phase 1 | Chat écrit gratuit client–pharmacie ajouté sur `/aide`, boîte de réception pharmacie sur `/pharmacie/aide`, migration 132 appliquée sur test et Production ; test structurel SQL réussi sur les deux. | Build Next.js et E2E navigateur non exécutés. La disponibilité réelle dépend d’une pharmacie connectée. Pas de liste d’hôpitaux ouverts sans source fiable. Aucun déploiement Vercel lancé manuellement. |
| **6** | Bluetooth — essai sur appareil compatible | Une lecture Bluetooth de fréquence cardiaque compatible est présente dans le composant du suivi connecté. | **Validation Bluetooth incomplète.** Aucun essai physique confirmé sur Chrome Android. Il reste à vérifier le bouton « Synchroniser », l’unique écran de confirmation, la conservation de la source de la mesure et le comportement quand le navigateur ou l’appareil n’est pas compatible. |

## Garde-fous transversaux à conserver

- L’univers commercial `suivi` reste désactivé en phase 1 : migration 125 et ses déclencheurs bloquent l’activation, les associations partenaires actives et la publication de produits.
- Le suivi connecté est une expérimentation distincte, protégée par une liste explicite de comptes de test. Ne pas activer automatiquement les utilisateurs ordinaires.
- Aucun diagnostic, seuil clinique prérempli ou recommandation de posologie ne doit être ajouté.
- Préserver intégralement les parcours historiques Pharmacie et les règles de réservation/retrait.
- Aucun déploiement Vercel n’est revendiqué par cette réconciliation. Build complet et E2E navigateur ne sont pas déclarés réussis.

## Décision opérationnelle

L’étape canonique 5 est implémentée et ses contrôles SQL passent sur test et Production ; elle reste à valider par build et parcours navigateur. La prochaine étape fonctionnelle est **l’étape canonique 6 — Bluetooth**, en se concentrant sur l’essai Chrome Android et les critères de synchronisation, sans refaire le suivi connecté déjà codé.

Cette feuille de route corrige la numérotation ; elle ne prétend pas que les étapes 1 à 4 ont toutes passé une validation de bout en bout.
