-- NAXA — Partie 6 : réconciliation finale Promoteur
-- Le moteur de privilèges doit dépendre exclusivement de la validité canonique
-- Convention Promoteur + abonnement Promoteur, jamais de l'ancien abonnement par pharmacie.

begin;

create or replace function private.naxa_promoteur_valide(p_promoteur uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to ''
as $body$
  select private.naxa_promoteur_valide_canonique($1);
$body$;

-- Les opérations de synchronisation qui modifient l'état métier ne sont pas des RPC client.
revoke execute on function public.synchroniser_validite_promoteurs() from public, anon, authenticated;
revoke execute on function public.synchroniser_validite_pharmacies() from public, anon, authenticated;

commit;
