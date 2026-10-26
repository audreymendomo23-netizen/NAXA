begin;

-- SECURITY DEFINER helpers with fully schema-qualified application objects:
-- retain auth.uid() resolution through the auth-only search path.
alter function private.is_promoteur() set search_path = 'auth';
alter function private.my_pharmacie() set search_path = 'auth';
alter function private.stats_admin(integer) set search_path = 'auth';
alter function private.stats_pharmacie(uuid,integer) set search_path = 'auth';
alter function private.set_reservation_status(uuid,resa_statut) set search_path = 'auth';

-- This function uses only schema-qualified public objects and no auth helper.
alter function private.validites_pharmacies_admin() set search_path = '';

-- Make the nested private helper explicit instead of resolving it from public.
create or replace function private.set_garde(p_garde boolean)
returns void
language plpgsql
security definer
set search_path = 'auth'
as $function$
declare
  v_pharmacie uuid;
begin
  v_pharmacie := private.my_pharmacie();
  if v_pharmacie is null then
    raise exception 'Réservé aux comptes pharmacie actifs';
  end if;

  update public.pharmacies
     set de_garde = p_garde
   where id = v_pharmacie;
end
$function$;

-- Defense in depth: these private-schema routines must not be executable by anon.
revoke all on function private.is_promoteur() from public, anon;
revoke all on function private.log_evenement(text,uuid,uuid,text,integer,double precision,double precision) from public, anon;
revoke all on function private.log_recherche(text[]) from public, anon;
revoke all on function private.my_pharmacie() from public, anon;
revoke all on function private.produits_populaires(integer,integer) from public, anon;
revoke all on function private.search_pharmacies_panier(jsonb,double precision,double precision,double precision) from public, anon;

commit;
