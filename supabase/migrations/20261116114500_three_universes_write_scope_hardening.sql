-- NAXA — durcissement des droits et index de l'architecture multi-univers.
begin;

create index if not exists pharmacie_stock_univers_publications_produit_fk_idx
  on public.pharmacie_stock_univers_publications(produit_id);
create index if not exists pharmacie_stock_univers_publications_created_by_fk_idx
  on public.pharmacie_stock_univers_publications(created_by);
create index if not exists partner_product_univers_publications_product_fk_idx
  on public.partner_product_univers_publications(product_id);
create index if not exists partner_product_univers_publications_created_by_fk_idx
  on public.partner_product_univers_publications(created_by);

drop policy if exists pharmacie_stock_univers_publications_staff_read
  on public.pharmacie_stock_univers_publications;
create policy pharmacie_stock_univers_publications_staff_read
on public.pharmacie_stock_univers_publications
for select to authenticated
using (
  (select public.is_admin())
  or (select private.naxa_scope_allows((select auth.uid()),pharmacie_id,'PHARMACIE'))
  or (select public.naxa_has_active_professional_assignment((select auth.uid()),pharmacie_id,'gestionnaire_stock'))
  or (select public.naxa_has_active_professional_assignment((select auth.uid()),pharmacie_id,'magasinier'))
);

create or replace function public.partner_bebe_maman_product_definir(
  p_partner uuid,
  p_product uuid,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if p_partner is null or p_product is null or p_active is null then
    raise exception 'Partenaire, produit et action obligatoires';
  end if;
  if public.is_admin() or private.naxa_business_function(v_user)='admin' then
    raise exception 'Administration NAXA : supervision en lecture seule, publication réservée à la Parapharmacie';
  end if;
  if not private.naxa_partner_actor_can(p_partner,'EDIT_PRODUCT') then
    raise exception 'Droit de gestion du catalogue Parapharmacie requis';
  end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.actif=true) then
    raise exception 'Profil inactif';
  end if;
  if not exists(select 1 from public.partners pa
    where pa.id=p_partner and pa.partner_type='parapharmacie' and pa.status='active') then
    raise exception 'Seule une Parapharmacie active peut publier dans Bébé & Maman';
  end if;
  if not exists(select 1 from public.partner_products pp
    where pp.id=p_product and pp.partner_id=p_partner
      and pp.universe_slug='parapharmacie') then
    raise exception 'Cette fiche ne relève pas du catalogue Parapharmacie de ce partenaire';
  end if;
  if p_active then
    if not exists(
      select 1
      from public.partners pa
      join public.partner_universes pu on pu.partner_id=pa.id
        and pu.universe_slug='parapharmacie' and pu.enabled=true
      join public.universes up on up.slug='parapharmacie' and up.enabled=true
      join public.feature_flags fp on fp.flag_key='universe.parapharmacie' and fp.enabled=true
      join public.universes ub on ub.slug='bebe-maman' and ub.enabled=true
      join public.feature_flags fb on fb.flag_key='universe.bebe-maman' and fb.enabled=true
      where pa.id=p_partner and pa.partner_type='parapharmacie' and pa.status='active'
    ) then
      raise exception 'Association Parapharmacie ou univers indisponible';
    end if;
    if not exists(select 1 from public.partner_products pp
      where pp.id=p_product and pp.partner_id=p_partner and pp.status='active'
        and (pp.expires_at is null or pp.expires_at>=current_date)) then
      raise exception 'Publiez d’abord la fiche Parapharmacie et vérifiez sa date de validité';
    end if;
    if not private.naxa_bebe_maman_partner_product_allowed(p_product) then
      raise exception 'Produit non éligible à Bébé & Maman';
    end if;
    insert into public.partner_product_univers_publications(
      partner_id,product_id,universe_slug,active,created_by,created_at,updated_at
    ) values(p_partner,p_product,'bebe-maman',true,v_user,now(),now())
    on conflict(partner_id,product_id,universe_slug)
    do update set active=true,updated_at=now(),created_by=coalesce(
      public.partner_product_univers_publications.created_by,excluded.created_by
    );
  else
    update public.partner_product_univers_publications
    set active=false,updated_at=now()
    where partner_id=p_partner and product_id=p_product and universe_slug='bebe-maman';
  end if;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_user,
    case when p_active then 'parapharmacy.bebe_maman_product_published' else 'parapharmacy.bebe_maman_product_unpublished' end,
    'partner_product_universe_publication',p_product::text,
    jsonb_build_object('partner_id',p_partner,'universe_slug','bebe-maman','active',p_active));
  return true;
