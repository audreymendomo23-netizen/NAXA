# Rapport d’étape 2 — Moteur comptable TypeScript

Date : 21 octobre 2026  
Branche : `main`  
Source normative unique : `docs/CAHIER_DES_CHARGES_COMPTE_COMPTABLE.md` — SHA `99700259f7da546fd68e01256a724a9395da1182`.  
Statut : **MOTEUR PUR INTÉGRÉ — TESTS ÉCRITS ET ENREGISTRÉS — EXÉCUTION LOCALE NON CONFIRMÉE**.

## 1. Audit avant intégration

- La stack du dépôt utilise TypeScript strict, Next.js 14 et n’a pas Vitest déclaré dans `package.json`.
- Les tests de logique existants utilisent des scripts Node `.cjs` avec le compilateur TypeScript déjà installé comme dépendance ; la suite Comptable suit ce patron sans ajouter de dépendance.
- Aucun `lib/compta/*` préexistant n’a été trouvé dans l’arborescence inspectée ; les nouveaux modules sont sous `src/lib/compta/`, conforme à l’alias TypeScript `@/* -> ./src/*`.
- Le moteur reste pur : pas de client Supabase, pas d’accès réseau, pas d’écriture en base et pas de données de démonstration injectées dans l’application.
- Aucun compte ou classement comptable n’est déduit de préfixes, numéros de comptes ou taux codés en dur.

## 2. Fichiers ajoutés ou modifiés

- `src/lib/compta/types.ts` — contrats TypeScript pour écritures, lignes, comptes, balance, créances, indicateurs et mappings.
- `src/lib/compta/calculs.ts` — montants FCFA exacts avec `bigint`, contrôle de partie double, balance, regroupement par sections de rapports explicitement validées, ancienneté des créances et indicateurs conditionnels.
- `src/lib/compta/moteur.ts` — résolution de mappings d’événements et renvoi « à traiter » en cas d’absence, de chevauchement ou de paramètre non validé.
- `src/lib/compta/index.ts` — exports publics du moteur.
- `scripts/test-compta-moteur.cjs` — tests de logique suivant le patron des scripts de tests existants.
- `package.json` — commande `test:compta-moteur`.
- `docs/compta/RAPPORT_ETAPE_2.md` — ce rapport.

Aucun écran, module de vente, caisse, stock ou trésorerie existant n’a été modifié.

## 3. Calculs et garde-fous

### Montants et écritures
- Les montants peuvent être traités depuis des entiers ou des chaînes entières exactes ; `bigint` évite la perte de précision JavaScript pour les montants stockés en PostgreSQL `bigint`.
- Refus des montants négatifs, décimaux, non entiers ou mal formés.
- Une écriture doit avoir au moins deux lignes, des lignes débit/crédit mutuellement exclusives, et des totaux débit/crédit égaux.
- La balance agrège les débits et crédits par compte et refuse un compte absent ou non validé.

### États financiers
- Les comptes sont regroupés seulement à partir d’une `sectionEtats` explicitement renseignée et d’un ensemble de sections validées fourni par l’appelant.
- Un compte sans section validée est classé « À classer » ; aucun classement SYSCOHADA n’est inventé.
- Les créances sont classées par date d’échéance : non échues, 1–30, 31–60, 61–90 et plus de 90 jours. Les créances réglées sont exclues ; les échéances manquantes sur un solde dû et les règlements supérieurs au montant initial déclenchent une erreur.
- Marge brute, taux de marge, rotation de stock et délai moyen d’encaissement ne sont calculés que si les données sources requises sont présentes. Sinon, la valeur est `null`, pas zéro.
- Le moteur de mapping requiert un mapping unique et validé pour les deux sens et un compte validé ; tout manque ou chevauchement aboutit à `a_traiter` avec motifs explicites.

## 4. Tests ajoutés

Le script couvre :
- entiers FCFA exacts et rejet des montants invalides ;
- équilibre et déséquilibre d’écritures ;
- rejet d’un compte absent ;
- total débit/crédit de balance ;
- regroupement des sections validées ;
- ancienneté et exclusion des créances soldées ;
- anomalies de dates/montants de créances ;
- marge, taux, rotation et délai calculés lorsque les données sont présentes ;
- absence de résultat chiffré lorsque les données nécessaires manquent ;
- mapping valide, mapping absent et paramètre non validé.

Commande enregistrée : `npm run test:compta-moteur`.

**Exécution : NON EXÉCUTÉE.** Le runtime de travail n’a pas pu cloner le dépôt car l’accès réseau à GitHub n’était pas disponible. Je ne déclare donc ni ce script ni le typecheck/build comme verts. Aucun CI n’a été consulté ou lancé.

## 5. Design convenu et limites

Le moteur est volontairement indépendant de l’interface. Les futurs écrans conserveront le design NAXA convenu : mobile-first, Inter, vert forêt et jaune canari, cartes arrondies, accessibilité AA, sidebar desktop 240 px, topbar 64 px et navigation mobile adaptée. Les états vides, erreurs, chargement, accès refusé et paramètres à valider doivent rester explicites.

Cette étape ne constitue pas une validation par un expert-comptable des sections SYSCOHADA, du plan de comptes, de la fiscalité camerounaise ni des ratios métier. Ces référentiels restent à renseigner/valider ; aucune règle réglementaire n’est supposée par le moteur.

## 6. Suite proposée

Étape 3 : construire le traitement de l’outbox comptable et le branchement progressif des événements métier à partir des schémas et transitions réellement existants. Chaque événement doit rester idempotent ; toute absence de mapping ou paramètre requis doit rester « à traiter ». Avant d’activer un flux métier, ajouter les tests SQL d’intégration correspondants.
