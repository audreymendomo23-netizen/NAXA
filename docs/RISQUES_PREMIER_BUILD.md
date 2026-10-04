# NAXA — Risques avant le premier vrai build

Ce document est un **audit statique** du code fourni dans `naxa2.zip`.

Aucun `npm install`, `tsc`, `next build` ou `lint` n'a été exécuté dans le cadre de cet audit. Les points ci-dessous sont donc des risques à vérifier avec le vrai compilateur, pas des erreurs confirmées.

## 1. Risque important — Server Action et `redirect()` dans `try/catch`

**Fichier :** `src/app/admin/produits/actions.ts:44-49`

```text
try {
  const fiche = await genererFiche(p);
  ...
} catch (e) {
  redirect(...);
}
```

### Pourquoi c'est un risque

Dans Next.js, `redirect()` interrompt le traitement par une exception interne. Le placer dans un `catch` peut intercepter un mécanisme de redirection provenant du traitement appelé ou produire un comportement inattendu selon le chemin d'exécution.

Ici, le `redirect()` est utilisé comme traitement de l'erreur de `genererFiche()`. C'est donc un point à vérifier avec le vrai build et, surtout, avec l'exécution de la Server Action.

### Correction proposée — texte seulement

Conserver le `try/catch` uniquement autour de `genererFiche()` et des opérations qui doivent réellement être capturées, stocker le message d'erreur dans une variable ou retourner un résultat d'erreur, puis effectuer `redirect()` **après** la fin du `try/catch`.

---

## 2. Risque probable — types retournés par Supabase `.select()`

**Fichiers concernés notamment :**

- `src/app/admin/actions.ts:19-23`
- `src/app/admin/page.tsx:14+`
- `src/app/admin/produits/actions.ts:11-12, 42-43`
- `src/app/admin/produits/page.tsx:11-17`
- `src/app/pharmacie/page.tsx:22-40`
- `src/app/produit/[id]/page.tsx:16-30`
- `src/app/reservation/[id]/page.tsx`
- `src/app/reservation/[id]/recu/page.tsx`

### Pourquoi c'est un risque

Le projet ne fournit pas de types générés Supabase attachés au client. Les résultats de `.select()` sont donc moins précis que des types générés à partir du schéma Supabase.

Le code compense parfois avec des assertions, par exemple :

```text
as Produit
as unknown as Ligne[]
as never
```

Ces assertions peuvent masquer une divergence entre la réponse réelle de Supabase et le type TypeScript attendu.

### Correction proposée — texte seulement

Générer les types TypeScript depuis le schéma Supabase et typer les clients Supabase avec ces types. Pour les relations imbriquées (`pharmacies(nom)`, `produits(nom,dosage)`, etc.), typer explicitement les résultats ou créer des types applicatifs correspondant exactement aux projections utilisées.

---

## 3. Risque probable — `.rpc()` et données de retour

**Fichiers :**

- `src/app/resultats/page.tsx:51-53`
- `src/app/resultats/page.tsx:77-80`
- `src/app/pharmacie/page.tsx:48`
- `src/app/pharmacie/page.tsx:94-95`

### Pourquoi c'est un risque

Les appels `rpc()` ne sont pas fortement typés par une définition TypeScript générée dans le projet. Le code force par exemple :

```text
(data ?? []) as ResultatPharmacie[]
```

et utilise directement :

```text
router.push(`/reservation/${data}`)
```

Si la signature SQL ou la structure de retour diffère, TypeScript ne le détectera pas nécessairement.

### Correction proposée — texte seulement

Générer les types Supabase et typer les RPC. Pour `reserve_stock`, vérifier explicitement que `data` est un UUID avant de construire l'URL. Pour les fonctions de recherche, typer la ligne de retour avec le type SQL correspondant.

---

## 4. Risque probable — paramètres des pages dynamiques

**Fichier :** `src/app/produit/[id]/page.tsx:14`

```text
{ params }: { params: { id: string } }
```

**Même famille de risque :**

- `src/app/reservation/[id]/page.tsx`
- `src/app/reservation/[id]/recu/page.tsx`

### Pourquoi c'est un risque

Le code cible Next.js 14. Dans cette version, les paramètres d'une page App Router sont attendus sous la forme synchrone utilisée ici. Une évolution de la version effective de Next.js ou de ses types pourrait rendre cette signature obsolète.

### Correction proposée — texte seulement

Ne pas modifier sur simple suspicion. Vérifier la signature contre la version réellement installée de Next.js. Si le compilateur exige des paramètres asynchrones, adapter alors `params` au type attendu par cette version et ajuster les accès à `params.id`.

---

## 5. Risque mineur — `<img>` et ESLint Next.js

Les `<img>` suivants ont déjà une désactivation locale de la règle :