end;
$function$;
revoke all on function public.partner_bebe_maman_product_definir(uuid,uuid,boolean)
  from public,anon;
grant execute on function public.partner_bebe_maman_product_definir(uuid,uuid,boolean)
  to authenticated;

create or replace function public.reserve_universe_products(
  p_partner_id uuid,
  p_universe_slug text,
  p_items jsonb,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  uid uuid:=auth.uid();
  rid uuid;
  item jsonb;
  prod public.partner_products%rowtype;
  qty integer;
  reserved numeric;
  total integer:=0;
  item_count integer;
  distinct_count integer;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from public.profiles p where p.id=uid and p.role='client' and p.actif=true) then
    raise exception 'Compte Client actif requis';
  end if;
  if p_universe_slug not in ('parapharmacie','bebe-maman') then
    raise exception 'Univers non autorisé';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Liste de produits invalide';
  end if;
  select count(*),count(distinct (v->>'product_id')::uuid)
  into item_count,distinct_count
  from jsonb_array_elements(p_items) v;
  if item_count<1 or item_count>20 or item_count<>distinct_count then
    raise exception 'Panier invalide';
  end if;

  if not exists(
    select 1 from public.partners pa
    join public.partner_universes pu on pu.partner_id=pa.id
      and pu.universe_slug='parapharmacie' and pu.enabled=true
    join public.universes up on up.slug='parapharmacie' and up.enabled=true
    join public.feature_flags fp on fp.flag_key='universe.parapharmacie' and fp.enabled=true
    join public.universes u on u.slug=p_universe_slug and u.enabled=true
    join public.feature_flags f on f.flag_key='universe.'||p_universe_slug and f.enabled=true
    where pa.id=p_partner_id and pa.status='active'
      and pa.partner_type='parapharmacie'
  ) then raise exception 'Partenaire ou univers indisponible'; end if;

  for item in
    select v from jsonb_array_elements(p_items) v
    order by (v->>'product_id')::uuid
  loop
    if coalesce(item->>'product_id','') !~* '^[0-9a-f-]{36}$' then
      raise exception 'Identifiant produit invalide';
    end if;
    qty:=coalesce((item->>'quantity')::integer,0);
    if qty<1 or qty>10 then raise exception 'Quantité invalide'; end if;

    select pp.* into prod
    from public.partner_products pp
    where pp.id=(item->>'product_id')::uuid
      and pp.partner_id=p_partner_id
      and pp.universe_slug='parapharmacie'
      and pp.status='active'
      and (pp.expires_at is null or pp.expires_at>=current_date)
    for update;
    if not found then raise exception 'Produit indisponible'; end if;

    if p_universe_slug='bebe-maman' then
      if not exists(
        select 1 from public.partner_product_univers_publications pub
        where pub.partner_id=p_partner_id and pub.product_id=prod.id
          and pub.universe_slug='bebe-maman' and pub.active=true
      ) or not private.naxa_bebe_maman_partner_product_allowed(prod.id) then
        raise exception 'Produit non publié ou non éligible à Bébé & Maman';
      end if;
    end if;

    select coalesce(sum(ri.quantity),0) into reserved
    from public.universe_reservation_items ri
    join public.universe_reservations r on r.id=ri.reservation_id
    where ri.product_id=prod.id
      and r.status in ('requested','confirmed','ready')
      and r.expires_at>now();
    if prod.stock_quantity-reserved<qty then
      raise exception 'Stock insuffisant pour : %',prod.name;
    end if;
    total:=total+prod.price_fcfa*qty;
  end loop;

  insert into public.universe_reservations(
    client_id,partner_id,universe_slug,total_fcfa,client_note,pharmacie_id
  ) values(uid,p_partner_id,p_universe_slug,total,left(nullif(trim(p_note),''),500),null)
  returning id into rid;

  for item in
    select v from jsonb_array_elements(p_items) v
    order by (v->>'product_id')::uuid
  loop
    qty:=(item->>'quantity')::integer;
    select pp.* into prod from public.partner_products pp
    where pp.id=(item->>'product_id')::uuid and pp.partner_id=p_partner_id
    for update;
    insert into public.universe_reservation_items(
      reservation_id,product_id,product_name,unit_price_fcfa,quantity,line_total_fcfa
    ) values(rid,prod.id,prod.name,prod.price_fcfa,qty,prod.price_fcfa*qty);
  end loop;
  return rid;
end;
$function$;
revoke all on function public.reserve_universe_products(uuid,text,jsonb,text)
  from public,anon;
grant execute on function public.reserve_universe_products(uuid,text,jsonb,text)
  to authenticated;

commit;
