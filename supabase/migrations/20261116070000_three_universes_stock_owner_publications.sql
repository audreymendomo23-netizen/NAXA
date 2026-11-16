-- NAXA — Destinations de publication multi-univers et réservation par propriétaire.
-- Le stock physique reste dans son ERP natif : Pharmacie => stocks, Parapharmacie => partner_products.
-- Les tables ci-dessous ne portent que des liens de publication, jamais des quantités.
begin;

create table if not exists public.pharmacie_stock_univers_publications (
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  produit_id uuid not null references public.produits(id) on delete cascade,
  universe_slug text not null check (universe_slug in ('bebe-maman','parapharmacie')),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pharmacie_id,produit_id,universe_slug)
);
create index if not exists pharmacie_stock_univers_publications_lookup_idx
  on public.pharmacie_stock_univers_publications(universe_slug,pharmacie_id,produit_id)
  where active=true;

create table if not exists public.partner_product_univers_publications (
  partner_id uuid not null references public.partners(id) on delete cascade,
  product_id uuid not null references public.partner_products(id) on delete cascade,
  universe_slug text not null check (universe_slug='bebe-maman'),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (partner_id,product_id,universe_slug)
);
create index if not exists partner_product_univers_publications_lookup_idx
  on public.partner_product_univers_publications(universe_slug,partner_id,product_id)
  where active=true;

alter table public.pharmacie_stock_univers_publications enable row level security;
alter table public.partner_product_univers_publications enable row level security;
revoke all on public.pharmacie_stock_univers_publications from public,anon,authenticated;
revoke all on public.partner_product_univers_publications from public,anon,authenticated;
grant select on public.pharmacie_stock_univers_publications to authenticated;
grant select on public.partner_product_univers_publications to authenticated;

drop policy if exists pharmacie_stock_univers_publications_staff_read
  on public.pharmacie_stock_univers_publications;
create policy pharmacie_stock_univers_publications_staff_read
on public.pharmacie_stock_univers_publications
for select to authenticated
using (
  (select public.is_admin())
  or (select private.naxa_scope_allows(auth.uid(),pharmacie_id,'PHARMACIE'))
  or (select public.naxa_has_active_professional_assignment(auth.uid(),pharmacie_id,'gestionnaire_stock'))
  or (select public.naxa_has_active_professional_assignment(auth.uid(),pharmacie_id,'magasinier'))
);
drop policy if exists partner_product_univers_publications_staff_read
  on public.partner_product_univers_publications;
create policy partner_product_univers_publications_staff_read
on public.partner_product_univers_publications
for select to authenticated
using (
  exists (
    select 1 from public.partners pa
    where pa.id=partner_product_univers_publications.partner_id
      and pa.partner_type='parapharmacie' and pa.status='active'
      and private.naxa_partner_actor_can(pa.id,'VIEW_PRODUCTS')
  )
);

-- Migration sans duplication : les anciennes publications B&M Pharmacie sont reprises
-- dans la nouvelle table de destinations, en conservant leur état.
insert into public.pharmacie_stock_univers_publications(
  pharmacie_id,produit_id,universe_slug,active,created_by,created_at,updated_at
)
select bm.pharmacie_id,bm.produit_id,'bebe-maman',bm.active,bm.created_by,bm.created_at,bm.updated_at
from public.pharmacie_bebe_maman_produits bm
join public.stocks s on s.pharmacie_id=bm.pharmacie_id and s.produit_id=bm.produit_id
on conflict(pharmacie_id,produit_id,universe_slug) do update
set active=excluded.active,updated_at=greatest(
  public.pharmacie_stock_univers_publications.updated_at,excluded.updated_at
);

