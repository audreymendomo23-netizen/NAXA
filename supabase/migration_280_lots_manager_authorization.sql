-- NAXA 280 — centraliser le droit métier de gestion des lots pour RLS, écran et RPC.
begin;

create or replace function public.naxa_can_manage_lots(p_pharmacie uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_function text;
begin
  if v_user is null or p_pharmacie is null then return false; end if;
  if public.is_admin() then return true; end if;
  v_function:=public.naxa_business_function(v_user);
  if v_function is null or v_function='caisse' then return false; end if;
  if not public.naxa_scope_allows(v_user,p_pharmacie,'PHARMACIE') then return false; end if;
  if v_function in ('promoteur','pharmacien','pharmacien_assistant','responsable') then return true; end if;
  if public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'gestionnaire_stock')
    or public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'magasinier') then
    return true;
  end if;
  return public.naxa_has_privilege('MANAGE_LOTS',p_pharmacie,'PHARMACIE');
end;
$function$;

revoke all on function public.naxa_can_manage_lots(uuid) from public,anon;
grant execute on function public.naxa_can_manage_lots(uuid) to authenticated,service_role;

drop policy if exists stocks_lots_lecture on public.stocks_lots;
create policy stocks_lots_lecture
on public.stocks_lots
for select
to authenticated
using (
  is_admin()
  or public.naxa_has_privilege('VIEW_STOCK',pharmacie_id,'PHARMACIE')
  or public.naxa_can_manage_lots(pharmacie_id)
);

drop policy if exists stocks_lots_manage_insert on public.stocks_lots;
create policy stocks_lots_manage_insert
on public.stocks_lots
for insert
to authenticated
with check (
  is_admin() or public.naxa_can_manage_lots(pharmacie_id)
);

drop policy if exists stocks_lots_manage_update on public.stocks_lots;
create policy stocks_lots_manage_update
on public.stocks_lots
for update
to authenticated
using (
  is_admin() or public.naxa_can_manage_lots(pharmacie_id)
)
with check (
  is_admin() or public.naxa_can_manage_lots(pharmacie_id)
);

drop policy if exists stocks_lots_manage_delete on public.stocks_lots;
create policy stocks_lots_manage_delete
on public.stocks_lots
for delete
to authenticated
using (
  is_admin() or public.naxa_can_manage_lots(pharmacie_id)
);

drop policy if exists rappels_lots_read_scope on public.rappels_lots;
create policy rappels_lots_read_scope
on public.rappels_lots
for select
to authenticated
using (
  is_admin()
  or public.naxa_has_privilege('VIEW_STOCK',pharmacie_id,'PHARMACIE')
  or public.naxa_can_manage_lots(pharmacie_id)
);

drop policy if exists rappels_lots_traitements_read on public.rappels_lots_traitements;
create policy rappels_lots_traitements_read
on public.rappels_lots_traitements
for select
to authenticated
using (
  is_admin()
  or public.naxa_can_manage_lots(pharmacie_id)
  or public.naxa_has_privilege('VIEW_PURCHASE_COST',pharmacie_id,'PHARMACIE')
);

create or replace function public.lot_rappeler(p_lot uuid,p_motif text,p_reference text default null)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_lot public.stocks_lots%rowtype;
  v_id uuid;
  v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if length(trim(coalesce(p_motif,''))) not between 5 and 500 then
    raise exception 'Le motif du rappel doit contenir entre 5 et 500 caractères';
  end if;
  if p_reference is not null and length(trim(p_reference))>120 then
    raise exception 'La référence du rappel ne peut pas dépasser 120 caractères';
  end if;
  select * into v_lot from public.stocks_lots where id=p_lot for update;
  if not found then raise exception 'Lot introuvable'; end if;
  if not public.naxa_can_manage_lots(v_lot.pharmacie_id) then
    raise exception 'Déclaration de rappel réservée aux fonctions autorisées à gérer les lots';
  end if;
  if exists(select 1 from public.rappels_lots where lot_id=p_lot and statut='actif') then
    raise exception 'Ce lot fait déjà l''objet d''un rappel actif';
  end if;
  insert into public.rappels_lots(
    pharmacie_id,lot_id,reference_rappel,motif,created_by,lot_bloque_avant,lot_motif_blocage_avant
  ) values(
    v_lot.pharmacie_id,p_lot,nullif(trim(p_reference),''),trim(p_motif),v_user,v_lot.bloque,v_lot.motif_blocage
  ) returning id into v_id;
  update public.stocks_lots set bloque=true,motif_blocage=trim(p_motif) where id=p_lot;
  return v_id;
end;
$function$;

revoke all on function public.lot_rappeler(uuid,text,text) from public,anon;
grant execute on function public.lot_rappeler(uuid,text,text) to authenticated;

commit;