- `src/app/produit/[id]/page.tsx:45`
- `src/components/BandeauDefilant.tsx:27`
- `src/components/PhotoUpload.tsx:43`

### Pourquoi c'est plutôt rassurant

La règle `@next/next/no-img-element` est explicitement désactivée sur ces lignes. Le premier build peut néanmoins signaler d'autres problèmes ESLint si une configuration externe ajoute des règles non visibles dans le code inspecté.

### Correction proposée — texte seulement

Ne pas remplacer automatiquement les `<img>`. Vérifier d'abord le résultat réel de `npm run lint`. Si une règle les signale malgré les commentaires, corriger uniquement les occurrences réellement signalées.

---

## 6. Risque probable — dépendance à `next/font/google`

**Fichier :** `src/app/layout.tsx:2`

```text
import { Inter } from "next/font/google";
```

### Pourquoi c'est un risque dans cet environnement

Le build réel doit résoudre la police Google selon le comportement de la version Next.js installée. Le réseau npm indisponible dans l'environnement actuel empêche de vérifier le comportement réel du build.

### Correction proposée — texte seulement

Ne pas modifier maintenant. Si le vrai build échoue sur la récupération de la police, choisir alors une solution compatible avec les contraintes de connexion et de performance de NAXA, après validation explicite.

---

## 7. Risque probable — `any` implicite / types trop larges masqués

La recherche statique n'a pas trouvé de `: any` explicite dans `src/`.

En revanche, plusieurs assertions (`as never`, `as unknown as`) masquent volontairement le type retourné par Supabase. Ce n'est pas un `any` implicite, mais cela réduit fortement la valeur du contrôle TypeScript.

### Correction proposée — texte seulement

Après un vrai `tsc --noEmit`, corriger uniquement les erreurs réelles. Priorité à la génération des types Supabase plutôt qu'à l'ajout d'assertions supplémentaires.

---

## 8. Risque probable — données imbriquées Supabase

**Fichiers :**

- `src/app/pharmacie/page.tsx:23-24`
- `src/app/reservation/[id]/recu/page.tsx:17-18`
- `src/app/reservation/[id]/page.tsx:24`

### Pourquoi

Les projections utilisent des relations imbriquées telles que :

```text
pharmacies(nom)
reservation_items(quantite,produits(nom))
produits(nom,dosage)
```

Le code utilise ensuite des propriétés optionnelles sans que la structure exacte soit validée par le compilateur contre le schéma Supabase.

### Correction proposée — texte seulement

Après génération des types Supabase, typer explicitement chaque résultat de relation imbriquée et supprimer progressivement les assertions `as never`/`as unknown as` lorsque le typage généré permet de les remplacer.

---

## 9. Risque probable — API `params` dans les Route Handlers dynamiques

**Fichier :** `src/app/api/pay/[id]/route.ts`

**Fichier :** `src/app/go/[id]/route.ts`

### Pourquoi

Ces handlers dépendent eux aussi de la signature exacte des paramètres dynamiques attendue par la version effective de Next.js. La compilation réelle est nécessaire pour confirmer que la signature utilisée correspond exactement à Next.js 14.2.x.

### Correction proposée — texte seulement

Comparer les signatures utilisées avec les types de la version effectivement installée. Ne rien changer avant le premier `tsc`/`next build`.

---

## 10. Risque fonctionnel détecté mais non assimilé à une erreur TypeScript

**Fichier :** `src/app/pharmacie/page.tsx:42-45`

Le `setInterval` dépend de `pid`, tandis que l'effet utilise une désactivation ESLint pour les dépendances.

### Pourquoi

Cela peut provoquer un comportement différent de celui attendu au premier rendu ou lors du changement de pharmacie, sans nécessairement provoquer une erreur de compilation.

### Correction proposée — texte seulement

Après le build, tester le panneau pharmacie avec un compte pharmacie réel. Si le rafraîchissement automatique ne suit pas le bon `pid`, revoir la structure de l'effet plutôt que simplement supprimer la règle ESLint.

---

# Ce qui n'est pas confirmé sans compilateur

Impossible de confirmer statiquement avec certitude :

- résultat de `npx tsc --noEmit` ;
- résultat de `npm run build` ;
- résultat de `npm run lint` ;
- versions réellement résolues des dépendances npm ;
- compatibilité exacte des types Supabase générés avec toutes les projections relationnelles ;
- comportement réel des Server Actions et de `redirect()` ;
- comportement réel des Route Handlers dynamiques ;
- erreurs ESLint dépendant de la configuration et de la version réellement installées ;
- erreurs Next.js déclenchées uniquement pendant le build ;
- erreurs SQL à l'exécution PostgreSQL.

**Aucune correction de code n'est appliquée dans ce document.**
