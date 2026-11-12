-- NAXA — Verrouille la RPC de mutation du stock derrière le serveur authentifié.
-- L'API vérifie le JWT utilisateur, le compte et IMPORT_STOCK avant de déléguer.
begin;

create or replace function public.naxa_import_stock_batch_as_actor(
  p_actor uuid,
  p_pharmacie uuid,
  p_lignes jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_claims jsonb;
begin
  v_role := coalesce(
    nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
  if v_role is distinct from 'service_role' then
    raise exception 'Cette RPC est réservée au serveur NAXA.';
  end if;
  if p_actor is null then
    raise exception 'Identité applicative requise.';
  end if;

  v_claims := coalesce(
    nullif(pg_catalog.current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb;
  v_claims := v_claims || pg_catalog.jsonb_build_object('sub', p_actor::text);
  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor::text, true);
  perform pg_catalog.set_config('request.jwt.claims', v_claims::text, true);

  return public.naxa_import_stock_batch(p_pharmacie, p_lignes);
end;
$function$;

revoke all on function public.naxa_import_stock_batch(uuid,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.naxa_import_stock_batch_as_actor(uuid,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.naxa_import_stock_batch_as_actor(uuid,uuid,jsonb)
  to service_role;

comment on function public.naxa_import_stock_batch_as_actor(uuid,uuid,jsonb) is
  'Entrée serveur uniquement. L’API vérifie le JWT et le privilège IMPORT_STOCK, transmet l’acteur validé; les appels directs anon/authenticated sont interdits.';

commit;
