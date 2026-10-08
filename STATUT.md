[object Object]

## ERP-008 — Socle assurances / tiers payant
- Audit sans doublon : aucun socle assurance détecté.
- Construction : assureurs, couvertures client, dossiers de prise en charge liés à la pharmacie et optionnellement à une vente.
- Les intégrations externes et règles de remboursement restent volontairement hors périmètre tant qu'aucun partenaire/scope n'est arbitré.
- Test structurel : `supabase/tests/049_assurances.sql`.
- Aucun changement Production.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**


## ERP-009 — Trésorerie / dépenses (F66)
- Audit sans doublon : aucun socle trésorerie/dépenses trouvé dans `main`.
- Construction : comptes de trésorerie XAF, catégories, dépenses en brouillon/validées/annulées et journal des mouvements.
- Sécurité : RLS + RPC ; aucune écriture directe authentifiée sur les dépenses/mouvements.
- Correction post-audit : clé composite `(id, pharmacie_id)` ajoutée pour sécuriser les références de compte par pharmacie.
- Validation d'une dépense génère un décaissement unique dans le journal.
- Aucun changement Production/Supabase live.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**


## ERP-010 — Fiche client / crédit (F68)
- Audit sans doublon : aucune fiche client commerciale/crédit existante dans `main`.
- Construction : fiche commerciale, plafond et solde de crédit, journal des opérations, demandes de dépassement et décision Promoteur/NAXA.
- Le crédit est raccordé au mode de paiement POS `credit`, sans second moteur de vente.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**

## ERP-011 — Rappel de lot (F64)
- Audit sans doublon : aucune implémentation concurrente de rappel de lot trouvée dans `main`.
- Construction : table `rappels_lots`, traçabilité du motif/référence/statut et RPC de rappel/levée.
- Le rappel actif bloque le lot canonique `stocks_lots`.
- RLS et exécution RPC limitées au périmètre pharmacie.
- Le POS n'étant pas encore lotisé, le blocage de vente au niveau d'un lot précis reste une dépendance du futur raccordement vente/FEFO.
- Migration : `supabase/migration_055_rappel_lot.sql`.
- Test structurel : `supabase/tests/052_rappel_lot.sql`.
- Aucun changement Production.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**


## ERP-012 — Offline ERP avancé — chantier du 08/10/2026
- Audit historique réconcilié : le offline stock existait déjà dans `main` via IndexedDB, file locale, détection réseau, synchronisation et résolution de conflits.
- Le manque identifié concernait l'idempotence côté serveur : un replay devait être rejouable sans risque de double mutation.
- Ajout : `supabase/migration_056_offline_idempotence.sql` + `supabase/tests/053_offline_idempotence.sql`.
- `src/app/pharmacie/page.tsx` utilise maintenant une clé d'opération UUID et la RPC `offline_stock_set_quantity()` pour les écritures online/offline.
- Aucun second moteur de stock ni second mécanisme offline créé.
- Aucun changement Production/Supabase live.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**


## ERP-003 — POS étape 1 — 08/10/2026
- Lignes de vente + allocation FEFO ajoutées au socle POS existant.
- État : 🟡 construit, preuve SQL/CI manquante.


## ERP-003 — POS étape 2 — 08/10/2026
- Paiements POS simples ou mixtes et finalisation atomique ajoutés au moteur de vente existant.
- Référence Mobile Money obligatoire ; paiement exact du total net requis.
- Aucun second moteur de vente créé.
- Aucun changement Production/Supabase live.
- **État : 🟡 construit — preuve SQL/CI manquante.**


## ERP-003 — POS étape 3 — ticket/reçu + numérotation unique — 08/10/2026
- Audit : aucun moteur concurrent de ticket POS/numéro de vente/réimpression trouvé ; le reçu de réservation existant reste inchangé.
- Construction additive : `ventes.numero_vente`, séquence unique, index unique et RPC `vente_ticket()` en lecture sécurisée.
- Les ventes historiques sont numérotées avant contrainte `NOT NULL` ; les nouvelles ventes reçoivent automatiquement un numéro.
- La RPC ticket est `SECURITY INVOKER` et s'appuie sur le scope existant des ventes/lignes.
- Aucun changement Production/Supabase live.
- **État : 🟡 construit — preuve SQL/CI manquante.**


## ERP-003 — POS étapes 4/5/6 — 08/10/2026
- Étape 4 : annulation contrôlée avec restitution stock/lot.
- Étape 5 : demande + décision séparées, décision Promoteur/NAXA et interdiction d'auto-approbation.
- Étape 6 : clôture Z avec fond initial, espèces, paiements mixtes, comptage et écart ; sessions historiques réouvrables grâce à l'index partiel des sessions ouvertes.
- Migrations/tests : `supabase/migration_060_pos_annulation_z.sql`, `supabase/tests/057_pos_annulation_z.sql`.
- Aucun changement Supabase live/Production.
- **État : 🟡 construit — preuve SQL/CI manquante.**


## ERP-003 — POS étapes 7/8/9 — 08/10/2026
- Paiements avancés : voucher, assurance/tier payant et crédit réconcilié avec le flux unique `vente_paiements`.
- Caisse rapide : favoris, paniers en attente/reprise et affichage client par session.
- Remises/promotions : bornes, période, plafond et approbation séparée.
- Migrations/tests : `supabase/migration_061_pos_avance_rapide_remises.sql`, `supabase/tests/058_pos_avance_rapide_remises.sql`.
- Aucun changement Supabase live/Production.
- **État : 🟡 construit — preuve SQL/CI manquante.**
