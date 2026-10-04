# NAXA — Mise en service

Guide simple pour mettre NAXA en ligne sans exposer de clé secrète.

> **Important :** ce guide ne contient aucune vraie clé. Ne colle jamais une `SUPABASE_SERVICE_ROLE_KEY`, une clé Gemini ou une autre clé secrète dans le code ou dans une variable `NEXT_PUBLIC_`.

## 1. Créer ou ouvrir le projet Supabase

1. Ouvre Supabase depuis ton téléphone ou ton ordinateur.
2. Crée un projet gratuit pour NAXA, ou ouvre le projet NAXA déjà créé.
3. Attends que le projet soit indiqué comme **actif**.
4. Ouvre **SQL Editor**.

### Exécuter les fichiers SQL dans cet ordre

Dans **SQL Editor**, ouvre puis exécte entirement :

1. `supabase/schema.sql`
2. `supabase/migration_002_catalogue_panier.sql`
3. `supabase/seed.sql` — **démo uniquement**.

Ne mélange pas les trois fichiers. La migration 002 doit être exécutée après `schema.sql`. Le seed contient les données de démonstration : ne l'utilise pas comme données réelles de lancement.

Après la migration 002, vérifie aussi dans **Storage** que le bucket **`produits-photos`** existe.

## 2. Récupérer les 3 valeurs Supabase nécessaires

Dans les réglages/API du projet Supabase, récupère :

1. **Project URL** → à mettre dans `NEXT_PUBLIC_SUPABASE_URL`
2. **Publishable key / clé publique** (ou la clé `anon` si le projet utilise encore l'ancien format) → à mettre dans `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Service role key** → à mettre dans `SUPABASE_SERVICE_ROLE_KEY`

### Où les mettre

Dans Vercel, ouvre le projet NAXA → **Settings → Environment Variables** et crée :

| Variable | Valeur | Visible dans le navigateur ? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Oui |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publique/anon | Oui |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key | **Non, jamais** |

Ajoute-les pour l'environnemt réellement éployé, normalement **Production** et, si nécessaire, Preview.

Ne mets aucune de ces valeurs dans `src/`, `README`, GitHub ou une capture d'écran publique.

## 3. Créer le premier administrateur

Le compte doit d'abord exister dans **Supabase → Authentication → Users**.

Le plus simple :

1. Utilise le parcours de connexion NAXA pour créer/connecter le premier compte avec son adresse e-mail.
2. Dans Supabase, ouvre **Authentication → Users** et copie l'UUID de ce compte.
3. Dans **SQL Editor**, exécute la requête suivante en remplaçant uniquement `UUID_DU_COMPTE` par cet UUID :

```sql
update public.profiles
set role = 'admin'
where id = 'UUID_DU_COMPTE';
```

La table `profiles` utilise `id` comme identifiant du compte Auth et son rôle est de type `role_type`, dont les valeurs prévues par le schéma sont `client`, `pharmacie` et `admin`.

Vérification :

```sql
select id, role, username, pharmacie_id
from public.profiles
where id = 'UUID_DU_COMPTE';
```

Le résultat attendu est `role = admin`.

## 4. Vérifier le bucket des photos

Après `migration_002_catalogue_panier.sql` :

1. Ouvre **Storage** dans Supabase.
2. Vérifie qu'un bucket nommé exactement **`produits-photos`** existe.
3. Il doit être configuré selon la migration : lecture publique et écriture protégée par le rôle admin.

Si le bucket n'existe pas, **n'invente pas une correction** : copie le message ou l'état affiché à Claude avant de modifier la base.

## 5. Déployer NAXA sur Vercel depuis GitHub

Le dépôt GitHub doit contenir la version NAXA validée.

Dans Vercel :

1. Ouvre le projet NAXA existant.
2. Connecte-le au dépôt GitHub NAXA si ce n'est pas déjà fait.
3. Choisis la branche autorisée pour le déploiement.
4. Dans **Settings → Environment Variables**, saisis les trois variables :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Enregistre.
6. Lance le déploiement seulement après validation de la version à déployer.

### Lire le journal de build

Dans Vercel :

**Deployments → le déploiement → Building / Build Logs**.

- Si le build finit par **Ready**, Vercel a terminé le build et le déploiement.
- Si le build finit par **Failed**, ouvre les logs et cherche la première erreur réelle, généralement signalée avec un fichier et une ligne.

## 6. Si le build échoue

Ne devine pas la correction.

1. Ouvre le log Vercel.
2. Copie **le message d'erreur complet**, avec le fichier, la ligne et le contexte affiché.
3. Envoie le message complet à Claude.
4. Ne supprime pas des fichiers et ne modifie pas plusieurs choses au hasard pour faire disparaître l'erreur.

## 7. Avant d'annoncer NAXA comme opérationnel

Vérifie au minimum :

- connexion par code e-mail ;
- recherche d'un médicament ;
- résultats des pharmacies ;
- panier local ;
- réservation facultative ;
- expiration d'une réservation non payée ;
- accès admin ;
- bucket `produits-photos` ;
- absence de clé secrète dans le navigateur ;
- affichage correct sur téléphone.

**Attention :** l'absence d'erreur de build ne prouve pas que ces parcours fonctionnent tous. Les tests fonctionnels et SQL doivent être exécutés séparément.
