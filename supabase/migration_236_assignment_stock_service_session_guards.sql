-- NAXA 236 — revalider l’affectation Stock pendant le comptage et la clôture de service.
-- L’affectation ne permet pas de reprendre une session ouverte par un autre gestionnaire.
begin;
create or replace function public.stock_service_record_count(
  p_session uuid,
  p_phase text,
  p_counts jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare v_session public.stock_service_sessions%rowtype; it jsonb; v_product uuid; v_count integer; v_expected integer; v_written integer:=0;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_phase not in ('opening','closing') then raise exception 'Phase d’inventaire invalide'; end if;
  if jsonb_typeof(p_counts)<>'array' or jsonb_array_length(p_counts)>5000 then
    raise exception 'Liste de comptage invalide';
  end if;

  select * into v_session from public.stock_service_sessions where id=p_session for update;
  if not found then raise exception 'Session introuvable'; end if;
  if not (private.is_admin() or private.naxa_scope_allows(auth.uid(),v_session.pharmacie_id,'PHARMACIE')
    or public.naxa_has_active_professional_assignment(auth.uid(),v_session.pharmacie_id,'gestionnaire_stock')
    or public.naxa_has_active_professional_assignment(auth.uid(),v_session.pharmacie_id,'magasinier')) then
    raise exception 'Affectation Stock absente ou expirée pour cette pharmacie';
  end if;
  if v_session.gestionnaire_id<>auth.uid() and not private.is_admin() then
    raise exception 'Seul le gestionnaire responsable peut saisir cet inventaire';
  end if;
  if v_session.status<>'open' then raise exception 'Session de service déjà clôturée'; end if;
  if p_phase='closing' and exists(select 1 from public.stock_service_inventory_counts
    where session_id=p_session and phase='opening' and counted_quantity is null) then
    raise exception 'Terminez d’abord le comptage de prise de service';
  end if;

  for it in select value from jsonb_array_elements(p_counts) loop
    v_product := (it->>'produit_id')::uuid;
    v_count := (it->>'quantite_comptee')::integer;
    if v_count is null or v_count<0 then raise exception 'Quantité comptée invalide'; end if;

    select c.expected_quantity into v_expected
    from public.stock_service_inventory_counts c
    where c.session_id=p_session and c.phase=p_phase and c.produit_id=v_product
    for update;

    if not found then
      if not exists(select 1 from public.stocks s
        where s.pharmacie_id=v_session.pharmacie_id and s.produit_id=v_product) then
        raise exception 'Produit hors stock de cette pharmacie';
      end if;
      select greatest(s.quantite,0) into v_expected from public.stocks s
        where s.pharmacie_id=v_session.pharmacie_id and s.produit_id=v_product;
      insert into public.stock_service_inventory_counts(session_id,phase,produit_id,expected_quantity,counted_quantity,counted_by,counted_at)
      values(p_session,p_phase,v_product,v_expected,v_count,auth.uid(),now());
    else
      update public.stock_service_inventory_counts
        set counted_quantity=v_count,counted_by=auth.uid(),counted_at=now()
        where session_id=p_session and phase=p_phase and produit_id=v_product;
    end if;
    v_written:=v_written+1;
  end loop;
  return v_written;
end;
$function$;
create or replace function public.stock_service_close(p_session uuid,p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare s public.stock_service_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into s from public.stock_service_sessions where id=p_session for update;
  if not found then raise exception 'Session introuvable'; end if;
  if not (private.is_admin() or private.naxa_scope_allows(auth.uid(),s.pharmacie_id,'PHARMACIE')
    or public.naxa_has_active_professional_assignment(auth.uid(),s.pharmacie_id,'gestionnaire_stock')
    or public.naxa_has_active_professional_assignment(auth.uid(),s.pharmacie_id,'magasinier')) then
    raise exception 'Affectation Stock absente ou expirée pour cette pharmacie';
  end if;
  if s.gestionnaire_id<>auth.uid() and not private.is_admin() then raise exception 'Accès refusé'; end if;
  if s.status<>'open' then raise exception 'Session déjà clôturée'; end if;
  if exists(select 1 from public.stock_service_inventory_counts
    where session_id=p_session and phase='opening' and counted_quantity is null) then
    raise exception 'Inventaire de prise de service incomplet';
  end if;

  insert into public.stock_service_inventory_counts(session_id,phase,produit_id,expected_quantity)
  select p_session,'closing',st.produit_id,greatest(st.quantite,0)
  from public.stocks st
  where st.pharmacie_id=s.pharmacie_id
  on conflict(session_id,phase,produit_id) do nothing;

  if exists(select 1 from public.stock_service_inventory_counts
    where session_id=p_session and phase='closing' and counted_quantity is null) then
    raise exception 'Renseignez les quantités comptées de fin de service avant clôture';
  end if;

  update public.stock_service_sessions
  set status='closed',closed_at=now(),closing_note=left(nullif(trim(p_note),''),500)
  where id=p_session;
end;
$function$;
revoke all on function public.stock_service_record_count(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.stock_service_close(uuid,text) from public,anon,authenticated;
grant execute on function public.stock_service_record_count(uuid,text,jsonb) to authenticated;
grant execute on function public.stock_service_close(uuid,text) to authenticated;
commit;
