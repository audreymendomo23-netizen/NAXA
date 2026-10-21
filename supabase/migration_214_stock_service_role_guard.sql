-- NAXA 214 — restrict service inventory sessions to authorized stock roles.
begin;
create or replace function public.stock_service_open(p_pharmacie uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_role text;
  v_fonction text;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select lower(coalesce(p.role,'')),lower(coalesce(p.fonction_interne,''))
    into v_role,v_fonction
  from public.profiles p where p.id=auth.uid() and p.actif is distinct from false;
  if not found then raise exception 'Profil actif requis'; end if;

  if not (
    v_role='admin'
    or v_role='promoteur'
    or v_fonction in ('gestionnaire_stock','magasinier')
  ) then
    raise exception 'Prise de service réservée au gestionnaire de stock ou magasinier';
  end if;
  if not (v_role='admin' or private.naxa_scope_allows(auth.uid(),p_pharmacie,'PHARMACIE')) then
    raise exception 'Accès refusé à cette pharmacie';
  end if;

  insert into public.stock_service_sessions(pharmacie_id,gestionnaire_id,opening_note)
  values(p_pharmacie,auth.uid(),left(nullif(trim(p_note),''),500))
  returning id into v_id;

  insert into public.stock_service_inventory_counts(session_id,phase,produit_id,expected_quantity)
  select v_id,'opening',s.produit_id,greatest(s.quantite,0)
  from public.stocks s where s.pharmacie_id=p_pharmacie;

  return v_id;
exception when unique_violation then
  raise exception 'Une prise de service est déjà ouverte pour ce gestionnaire dans cette pharmacie';
end;
$function$;
commit;
