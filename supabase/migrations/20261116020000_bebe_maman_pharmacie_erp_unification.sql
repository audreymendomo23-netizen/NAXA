-- NAXA — Bébé & Maman : catalogue, stock et réservations rattachés à l'ERP Pharmacie.
-- Aucun catalogue partenaire parallèle, aucun stock fictif, aucune validation Admin des fiches.
begin;

create table if not exists public.pharmacie_bebe_maman_produits (
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  produit_id uuid not null references public.produits(id) on delete cascade,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pharmacie_id, produit_id)
);
create index if not exists pharmacie_bebe_maman_produits_active_idx
  on public.pharmacie_bebe_maman_produits(pharmacie_id, produit_id)
  where active=true;
alter table public.pharmacie_bebe_maman_produits enable row level security;
revoke all on public.pharmacie_bebe_maman_produits from public, anon, authenticated;

create or replace function private.naxa_bebe_maman_product_allowed(p_produit uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select exists (
    select 1
    from public.produits p
    where p.id=p_produit
      and coalesce(p.sur_ordonnance,false)=false
      and not (
        lower(extensions.unaccent(concat_ws(' ',p.nom,p.categorie,p.description,p.fabricant)))
        ~ '\y(laits?\s+(infantiles?|de croissance|pour nourrissons?|maternel|(?:1er|premier|2e|deuxieme|second)\s+age)|preparations?\s+infantiles?|substituts?\s+(du\s+)?lait\s+maternel|cereales?\s+infantiles?|farines?\s+infantiles?|biberons?|tetines?|sucettes?|infant\s+formula|baby\s+formula|baby\s+milks?|follow[- ]on\s+(milk|formulas?)|growing[- ]up\s+milks?|baby\s+bottles?|feeding\s+bottles?|bottles?|teats?|pacifiers?|dummies?|baby\s+cereals?|infant\s+(cereals?|flours?))\y'
      )
      and not (
        lower(extensions.unaccent(concat_ws(' ',p.nom,p.categorie,p.description,p.fabricant)))
        ~ '\y(medicaments?|medicinal products?|pharmaceuticals?|drugs?|antibiotiques?|antipaludiques?|antitussifs?|antalgiques?|anti[- ]inflammatoires?|antihistaminiques?|antipyretiques?|antidiarrheiques?|paracetamol|acetaminophen|doliprane|efferalgan|dafalgan|panadol|calpol|ibuprofen|ibuprofene|aspirin|aspirine|amoxicillin|amoxicilline|amoxil|augmentin|coartem|nivaquine|artemether|lumefantrine|quinine|chloroquine|hydroxychloroquine|metronidazole|flagyl|ciprofloxacin|ciprofloxacine|azithromycin|azithromycine|ceftriaxone|doxycycline|metformin|metformine|diclofenac|voltaren|brufen|nurofen|omeprazole|maalox|gaviscon|smecta|cetirizine|zyrtec|loratadine|aerius|ventoline|prednisolone|prednisone|dexamethasone|tramadol|suppositoires?|sirop medicamenteux|medicinal syrup)\y'
      )
  );
$function$;
revoke all on function private.naxa_bebe_maman_product_allowed(uuid) from public, anon, authenticated;

-- La même RPC catalogue conserve Parapharmacie sur son modèle partenaire,
-- mais Bébé & Maman lit désormais les fiches et stocks ERP de pharmacies.
create or replace function private.get_universe_catalog(p_universe_slug text)
returns table(
  product_id uuid,
  partner_id uuid,
  partner_name text,
  universe_slug text,
  name text,
  brand text,
  category text,
  description text,
  photo_url text,
  price_fcfa integer,
  available_quantity numeric,
  unit_label text
)
language sql
stable
security definer
set search_path=''
as $function$
  select
    pp.id,pa.id,pa.name,pp.universe_slug,pp.name,pp.brand,pp.category,
    pp.description,pp.photo_url,pp.price_fcfa,
    greatest(0,pp.stock_quantity-coalesce(reserved.quantity_reserved,0)),
    pp.unit_label
  from public.partner_products pp
  join public.partners pa on pa.id=pp.partner_id and pa.status='active'
  join public.partner_universes pu on pu.partner_id=pa.id
    and pu.universe_slug=pp.universe_slug and pu.enabled=true
  join public.universes u on u.slug=pp.universe_slug and u.enabled=true
  join public.feature_flags ff on ff.flag_key='universe.'||pp.universe_slug and ff.enabled=true
  left join lateral (
    select sum(ri.quantity)::numeric quantity_reserved
    from public.universe_reservation_items ri
    join public.universe_reservations r on r.id=ri.reservation_id
    where ri.product_id=pp.id and r.status in ('requested','confirmed','ready')
      and r.expires_at>now()
  ) reserved on true
  where p_universe_slug='parapharmacie'
    and pp.universe_slug='parapharmacie'
    and pp.status='active'
    and (pp.expires_at is null or pp.expires_at>=current_date)
    and pp.stock_quantity-coalesce(reserved.quantity_reserved,0)>0

  union all

  select
    p.id,
    ph.id,
    ph.nom,
    'bebe-maman'::text,
    p.nom,
    p.fabricant,
    coalesce(nullif(trim(p.categorie),''),'Autres'),
    p.description,
    p.photo_url,
    s.prix,
    coalesce(offer.quantite,0)::numeric,
    coalesce(nullif(trim(p.conditionnement),''),'unité')
  from public.pharmacie_bebe_maman_produits bm
  join public.pharmacies ph on ph.id=bm.pharmacie_id
    and ph.actif=true and ph.visible_recherche=true
    and ph.est_demo=false and ph.archivee_le is null
  join public.pharmacie_services ps on ps.pharmacie_id=ph.id
    and ps.service_slug='bebe-maman' and ps.status='active'
  join public.universes u on u.slug='bebe-maman' and u.enabled=true
  join public.feature_flags ff on ff.flag_key='universe.bebe-maman' and ff.enabled=true
  join public.stocks s on s.pharmacie_id=ph.id and s.produit_id=bm.produit_id
  join public.produits p on p.id=bm.produit_id
  left join lateral private.marketplace_offre_stock_disponible_guarded(
    ph.id,p.id
  ) offer on true
  where p_universe_slug='bebe-maman'
    and bm.active=true
    and private.naxa_bebe_maman_product_allowed(p.id)
  order by 4,7,5,3;
$function$;

create or replace function public.pharmacie_bebe_maman_produit_definir(
  p_pharmacie uuid,
  p_produit uuid,
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
  if p_pharmacie is null or p_produit is null or p_active is null then
    raise exception 'Pharmacie, produit et action obligatoires';
  end if;
  if private.naxa_business_function(v_user) not in (
    'promoteur','pharmacie','pharmacien','pharmacien_assistant',
    'responsable','gestionnaire_stock','magasinier'
  ) then
    raise exception 'Fonction professionnelle Pharmacie requise';
  end if;
  if not private.naxa_scope_allows(v_user,p_pharmacie,'PHARMACIE')
     and not public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'gestionnaire_stock')
     and not public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'magasinier') then
    raise exception 'Pharmacie hors périmètre';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id=v_user and p.actif=true
  ) then raise exception 'Profil inactif'; end if;
  if not exists (
    select 1 from public.pharmacies ph
    where ph.id=p_pharmacie and ph.actif=true and ph.archivee_le is null
  ) then raise exception 'Pharmacie inactive ou archivée'; end if;

  if p_active then
    if not exists (
      select 1 from public.universes u
      join public.feature_flags f on f.flag_key='universe.bebe-maman' and f.enabled=true
      where u.slug='bebe-maman' and u.enabled=true
    ) then raise exception 'Univers Bébé & Maman désactivé par l’Administration'; end if;
    if not exists (
      select 1 from public.pharmacie_services ps
      where ps.pharmacie_id=p_pharmacie
        and ps.service_slug='bebe-maman' and ps.status='active'
    ) then raise exception 'Service Bébé & Maman non activé pour cette pharmacie'; end if;
    if not exists (
      select 1 from public.stocks s
      where s.pharmacie_id=p_pharmacie and s.produit_id=p_produit
    ) then raise exception 'Initialisez d’abord la référence dans le stock ERP de cette pharmacie'; end if;
    if not private.naxa_bebe_maman_product_allowed(p_produit) then
      raise exception 'Produit exclu de Bébé & Maman (médicament ou catégorie interdite)';
    end if;
    if exists (
      select 1 from public.produits p
      where p.id=p_produit
        and p.created_by_pharmacie_id is not null
        and p.created_by_pharmacie_id<>p_pharmacie
    ) then raise exception 'Cette fiche appartient à une autre pharmacie'; end if;

    insert into public.pharmacie_bebe_maman_produits(
      pharmacie_id,produit_id,active,created_by,created_at,updated_at
    ) values(p_pharmacie,p_produit,true,v_user,now(),now())
    on conflict(pharmacie_id,produit_id)
    do update set active=true,updated_at=now();
  else
    update public.pharmacie_bebe_maman_produits
    set active=false,updated_at=now()
    where pharmacie_id=p_pharmacie and produit_id=p_produit;
  end if;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(
    v_user,
    case when p_active then 'pharmacy.bebe_maman_product_enabled' else 'pharmacy.bebe_maman_product_disabled' end,
    'pharmacie_bebe_maman_produit',
    p_produit::text,
    jsonb_build_object('pharmacie_id',p_pharmacie,'active',p_active)
  );
  return true;
