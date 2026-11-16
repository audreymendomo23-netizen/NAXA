-- NAXA — Trace explicite de l'univers d'origine sur les réservations ERP.
-- Une même fiche peut être publiée dans plusieurs univers : le produit seul ne détermine plus la provenance.
begin;

alter table public.reservations
  add column if not exists source_universe_slug text not null default 'pharmacie';

do $constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.reservations'::regclass
      and conname='reservations_source_universe_slug_check'
  ) then
    alter table public.reservations
      add constraint reservations_source_universe_slug_check
      check (source_universe_slug in ('pharmacie','parapharmacie','bebe-maman'));
  end if;
end;
$constraint$;

create index if not exists reservations_source_universe_pending_idx
  on public.reservations(source_universe_slug,pharmacie_id,statut,expires_at)
  where mode='reservation';

create or replace function public.reserve_pharmacy_stock_in_universe(
  p_pharmacie uuid,
  p_universe_slug text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_group_item jsonb;
  v_items jsonb;
  v_id uuid;
  v_expire timestamptz;
  v_count integer;
  v_anonyme boolean:=true;
  v_pharmacie public.pharmacies%rowtype;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from public.profiles p
    where p.id=v_user and p.role='client' and p.actif=true) then
    raise exception 'Compte Client actif requis';
  end if;
  -- private.reserve_stock accepte au plus 10 lignes ; conserver le même contrat ici.
  if p_pharmacie is null or p_universe_slug not in ('bebe-maman','parapharmacie')
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>10 then
    raise exception 'Panier ou destination invalide (10 lignes maximum par pharmacie)';
  end if;
  select * into v_pharmacie from public.pharmacies ph
  where ph.id=p_pharmacie and ph.actif=true and ph.visible_recherche=true
    and ph.est_demo=false and ph.archivee_le is null;
  if not found then raise exception 'Pharmacie indisponible'; end if;
  if not exists(select 1 from public.universes u
    join public.feature_flags f on f.flag_key='universe.'||p_universe_slug and f.enabled=true
    where u.slug=p_universe_slug and u.enabled=true) then
    raise exception 'Univers temporairement indisponible';
  end if;
  if p_universe_slug='bebe-maman' and not exists(
    select 1 from public.pharmacie_services ps
    where ps.pharmacie_id=p_pharmacie and ps.service_slug='bebe-maman'
      and ps.status='active'
  ) then raise exception 'Service Bébé & Maman indisponible dans cette pharmacie'; end if;

  if exists(
    select 1 from jsonb_array_elements(p_items) x
    where coalesce(x->>'product_id','') !~* '^[0-9a-f-]{36}$'
      or coalesce((x->>'quantity')::integer,0) not between 1 and 10
  ) then raise exception 'Produit ou quantité invalide'; end if;
  select count(*) into v_count from jsonb_array_elements(p_items);
  if exists(
    select x->>'product_id' from jsonb_array_elements(p_items) x
    group by x->>'product_id' having count(*)>1
  ) then raise exception 'Produit dupliqué dans le panier'; end if;

  if p_universe_slug='bebe-maman' then
    if exists(
      select 1 from jsonb_array_elements(p_items) x
      where not exists(
        select 1 from public.pharmacie_stock_univers_publications pub
        where pub.pharmacie_id=p_pharmacie
          and pub.produit_id=(x->>'product_id')::uuid
          and pub.universe_slug='bebe-maman' and pub.active=true
      ) or not exists(
        select 1 from public.produits p
        where p.id=(x->>'product_id')::uuid
          and (p.created_by_pharmacie_id is null or p.created_by_pharmacie_id=p_pharmacie)
      ) or not private.naxa_bebe_maman_product_allowed((x->>'product_id')::uuid)
    ) then raise exception 'Article non publié, hors propriétaire ou non éligible à Bébé & Maman'; end if;
  else
    if exists(
      select 1 from jsonb_array_elements(p_items) x
      where not exists(
        select 1 from public.pharmacie_stock_univers_publications pub
        where pub.pharmacie_id=p_pharmacie
          and pub.produit_id=(x->>'product_id')::uuid
          and pub.universe_slug='parapharmacie' and pub.active=true
      ) or not exists(
        select 1 from public.produits p
        where p.id=(x->>'product_id')::uuid
          and (p.created_by_pharmacie_id is null or p.created_by_pharmacie_id=p_pharmacie)
      ) or not private.naxa_pharmacie_parapharmacie_product_allowed((x->>'product_id')::uuid)
    ) then raise exception 'Article non publié, hors propriétaire ou non éligible à Parapharmacie'; end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'produit_id',x->>'product_id','quantite',(x->>'quantity')::integer
  ) order by x->>'product_id'),'[]'::jsonb)
  into v_items from jsonb_array_elements(p_items) x;
  v_id:=private.reserve_stock(p_pharmacie,v_items);
  v_expire:=now()+interval '4 hours';
  update public.reservations
  set mode='reservation',paiement_statut='a_verifier',paiement_mode='a_convenir',
      source_universe_slug=p_universe_slug,
      expires_at=v_expire
  where id=v_id and client_id=v_user;
  if not found then raise exception 'La réservation ERP n’a pas pu être finalisée'; end if;

  select coalesce(cp.anonyme_defaut,true) into v_anonyme
  from public.client_preferences cp where cp.user_id=v_user;
  insert into public.fils_messages(pharmacie_id,client_id,anonyme)
  values(p_pharmacie,v_user,v_anonyme)
  on conflict(client_id,pharmacie_id) do nothing;
  insert into public.notifications(pharmacie_id,type,titre,corps,fil_id,reservation_id)
  values(
    p_pharmacie,'reservation',
    case when p_universe_slug='bebe-maman'
      then 'Nouvelle réservation Bébé & Maman' else 'Nouvelle réservation Parapharmacie' end,
    case when p_universe_slug='bebe-maman'
      then 'Une réservation Bébé & Maman attend votre confirmation dans le poste Stock.'
      else 'Une réservation issue de l’univers Parapharmacie attend votre confirmation dans le poste Stock.' end,
    (select f.id from public.fils_messages f
      where f.client_id=v_user and f.pharmacie_id=p_pharmacie),
    v_id
  );
  return jsonb_build_object(
    'id',v_id,'mode','reservation','owner_type','pharmacie',
    'owner_id',p_pharmacie,'pharmacie_id',p_pharmacie,'expires_at',v_expire
  );
