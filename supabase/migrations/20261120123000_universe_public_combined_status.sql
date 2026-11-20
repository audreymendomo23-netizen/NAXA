-- NAXA B01 — source de vérité publique et fail-closed des univers.
-- N'expose jamais la table feature_flags ; seuls les slugs et booléens agrégés sont retournés.
begin;

create or replace function public.get_universe_public_status()
returns table(slug text, enabled boolean)
language sql
stable
security definer
set search_path = ''
as $function$
  select u.slug, (u.enabled is true and f.enabled is true) as enabled
  from public.universes u
  join public.feature_flags f
    on f.flag_key = 'universe.' || u.slug
  where u.slug in ('parapharmacie','bebe-maman','examens','suivi','prestations')
  order by u.display_order, u.slug;
$function$;

revoke all on function public.get_universe_public_status() from public;
grant execute on function public.get_universe_public_status() to anon, authenticated;

comment on function public.get_universe_public_status() is
'Public fail-closed status of configurable NAXA universes; exposes only slug and combined enabled state, never feature flag records.';

commit;