create or replace function private.naxa_pharmacie_parapharmacie_product_allowed(p_produit uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select exists (
    select 1 from public.produits p
    where p.id=p_produit
      and coalesce(p.sur_ordonnance,false)=false
      and lower(extensions.unaccent(concat_ws(' ',p.nom,p.categorie,p.description,p.fabricant)))
        !~ '\\y(medicaments?|medicinal products?|pharmaceuticals?|drugs?|antibiotiques?|antipaludiques?|antitussifs?|antalgiques?|anti[- ]inflammatoires?|antihistaminiques?|antipyretiques?|antidiarrheiques?|paracetamol|acetaminophen|doliprane|efferalgan|dafalgan|panadol|calpol|ibuprofen|ibuprofene|aspirin|aspirine|amoxicillin|amoxicilline|amoxil|augmentin|coartem|nivaquine|artemether|lumefantrine|quinine|chloroquine|hydroxychloroquine|metronidazole|flagyl|ciprofloxacin|ciprofloxacine|azithromycin|azithromycine|ceftriaxone|doxycycline|metformin|metformine|diclofenac|voltaren|brufen|nurofen|omeprazole|maalox|gaviscon|smecta|cetirizine|zyrtec|loratadine|aerius|ventoline|prednisolone|prednisone|dexamethasone|tramadol|suppositoires?|sirop medicamenteux|medicinal syrup)\\y'
  );
$function$;
revoke all on function private.naxa_pharmacie_parapharmacie_product_allowed(uuid)
  from public,anon,authenticated;

create or replace function private.naxa_bebe_maman_partner_product_allowed(p_product uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select exists (
    select 1 from public.partner_products pp
    where pp.id=p_product
      and pp.universe_slug='parapharmacie'
      and lower(extensions.unaccent(concat_ws(' ',pp.name,pp.category,pp.description,pp.brand)))
        !~ '\\y(laits?\\s+(infantiles?|de croissance|pour nourrissons?|maternel|(?:1er|premier|2e|deuxieme|second)\\s+age)|preparations?\\s+infantiles?|substituts?\\s+(du\\s+)?lait\\s+maternel|cereales?\\s+infantiles?|farines?\\s+infantiles?|biberons?|tetines?|sucettes?|infant\\s+formula|baby\\s+formula|baby\\s+milks?|follow[- ]on\\s+(milk|formulas?)|growing[- ]up\\s+milks?|baby\\s+bottles?|feeding\\s+bottles?|bottles?|teats?|pacifiers?|dummies?|baby\\s+cereals?|infant\\s+(cereals?|flours?))\\y'
      and lower(extensions.unaccent(concat_ws(' ',pp.name,pp.category,pp.description,pp.brand)))
        !~ '\\y(medicaments?|medicinal products?|pharmaceuticals?|drugs?|antibiotiques?|antipaludiques?|antitussifs?|antalgiques?|anti[- ]inflammatoires?|antihistaminiques?|antipyretiques?|antidiarrheiques?|paracetamol|acetaminophen|doliprane|efferalgan|dafalgan|panadol|calpol|ibuprofen|ibuprofene|aspirin|aspirine|amoxicillin|amoxicilline|amoxil|augmentin|coartem|nivaquine|artemether|lumefantrine|quinine|chloroquine|hydroxychloroquine|metronidazole|flagyl|ciprofloxacin|ciprofloxacine|azithromycin|azithromycine|ceftriaxone|doxycycline|metformin|metformine|diclofenac|voltaren|brufen|nurofen|omeprazole|maalox|gaviscon|smecta|cetirizine|zyrtec|loratadine|aerius|ventoline|prednisolone|prednisone|dexamethasone|tramadol|suppositoires?|sirop medicamenteux|medicinal syrup)\\y'
  );
$function$;
revoke all on function private.naxa_bebe_maman_partner_product_allowed(uuid)
  from public,anon,authenticated;

create or replace function public.pharmacie_stock_destination_definir(
  p_pharmacie uuid,
  p_produit uuid,
  p_univers text,
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
  if p_pharmacie is null or p_produit is null or p_active is null
     or p_univers not in ('bebe-maman','parapharmacie') then
    raise exception 'Destination de stock invalide';
  end if;
  if private.naxa_business_function(v_user) not in (
    'promoteur','pharmacie','pharmacien','pharmacien_assistant',
    'responsable','gestionnaire_stock','magasinier'
  ) then raise exception 'Fonction professionnelle Pharmacie requise'; end if;
  if not private.naxa_scope_allows(v_user,p_pharmacie,'PHARMACIE')
     and not public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'gestionnaire_stock')
     and not public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'magasinier') then
    raise exception 'Pharmacie hors périmètre';
  end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.actif=true) then
    raise exception 'Profil inactif';
  end if;
  if not exists(select 1 from public.pharmacies ph
    where ph.id=p_pharmacie and ph.actif=true and ph.archivee_le is null) then
    raise exception 'Pharmacie inactive ou archivée';
  end if;
  if not exists(select 1 from public.stocks s
    where s.pharmacie_id=p_pharmacie and s.produit_id=p_produit) then
    raise exception 'La référence doit d’abord exister dans le stock ERP';
  end if;
  if exists(select 1 from public.produits p where p.id=p_produit
    and p.created_by_pharmacie_id is not null
    and p.created_by_pharmacie_id<>p_pharmacie) then
    raise exception 'Cette fiche appartient à une autre pharmacie';
  end if;
  if not exists(
    select 1 from public.universes u
    join public.feature_flags f on f.flag_key='universe.'||p_univers and f.enabled=true
    where u.slug=p_univers and u.enabled=true
  ) then raise exception 'Univers désactivé par l’Administration'; end if;

  if p_active then
    if p_univers='bebe-maman' then
      if not exists(select 1 from public.pharmacie_services ps
        where ps.pharmacie_id=p_pharmacie and ps.service_slug='bebe-maman'
          and ps.status='active') then
        raise exception 'Service Bébé & Maman non activé pour cette pharmacie';
      end if;
      if not private.naxa_bebe_maman_product_allowed(p_produit) then
        raise exception 'Produit exclu de Bébé & Maman';
      end if;
    elsif not private.naxa_pharmacie_parapharmacie_product_allowed(p_produit) then
      raise exception 'Médicament ou produit non éligible à Parapharmacie';
    end if;

    insert into public.pharmacie_stock_univers_publications(
      pharmacie_id,produit_id,universe_slug,active,created_by,created_at,updated_at
    ) values(p_pharmacie,p_produit,p_univers,true,v_user,now(),now())
    on conflict(pharmacie_id,produit_id,universe_slug)
    do update set active=true,updated_at=now(),created_by=coalesce(
      public.pharmacie_stock_univers_publications.created_by,excluded.created_by
    );

    -- Garder l’ancien lien B&M alimenté pendant la période de compatibilité.
    if p_univers='bebe-maman' then
      insert into public.pharmacie_bebe_maman_produits(
        pharmacie_id,produit_id,active,created_by,created_at,updated_at
      ) values(p_pharmacie,p_produit,true,v_user,now(),now())
      on conflict(pharmacie_id,produit_id)
      do update set active=true,updated_at=now();
    end if;
  else
    update public.pharmacie_stock_univers_publications
    set active=false,updated_at=now()
    where pharmacie_id=p_pharmacie and produit_id=p_produit
      and universe_slug=p_univers;
    if p_univers='bebe-maman' then
      update public.pharmacie_bebe_maman_produits
      set active=false,updated_at=now()
      where pharmacie_id=p_pharmacie and produit_id=p_produit;
    end if;
  end if;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_user,
    case when p_active then 'pharmacy.stock_universe_published' else 'pharmacy.stock_universe_unpublished' end,
    'pharmacy_stock_universe_publication',p_produit::text,
    jsonb_build_object('pharmacie_id',p_pharmacie,'universe_slug',p_univers,'active',p_active));
  return true;
