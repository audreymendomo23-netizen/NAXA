# Étape 5 — Dispositifs médicaux : verrouillage de phase 1

Date : 19 octobre 2026  
Référence : branche `main`

## Décision conservée
L’univers Dispositifs médicaux reste affiché uniquement comme espace « à venir ». Il demeure désactivé en phase 1 : aucun dispositif connecté, aucune synchronisation et aucune collecte de mesures de santé. Cette étape ne constitue pas une activation fonctionnelle du suivi médical.

## Correctifs
- Migration additive 125 : état canonique `universes.slug='suivi'` renommé « Dispositifs médicaux » et forcé à désactivé ; `universe.suivi` désactivé ; associations partenaires `suivi` désactivées.
- Quatre déclencheurs SQL empêchent l’activation de l’univers, l’activation du feature flag, l’activation d’une association partenaire et la publication d’un produit dans cet univers. Le verrouillage est côté base et ne dépend donc pas seulement de l’interface ou des actions Next.js.
- L’espace reste une page informative qui annonce explicitement son état « à venir » et ne propose aucune saisie ou synchronisation de données de santé.
- Libellé de l’administration harmonisé en « Dispositifs médicaux ».

## Preuves et limites
- Migration 125 appliquée à Supabase Production ; résultat et état de configuration à confirmer par lecture SQL après application.
- Test structurel 125 : vérifier les quatre déclencheurs, le contenu des gardes et l’état désactivé.
- Aucun déploiement Vercel n’est lancé sans autorisation explicite.
- Un build Next.js et un parcours navigateur ne sont pas revendiqués tant qu’ils n’ont pas été réellement exécutés.
