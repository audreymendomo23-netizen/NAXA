-- NAXA 278 — cohérence serveur/RLS : la Caisse ne gère pas les lots ni la quarantaine.
begin;

drop policy if exists stocks_lots_lecture on public.stocks_lots;
create policy stocks_lots_lecture
on public.stocks_lots
for select
to authenticated
using (
  is_admin()
  or public.naxa_has_privilege('VIEW_STOCK',pharmacie_id,'PHARMACIE')
  or (
    coalesce(public.naxa_business_function(auth.uid()),'')<>'caisse'
    and public.naxa_has_privilege('MANAGE_LOTS',pharmacie_id,'PHARMACIE')
  )
);

drop policy if exists stocks_lots_manage_insert on public.stocks_lots;
create policy stocks_lots_manage_insert
on public.stocks_lots
for insert
to authenticated
with check (
  is_admin()
  or (
    coalesce(public.naxa_business_function(auth.uid()),'')<>'caisse'
    and public.naxa_has_privilege('MANAGE_LOTS',pharmacie_id,'PHARMACIE')
  )
);

drop policy if exists stocks_lots_manage_update on public.stocks_lots;
create policy stocks_lots_manage_update
on public.stocks_lots
for update
to authenticated
using (
  is_admin()
  or (
    coalesce(public.naxa_business_function(auth.uid()),'')<>'caisse'
    and public.naxa_has_privilege('MANAGE_LOTS',pharmacie_id,'PHARMACIE')
  )
)
with check (
  is_admin()
  or (
    coalesce(public.naxa_business_function(auth.uid()),'')<>'caisse'
    and public.naxa_has_privilege('MANAGE_LOTS',pharmacie_id,'PHARMACIE')
  )
);

drop policy if exists stocks_lots_manage_delete on public.stocks_lots;
create policy stocks_lots_manage_delete
on public.stocks_lots
for delete
to authenticated
using (
  is_admin()
  or (
    coalesce(public.naxa_business_function(auth.uid()),'')<>'caisse'
    and public.naxa_has_privilege('MANAGE_LOTS',pharmacie_id,'PHARMACIE')
  )
);

drop policy if exists rappels_lots_read_scope on public.rappels_lots;
create policy rappels_lots_read_scope
on public.rappels_lots
for select
to authenticated
using (
  is_admin()
  or public.naxa_has_privilege('VIEW_STOCK',pharmacie_id,'PHARMACIE')
  or (
    coalesce(public.naxa_business_function(auth.uid()),'')<>'caisse'
    and public.naxa_has_privilege('MANAGE_LOTS',pharmacie_id,'PHARMACIE')
  )
);

drop policy if exists rappels_lots_traitements_read on public.rappels_lots_traitements;
create policy rappels_lots_traitements_read
on public.rappels_lots_traitements
for select
to authenticated
using (
  is_admin()
  or (
    coalesce(public.naxa_business_function(auth.uid()),'')<>'caisse'
    and public.naxa_has_privilege('MANAGE_LOTS',pharmacie_id,'PHARMACIE')
  )
  or public.naxa_has_privilege('VIEW_PURCHASE_COST',pharmacie_id,'PHARMACIE')
);

create or replace function public.lot_quarantaine_compter(
 p_rappel uuid,p_quantite_trouvee integer,p_quantite_isolee integer
) returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_rappel public.rappels_lots%rowtype;
  v_profile public.profiles%rowtype;
  v_user uuid:=auth.uid();
  v_can_manage boolean:=false;
  v_assigned boolean:=false;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if p_quantite_trouvee is null or p_quantite_trouvee<0
     or p_quantite_isolee is null or p_quantite_isolee<0
     or p_quantite_isolee>p_quantite_trouvee then
    raise exception 'Comptage invalide : unités isolées entre 0 et unités retrouvées';
  end if;
  select * into v_profile from public.profiles where id=v_user and actif=true;
  if not found then raise exception 'Compte inactif'; end if;
  if coalesce(public.naxa_business_function(v_user),'')='caisse'
    or coalesce(v_profile.role::text,'')='caisse'
    or coalesce(v_profile.fonction_interne,'')='caisse' then
    raise exception 'Comptage de quarantaine interdit pour la Caisse';
  end if;
  select * into v_rappel from public.rappels_lots where id=p_rappel and statut='actif' for update;
  if not found then raise exception 'Rappel actif introuvable'; end if;
  if not public.naxa_scope_allows(v_user,v_rappel.pharmacie_id,'PHARMACIE') then
    v_assigned:=public.naxa_has_active_professional_assignment(v_user,v_rappel.pharmacie_id,'gestionnaire_stock')
      or public.naxa_has_active_professional_assignment(v_user,v_rappel.pharmacie_id,'magasinier');
  end if;
  v_can_manage:=public.naxa_has_privilege('MANAGE_LOTS',v_rappel.pharmacie_id,'PHARMACIE');
  if not (v_can_manage or v_assigned
    or coalesce(v_profile.role::text,'')='promoteur'
    or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')) then
    raise exception 'Comptage réservé aux fonctions autorisées à gérer les lots';
  end if;
  update public.rappels_lots
  set quantite_trouvee=p_quantite_trouvee,quantite_isolee=p_quantite_isolee,compte_par=v_user,compte_at=now()
  where id=p_rappel and statut='actif';
end;
$function$;

revoke all on function public.lot_quarantaine_compter(uuid,integer,integer) from public,anon;
grant execute on function public.lot_quarantaine_compter(uuid,integer,integer) to authenticated;

commit;