end;
$function$;
revoke all on function public.reserve_pharmacy_stock_in_universe(uuid,text,jsonb)
  from public,anon;
grant execute on function public.reserve_pharmacy_stock_in_universe(uuid,text,jsonb)
  to authenticated;

CREATE OR REPLACE FUNCTION public.creer_reservations_bebe_maman_client(p_groups jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid:=auth.uid();
  v_group jsonb;
  v_item jsonb;
  v_pharmacie uuid;
  v_produit uuid;
  v_q integer;
  v_items jsonb;
  v_id uuid;
  v_expire timestamptz;
  v_result jsonb:='[]'::jsonb;
  v_anonyme boolean:=true;
  v_pharmacie_row public.pharmacies%rowtype;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=v_user and p.role='client' and p.actif=true
  ) then raise exception 'Compte Client actif requis'; end if;
  if p_groups is null or jsonb_typeof(p_groups) is distinct from 'array'
     or jsonb_array_length(p_groups)<1 or jsonb_array_length(p_groups)>10 then
    raise exception 'Groupes de réservation invalides';
  end if;
  if exists (
    select value->>'pharmacie_id'
    from jsonb_array_elements(p_groups)
    group by value->>'pharmacie_id'
    having count(*)>1
  ) then raise exception 'Une seule liste d’articles par pharmacie est autorisée'; end if;

  select coalesce(cp.anonyme_defaut,true) into v_anonyme
  from public.client_preferences cp where cp.user_id=v_user;

  for v_group in
    select value from jsonb_array_elements(p_groups)
    order by value->>'pharmacie_id'
  loop
    begin
      v_pharmacie:=(v_group->>'pharmacie_id')::uuid;
    exception when others then
      raise exception 'Identifiant pharmacie invalide';
    end;
    if jsonb_typeof(v_group->'items') is distinct from 'array'
       or jsonb_array_length(v_group->'items')<1
       or jsonb_array_length(v_group->'items')>10 then
      raise exception 'Panier Bébé & Maman invalide';
    end if;

    select * into v_pharmacie_row
    from public.pharmacies ph
    where ph.id=v_pharmacie and ph.actif=true
      and ph.visible_recherche=true and ph.est_demo=false
      and ph.archivee_le is null;
    if not found then raise exception 'Pharmacie indisponible'; end if;
    if not exists (
      select 1 from public.universes u
      join public.feature_flags f on f.flag_key='universe.bebe-maman' and f.enabled=true
      where u.slug='bebe-maman' and u.enabled=true
    ) then raise exception 'Univers Bébé & Maman temporairement indisponible'; end if;
    if not exists (
      select 1 from public.pharmacie_services ps
      where ps.pharmacie_id=v_pharmacie
        and ps.service_slug='bebe-maman' and ps.status='active'
    ) then raise exception 'Service Bébé & Maman indisponible dans cette pharmacie'; end if;

    if exists (
      select 1 from jsonb_array_elements(v_group->'items') x
      where coalesce(x->>'produit_id','') !~* '^[0-9a-f-]{36}$'
         or coalesce((x->>'quantite')::int,0) not between 1 and 10
    ) then raise exception 'Produit ou quantité invalide'; end if;
    if exists (
      select x->>'produit_id'
      from jsonb_array_elements(v_group->'items') x
      group by x->>'produit_id' having count(*)>1
    ) then raise exception 'Produit dupliqué dans le panier'; end if;

    for v_item in select value from jsonb_array_elements(v_group->'items')
    loop
      v_produit:=(v_item->>'produit_id')::uuid;
      v_q:=(v_item->>'quantite')::integer;
      if not exists (
        select 1
        from public.pharmacie_bebe_maman_produits bm
        where bm.pharmacie_id=v_pharmacie and bm.produit_id=v_produit
          and bm.active=true
      ) or not private.naxa_bebe_maman_product_allowed(v_produit) then
        raise exception 'Article non publié dans Bébé & Maman pour cette pharmacie';
      end if;
    end loop;

    select jsonb_agg(jsonb_build_object(
      'produit_id',x->>'produit_id',
      'quantite',(x->>'quantite')::integer
    ) order by x->>'produit_id')
    into v_items
    from jsonb_array_elements(v_group->'items') x;

    v_id:=private.reserve_stock(v_pharmacie,v_items);
    v_expire:=now()+interval '4 hours';
    update public.reservations
    set mode='reservation',
        paiement_statut='a_verifier',
        paiement_mode='a_convenir',
        source_universe_slug='bebe-maman',
        expires_at=v_expire
    where id=v_id and client_id=v_user;
    if not found then raise exception 'La réservation ERP n’a pas pu être finalisée'; end if;

    insert into public.fils_messages(pharmacie_id,client_id,anonyme)
    values(v_pharmacie,v_user,v_anonyme)
    on conflict(client_id,pharmacie_id) do nothing;

    insert into public.notifications(pharmacie_id,type,titre,corps,fil_id,reservation_id)
    values(
      v_pharmacie,'reservation','Nouvelle réservation Bébé & Maman',
      'Une réservation Bébé & Maman attend votre confirmation dans le poste Stock.',
      (select f.id from public.fils_messages f
       where f.client_id=v_user and f.pharmacie_id=v_pharmacie),
      v_id
    );

    v_result:=v_result||jsonb_build_array(jsonb_build_object(
      'id',v_id,'mode','reservation','pharmacie_id',v_pharmacie,
      'expires_at',v_expire
    ));
  end loop;
  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_bebe_maman_supervision()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Consultation réservée à l’Administrateur actif';
  end if;

  select jsonb_build_object(
    'pharmacies_service_actif',(
      select count(*)
      from public.pharmacie_services ps
      join public.pharmacies ph on ph.id=ps.pharmacie_id
      where ps.service_slug='bebe-maman' and ps.status='active'
        and ph.actif=true and ph.archivee_le is null
    ),
    'references_publiees',(
      select count(*)
      from (
        select pub.pharmacie_id as owner_id,pub.produit_id
        from public.pharmacie_stock_univers_publications pub
        join public.pharmacies ph on ph.id=pub.pharmacie_id
          and ph.actif=true and ph.visible_recherche=true
          and ph.est_demo=false and ph.archivee_le is null
        join public.pharmacie_services ps on ps.pharmacie_id=ph.id
          and ps.service_slug='bebe-maman' and ps.status='active'
        join public.stocks s on s.pharmacie_id=pub.pharmacie_id
          and s.produit_id=pub.produit_id
        where pub.universe_slug='bebe-maman' and pub.active=true
          and private.naxa_bebe_maman_product_allowed(pub.produit_id)
        union all
        select pub.partner_id as owner_id,pub.product_id
        from public.partner_product_univers_publications pub
        join public.partner_products pp on pp.id=pub.product_id
          and pp.partner_id=pub.partner_id and pp.universe_slug='parapharmacie'
          and pp.status='active'
          and (pp.expires_at is null or pp.expires_at>=current_date)
        join public.partners pa on pa.id=pub.partner_id
          and pa.partner_type='parapharmacie' and pa.status='active'
        where pub.universe_slug='bebe-maman' and pub.active=true
          and private.naxa_bebe_maman_partner_product_allowed(pp.id)
      ) publications
    ),
    'offres_disponibles',(
      select count(*)
      from (
        select pub.pharmacie_id as owner_id,pub.produit_id
        from public.pharmacie_stock_univers_publications pub
        join public.pharmacies ph on ph.id=pub.pharmacie_id
          and ph.actif=true and ph.visible_recherche=true
          and ph.est_demo=false and ph.archivee_le is null
        join public.pharmacie_services ps on ps.pharmacie_id=ph.id
          and ps.service_slug='bebe-maman' and ps.status='active'
        cross join lateral private.marketplace_offre_stock_disponible_guarded(
          pub.pharmacie_id,pub.produit_id
        ) offer
        where pub.universe_slug='bebe-maman' and pub.active=true
          and private.naxa_bebe_maman_product_allowed(pub.produit_id)
          and offer.quantite>0
        union all
        select pub.partner_id as owner_id,pub.product_id
        from public.partner_product_univers_publications pub
        join public.partner_products pp on pp.id=pub.product_id
          and pp.partner_id=pub.partner_id and pp.universe_slug='parapharmacie'
          and pp.status='active'
          and (pp.expires_at is null or pp.expires_at>=current_date)
        join public.partners pa on pa.id=pub.partner_id
          and pa.partner_type='parapharmacie' and pa.status='active'
        left join lateral (
          select coalesce(sum(ri.quantity),0)::numeric quantity_reserved
          from public.universe_reservation_items ri
          join public.universe_reservations r on r.id=ri.reservation_id
          where ri.product_id=pp.id
            and r.status in ('requested','confirmed','ready')
            and r.expires_at>now()
        ) reserved on true
        where pub.universe_slug='bebe-maman' and pub.active=true
          and private.naxa_bebe_maman_partner_product_allowed(pp.id)
          and pp.stock_quantity-coalesce(reserved.quantity_reserved,0)>0
      ) available
    ),
    'reservations_a_traiter',(
      select count(*)
      from (
        select 'pharmacie'::text source_type,r.id
        from public.reservations r
        join public.reservation_items ri on ri.reservation_id=r.id
        join public.pharmacie_stock_univers_publications pub
          on pub.pharmacie_id=r.pharmacie_id
          and pub.produit_id=ri.produit_id
          and pub.universe_slug='bebe-maman'
        where r.mode='reservation' and r.source_universe_slug='bebe-maman'
          and r.statut in ('en_attente','confirmee')
          and r.expires_at>now()
        group by r.id
        union all
        select 'parapharmacie'::text source_type,r.id
        from public.universe_reservations r
        join public.universe_reservation_items ri on ri.reservation_id=r.id
        join public.partner_product_univers_publications pub
          on pub.partner_id=r.partner_id
          and pub.product_id=ri.product_id
          and pub.universe_slug='bebe-maman'
        where r.universe_slug='bebe-maman'
          and r.status in ('requested','confirmed','ready')
          and r.expires_at>now()
        group by r.id
      ) all_reservations
    )
  ) into v_result;

  return v_result;
end;
$function$;

commit;
