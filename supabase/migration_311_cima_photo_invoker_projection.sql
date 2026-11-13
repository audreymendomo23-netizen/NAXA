-- NAXA 311 — exposer la projection CIMA via une vue invoker.
-- La vue filtrée d'origine est conservée dans le schéma privé. Une fonction
-- SECURITY DEFINER sans argument, non exposée par PostgREST, ne renvoie que
-- le type composite de cette vue. La vue publique s'exécute en invoker.
begin;

do $$
begin
  if to_regclass('public.medicaments_cima_photos_public') is null then
    raise exception 'La vue publique CIMA 310 doit exister avant la migration 311.';
  end if;
  if to_regclass('private.cima_photo_projection_internal') is not null
     or to_regprocedure('private.read_cima_photo_projection()') is not null then
    raise exception 'La migration 311 semble déjà partiellement présente ; vérifier avant toute reprise.';
  end if;
end
$$;

alter view public.medicaments_cima_photos_public set schema private;
alter view private.medicaments_cima_photos_public rename to cima_photo_projection_internal;
alter view private.cima_photo_projection_internal set (security_invoker = true);

revoke all on private.cima_photo_projection_internal from public, anon, authenticated, service_role;

create function private.read_cima_photo_projection()
returns setof private.cima_photo_projection_internal
language sql
stable
security definer
set search_path = ''
as $function$
  select *
  from private.cima_photo_projection_internal;
$function$;

revoke all on function private.read_cima_photo_projection() from public;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.read_cima_photo_projection() to anon, authenticated, service_role;

create view public.medicaments_cima_photos_public
with (security_barrier = true, security_invoker = true) as
select *
from private.read_cima_photo_projection();

comment on view public.medicaments_cima_photos_public is
  'Projection CIMA publique en lecture invoker. Les lignes proviennent exclusivement de la vue interne privée filtrée ; aucun accès direct à la table de travail n’est accordé aux rôles publics.';

revoke all on public.medicaments_cima_photos_public from public;
grant select on public.medicaments_cima_photos_public to anon, authenticated, service_role;

commit;