end;
$function$;
revoke all on function public.pharmacie_stock_destination_definir(uuid,uuid,text,boolean)
  from public,anon;
grant execute on function public.pharmacie_stock_destination_definir(uuid,uuid,text,boolean)
  to authenticated;

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
    if not exists(select 1 from public.universes u
      join public.feature_flags f on f.flag_key='universe.bebe-maman' and f.enabled=true
      where u.slug='bebe-maman' and u.enabled=true) then
      raise exception 'Univers Bébé & Maman désactivé par l’Administration';
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

-- Le catalogue expose un propriétaire explicite. Aucun produit partenaire ne peut
-- être projeté dans Univers Pharmacie ; les deux autres univers acceptent les deux propriétaires.
create or replace function public.get_universe_catalog_v2(p_universe_slug text)
returns table(
  product_id uuid,
  owner_type text,
  owner_id uuid,
  partner_id uuid,
  pharmacie_id uuid,
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
  -- Stock natif Parapharmacie : une même ligne partner_products peut être
  -- exposée en Parapharmacie et B&M via le lien de publication uniquement.
  select pp.id,'parapharmacie'::text,pa.id,pa.id,null::uuid,pa.name,
    p_universe_slug,pp.name,pp.brand,pp.category,pp.description,pp.photo_url,
    pp.price_fcfa,
    greatest(0,pp.stock_quantity-coalesce(reserved.quantity_reserved,0)),
    pp.unit_label
  from public.partner_products pp
  join public.partners pa on pa.id=pp.partner_id
    and pa.partner_type='parapharmacie' and pa.status='active'
  join public.partner_universes pu on pu.partner_id=pa.id
    and pu.universe_slug='parapharmacie' and pu.enabled=true
  join public.universes up on up.slug='parapharmacie' and up.enabled=true
  join public.feature_flags fp on fp.flag_key='universe.parapharmacie' and fp.enabled=true
  left join lateral (
    select coalesce(sum(ri.quantity),0)::numeric quantity_reserved
    from public.universe_reservation_items ri
    join public.universe_reservations r on r.id=ri.reservation_id
    where ri.product_id=pp.id and r.status in ('requested','confirmed','ready')
      and r.expires_at>now()
  ) reserved on true
  where (
    p_universe_slug='parapharmacie'
    and pp.universe_slug='parapharmacie'
    and pp.status='active'
    and (pp.expires_at is null or pp.expires_at>=current_date)
  ) and pp.stock_quantity-coalesce(reserved.quantity_reserved,0)>0

  union all

  select pp.id,'parapharmacie'::text,pa.id,pa.id,null::uuid,pa.name,
    'bebe-maman'::text,pp.name,pp.brand,pp.category,pp.description,pp.photo_url,
    pp.price_fcfa,
    greatest(0,pp.stock_quantity-coalesce(reserved.quantity_reserved,0)),
    pp.unit_label
  from public.partner_product_univers_publications pub
  join public.partner_products pp on pp.id=pub.product_id
    and pp.partner_id=pub.partner_id and pp.universe_slug='parapharmacie'
  join public.partners pa on pa.id=pub.partner_id
    and pa.partner_type='parapharmacie' and pa.status='active'
  join public.universes ub on ub.slug='bebe-maman' and ub.enabled=true
  join public.feature_flags fb on fb.flag_key='universe.bebe-maman' and fb.enabled=true
  left join lateral (
    select coalesce(sum(ri.quantity),0)::numeric quantity_reserved
    from public.universe_reservation_items ri
    join public.universe_reservations r on r.id=ri.reservation_id
    where ri.product_id=pp.id and r.status in ('requested','confirmed','ready')
      and r.expires_at>now()
  ) reserved on true
  where p_universe_slug='bebe-maman'
    and pub.active=true and pp.status='active'
    and (pp.expires_at is null or pp.expires_at>=current_date)
    and private.naxa_bebe_maman_partner_product_allowed(pp.id)
    and pp.stock_quantity-coalesce(reserved.quantity_reserved,0)>0

  union all

  select p.id,'pharmacie'::text,ph.id,null::uuid,ph.id,ph.nom,
    p_universe_slug,p.nom,p.fabricant,coalesce(nullif(trim(p.categorie),''),'Autres'),
    p.description,p.photo_url,s.prix,coalesce(offer.quantite,0)::numeric,
    coalesce(nullif(trim(p.conditionnement),''),'unité')
  from public.stocks s
  join public.pharmacies ph on ph.id=s.pharmacie_id
    and ph.actif=true and ph.visible_recherche=true and ph.est_demo=false
    and ph.archivee_le is null
  join public.produits p on p.id=s.produit_id
  left join lateral private.marketplace_offre_stock_disponible_guarded(
    s.pharmacie_id,s.produit_id
  ) offer on true
  left join public.pharmacie_stock_univers_publications pub
    on pub.pharmacie_id=s.pharmacie_id and pub.produit_id=s.produit_id
    and pub.universe_slug=p_universe_slug and pub.active=true
  left join public.pharmacie_services ps
    on ps.pharmacie_id=ph.id and ps.service_slug='bebe-maman' and ps.status='active'
  where (
    p_universe_slug='pharmacie'
    or (
      p_universe_slug='bebe-maman' and pub.active=true and ps.pharmacie_id is not null
      and private.naxa_bebe_maman_product_allowed(p.id)
    )
    or (
      p_universe_slug='parapharmacie' and pub.active=true
      and private.naxa_pharmacie_parapharmacie_product_allowed(p.id)
    )
  )
    and coalesce(offer.quantite,0)>0
    and (p.created_by_pharmacie_id is null or p.created_by_pharmacie_id=ph.id)
    and (p_universe_slug='pharmacie' or exists (
      select 1 from public.universes u
      join public.feature_flags f on f.flag_key='universe.'||p_universe_slug and f.enabled=true
      where u.slug=p_universe_slug and u.enabled=true
    ))
  order by universe_slug,category,name,partner_name;
$function$;
revoke all on function public.get_universe_catalog_v2(text) from public;
grant execute on function public.get_universe_catalog_v2(text) to anon,authenticated,service_role;

-- Une réservation partenaire B&M référence toujours le produit Parapharmacie canonique.
-- Le stock n'est débité qu'au retrait par le moteur partenaire existant.
create or replace function private.naxa_block_legacy_bebe_maman_reservations()
returns trigger
language plpgsql
set search_path=''
as $function$
begin
  if tg_op='INSERT' and new.universe_slug='bebe-maman' then
    if not exists(
      select 1 from public.partners pa
      where pa.id=new.partner_id and pa.partner_type='parapharmacie' and pa.status='active'
    ) then
      raise exception 'Seules les Parapharmacies peuvent traiter une réservation partenaire Bébé & Maman';
    end if;
  end if;
  if tg_op='UPDATE' and (
    old.universe_slug='bebe-maman' or new.universe_slug='bebe-maman'
  ) and old.universe_slug is distinct from new.universe_slug then
    raise exception 'Le rattachement historique Bébé & Maman ne peut pas être modifié';
  end if;
  return new;
end;
$function$;
revoke all on function private.naxa_block_legacy_bebe_maman_reservations()
  from public,anon,authenticated;
drop trigger if exists naxa_block_legacy_bebe_maman_reservations
  on public.universe_reservations;
create trigger naxa_block_legacy_bebe_maman_reservations
before insert or update of universe_slug on public.universe_reservations
for each row execute function private.naxa_block_legacy_bebe_maman_reservations();

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

-- Réservation d'un stock de Pharmacie publié en Parapharmacie ou B&M :
-- même ledger ERP, lots/FEFO, hold et règlement que toutes les autres offres pharmacie.
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
  if p_pharmacie is null or p_universe_slug not in ('bebe-maman','parapharmacie')
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>20 then
    raise exception 'Panier ou destination invalide';
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
      ) or not private.naxa_bebe_maman_product_allowed((x->>'product_id')::uuid)
    ) then raise exception 'Article non publié ou non éligible à Bébé & Maman'; end if;
  else
    if exists(
      select 1 from jsonb_array_elements(p_items) x
      where not exists(
        select 1 from public.pharmacie_stock_univers_publications pub
        where pub.pharmacie_id=p_pharmacie
          and pub.produit_id=(x->>'product_id')::uuid
          and pub.universe_slug='parapharmacie' and pub.active=true
      ) or not private.naxa_pharmacie_parapharmacie_product_allowed((x->>'product_id')::uuid)
    ) then raise exception 'Article non publié ou non éligible à Parapharmacie'; end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'produit_id',x->>'product_id','quantite',(x->>'quantity')::integer
  ) order by x->>'product_id'),'[]'::jsonb)
  into v_items from jsonb_array_elements(p_items) x;
  v_id:=private.reserve_stock(p_pharmacie,v_items);
  v_expire:=now()+interval '4 hours';
  update public.reservations
  set mode='reservation',paiement_statut='a_verifier',paiement_mode='a_convenir',
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