end;
$function$;
revoke all on function public.pharmacie_bebe_maman_produit_definir(uuid,uuid,boolean) from public,anon;
grant execute on function public.pharmacie_bebe_maman_produit_definir(uuid,uuid,boolean) to authenticated;

-- Toutes les demandes Bébé & Maman deviennent des réservations Pharmacie standards,
-- atomiques par groupe de pharmacie, avec les mêmes holds, lots, péremptions et délais.
create or replace function public.creer_reservations_bebe_maman_client(p_groups jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
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
revoke all on function public.creer_reservations_bebe_maman_client(jsonb) from public,anon;
grant execute on function public.creer_reservations_bebe_maman_client(jsonb) to authenticated;

create or replace function public.admin_bebe_maman_supervision()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Consultation réservée à l’Administrateur actif';
  end if;
  select jsonb_build_object(
    'pharmacies_service_actif',(
      select count(*) from public.pharmacie_services ps
      join public.pharmacies ph on ph.id=ps.pharmacie_id
      where ps.service_slug='bebe-maman' and ps.status='active'
        and ph.actif=true and ph.archivee_le is null
    ),
    'references_publiees',(
      select count(*) from public.pharmacie_bebe_maman_produits bm
      where bm.active=true
    ),
    'offres_disponibles',(
      select count(*) from public.pharmacie_bebe_maman_produits bm
      join public.stocks s on s.pharmacie_id=bm.pharmacie_id and s.produit_id=bm.produit_id
      cross join lateral private.marketplace_offre_stock_disponible_guarded(
        bm.pharmacie_id,bm.produit_id
      ) offer
      where bm.active=true and offer.quantite>0
    ),
    'reservations_a_traiter',(
      select count(distinct r.id) from public.reservations r
      join public.reservation_items ri on ri.reservation_id=r.id
      join public.pharmacie_bebe_maman_produits bm
        on bm.pharmacie_id=r.pharmacie_id and bm.produit_id=ri.produit_id
        and bm.active=true
      where r.mode='reservation' and r.statut in ('en_attente','confirmee')
        and r.expires_at>now()
    )
  ) into v_result;
  return v_result;
end;
$function$;
revoke all on function public.admin_bebe_maman_supervision() from public,anon;
grant execute on function public.admin_bebe_maman_supervision() to authenticated;

commit;
