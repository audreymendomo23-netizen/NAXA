# Étape 6 — Suivi connecté en cohorte de test (19 octobre 2026)

## Décisions de sécurité
- L’univers commercial `suivi` demeure désactivé et ses quatre déclencheurs de phase 1 restent en place.
- L’expérimentation utilise un indicateur séparé `suivi_connecte` et la liste explicite `feature_flag_test_accounts`. Aucun compte n’est autorisé automatiquement.
- Un compte non autorisé voit uniquement « Bientôt disponible »; la route appelle le contrôle d’autorisation avant de rendre le client du suivi.
- Les mesures sont privées via RLS. L’écriture requiert un consentement actif par famille de données; les partages sont limités à un type et à un professionnel vérifié. La révocation est prévue.
- Les images de mesures ne sont pas téléversées. L’OCR est tenté localement si l’API de navigateur existe; sinon la saisie manuelle est proposée. Le Bluetooth implémenté lit les capteurs de fréquence cardiaque compatibles avec le service Heart Rate.
- Le carnet peut être imprimé / enregistré en PDF via le dialogue d’impression du navigateur. Les rappels sont enregistrés, mais ne garantissent pas à eux seuls une notification push.
- Message d’urgence affiché : « Ce n’est pas un service d’urgence, appelez le 119 » (la disponibilité locale doit être vérifiée par l’utilisateur).

## Schéma SQL
Migration additive 126 :
- profils de suivi;
- consentements par six familles;
- 20 types de mesure;
- rappels;
- registre des professionnels vérifiés;
- partages granulaires par type;
- fonctions de contrôle d’autorisation/consentement et RLS sur toutes les tables.

## Fichiers
- `supabase/migration_126_suivi_connecte_test_allowlist.sql`
- `supabase/tests/126_suivi_connecte_test_allowlist.sql`
- `src/app/suivi/page.tsx`
- `src/components/suivi/SuiviConnecte.tsx`
- `src/app/suivi/professionnel/page.tsx`

## Limites à ne pas masquer
- Le projet Production avait zéro compte dans `feature_flag_test_accounts` lors de la préparation; par défaut, aucun utilisateur ne peut ouvrir le suivi connecté. Un administrateur doit autoriser explicitement des UUID de test.
- Les professionnels ne peuvent consulter que les mesures partagées et doivent être créés/vérifiés dans `suivi_professionals`; aucun professionnel n’est préautorisé.
- L’OCR dépend de `TextDetector`, API expérimentale/non universelle; il ne faut pas le présenter comme disponible sur tous les appareils.
- Le Bluetooth est implémenté pour capteurs compatibles fréquence cardiaque seulement, pas pour tous les appareils médicaux.
- Les rappels sont enregistrés en base; la livraison de notifications système/push n’est pas implémentée ici.
- Aucun diagnostic, seuil clinique ou recommandation de posologie n’est calculé.
- Compilation Next.js et test navigateur ne sont pas réputés exécutés tant qu’un runner accessible ne les a pas réellement lancés.


## Correctifs de contradiction ajoutés
- Migration 127 : le destinataire professionnel vérifié peut lire ses partages actifs; l’administration peut ajouter/révoquer les professionnels via `/admin/univers`.
- Migration 128 : retirer le consentement d’une famille révoque automatiquement tous les partages actifs des types appartenant à cette famille. Le propriétaire peut aussi révoquer un partage même si le professionnel a depuis été désactivé.
- Test 127 réussi sur Production : `naxa_127_suivi_sharing_policies_pass = true`. Test 128 réussi sur Production : `naxa_128_consent_revocation_shares_pass = true`.

- Migration 129 `supabase/migration_129_suivi_user_alert_rules.sql` : alertes personnelles fondées uniquement sur les limites choisies par l’utilisateur, sans seuil médical prérempli; alertes et règles protégées par RLS. Test 129 réussi sur Production et projet isolé : `naxa_129_user_defined_alerts_pass = true`.

- Migration 130 durcit le contrôle d’autorisation pour empêcher l’énumération des UUID autorisés; la fonction ne confirme l’accès que pour le compte courant ou l’administration. Test Production : `naxa_130_allowlist_oracle_hardened_pass = true`.
- Migration 131 exige un consentement actif pour créer ou réactiver un partage, et interdit aux clients de fabriquer/supprimer arbitrairement des alertes. Test 131 réussi sur Production et projet isolé : `naxa_131_consent_share_integrity_pass = true`.