-- Commande B&M multi-propriétaires : l'appel est atomique et chaque sous-groupe
-- est routé vers son moteur natif dans la même transaction.
create or replace function public.creer_reservations_bebe_maman_multi_proprietaires_client(
  p_groups jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_group jsonb;
  v_owner_type text;
  v_owner_id uuid;
  v_items jsonb;
  v_pharmacy_groups jsonb:='[]'::jsonb;
  v_result jsonb:='[]'::jsonb;
  v_pharmacy_result jsonb;
  v_reservation uuid;
  v_expire timestamptz;
  v_group_count integer;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from public.profiles p
    where p.id=v_user and p.role='client' and p.actif=true) then
    raise exception 'Compte Client actif requis';
  end if;
  if p_groups is null or jsonb_typeof(p_groups) is distinct from 'array'
     or jsonb_array_length(p_groups)<1 or jsonb_array_length(p_groups)>10 then
    raise exception 'Groupes de réservation invalides';
  end if;
  if exists(
    select 1
    from jsonb_array_elements(p_groups) g
    group by g->>'owner_type',g->>'owner_id'
    having count(*)>1
  ) then raise exception 'Un seul groupe par propriétaire est autorisé'; end if;

  select count(*) into v_group_count
  from jsonb_array_elements(p_groups) g
  where g->>'owner_type'='pharmacie';
  if v_group_count>0 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'pharmacie_id',g->>'owner_id','items',g->'items'
    ) order by g->>'owner_id'),'[]'::jsonb)
    into v_pharmacy_groups
    from jsonb_array_elements(p_groups) g
    where g->>'owner_type'='pharmacie';
    v_pharmacy_result:=public.creer_reservations_bebe_maman_client(v_pharmacy_groups);
    v_result:=v_result||v_pharmacy_result;
  end if;

  for v_group in
    select g from jsonb_array_elements(p_groups) g
    where g->>'owner_type'='parapharmacie'
    order by g->>'owner_id'
  loop
    if coalesce(v_group->>'owner_id','') !~* '^[0-9a-f-]{36}$'
       or jsonb_typeof(v_group->'items') is distinct from 'array'
       or jsonb_array_length(v_group->'items')<1
       or jsonb_array_length(v_group->'items')>10 then
      raise exception 'Groupe Parapharmacie invalide';
    end if;
    v_owner_id:=(v_group->>'owner_id')::uuid;
    select coalesce(jsonb_agg(jsonb_build_object(
      'product_id',x->>'produit_id','quantity',(x->>'quantite')::integer
    ) order by x->>'produit_id'),'[]'::jsonb)
    into v_items from jsonb_array_elements(v_group->'items') x;
    v_reservation:=public.reserve_universe_products(
      v_owner_id,'bebe-maman',v_items,null
    );
    select r.expires_at into v_expire
    from public.universe_reservations r where r.id=v_reservation;
    v_result:=v_result||jsonb_build_array(jsonb_build_object(
      'id',v_reservation,'mode','partner','owner_type','parapharmacie',
      'owner_id',v_owner_id,'partner_id',v_owner_id,'expires_at',v_expire
    ));
  end loop;

  if jsonb_array_length(v_result)<>jsonb_array_length(p_groups) then
    raise exception 'Un propriétaire de réservation est invalide ou manquant';
  end if;
  return v_result;
end;
$function$;
revoke all on function public.creer_reservations_bebe_maman_multi_proprietaires_client(jsonb)
  from public,anon;
grant execute on function public.creer_reservations_bebe_maman_multi_proprietaires_client(jsonb)
  to authenticated;

commit;
