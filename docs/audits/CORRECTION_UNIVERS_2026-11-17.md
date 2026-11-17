# Correction du périmètre des univers — 17/11/2026

## Décision métier appliquée

Le sélecteur public présente strictement quatre univers : **Pharmacie**, **Parapharmacie**, **Examens médicaux** et **Prestations à domicile**. Bébé & Maman est un supplément rattaché à une pharmacie, pas un univers autonome. Les dispositifs connectés / suivi privé ne sont pas proposés comme univers autonome.

## Corrections versionnées sur `main`

- `src/lib/ecosystemes.ts` : retrait de Bébé & Maman et Dispositifs médicaux de la liste présentée par le sélecteur. Les identifiants historiques restent typés pour éviter une rupture immédiate des anciens appels internes ; ils ne sont plus proposés dans la liste des univers.
- `src/app/api/universes/status/route.ts` : exposition des seuls états configurables `parapharmacie`, `examens` et `prestations`, avec Pharmacie toujours active par défaut.
- `src/middleware.ts` : contrôle explicite de `universes.enabled = true` pour les URL des univers configurables. Les anciennes routes Bébé & Maman et suivi ne sont plus interprétées comme des univers activables indépendamment, mais restent dans les préfixes protégés par authentification. Le contrôle reste fail-closed en cas d'erreur.
- `src/components/IntroNaxa.tsx` : l'animation d'introduction ne capte plus les clics ; les liens de l'accueil restent accessibles pendant l'introduction.
- `src/components/EnTeteAccueil.tsx` : suppression d'une ancienne liste d'univers locale inutilisée et incohérente.

## Configuration Replay

Sur le projet Replay `pwfftcsjyeibxxqhwysw` uniquement, les lignes `parapharmacie`, `examens` et `prestations` de `public.universes` ont été mises à `enabled = true`.

Résultat retourné par l'UPDATE :
- `parapharmacie = true`
- `examens = true`
- `prestations = true`

Aucune ligne Production n'a été modifiée. Les entrées historiques Production `aide`, `bebe-maman` et `suivi` restent à traiter séparément après analyse de leurs dépendances ; elles n'ont pas été supprimées ni désactivées ici.

## Vérifications et limites

- Relecture GitHub des cinq fichiers modifiés après commit : effectuée.
- Vérification SQL de l'UPDATE Replay avec retour des trois lignes activées : effectuée.
- Vérification du build TypeScript/Next, lint et tests automatisés : **non exécutée dans cette passe** ; aucune preuve de build vert n'est revendiquée.
- Test navigateur du clic pendant l'introduction et test E2E des quatre accès : **à exécuter**.
- Aucun déploiement Vercel Preview ou Production déclenché. Aucun changement de configuration Vercel.
