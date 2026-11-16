-- NAXA — La réservation partenaire réapplique l'exclusion des médicaments même aux anciennes fiches.
begin;

create or replace function private.naxa_parapharmacie_partner_product_allowed(p_product uuid)
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
        !~ '\y(medicaments?|medicinal products?|pharmaceuticals?|drugs?|antibiotiques?|antipaludiques?|antitussifs?|antalgiques?|anti[- ]inflammatoires?|antihistaminiques?|antipyretiques?|antidiarrheiques?|paracetamol|acetaminophen|doliprane|efferalgan|dafalgan|panadol|calpol|ibuprofen|ibuprofene|aspirin|aspirine|amoxicillin|amoxicilline|amoxil|augmentin|coartem|nivaquine|artemether|lumefantrine|quinine|chloroquine|hydroxychloroquine|metronidazole|flagyl|ciprofloxacin|ciprofloxacine|azithromycin|azithromycine|ceftriaxone|doxycycline|metformin|metformine|diclofenac|voltaren|brufen|nurofen|omeprazole|maalox|gaviscon|smecta|cetirizine|zyrtec|loratadine|aerius|ventoline|prednisolone|prednisone|dexamethasone|tramadol|suppositoires?|sirop medicamenteux|medicinal syrup)\y'
  );
$function$;
revoke all on function private.naxa_parapharmacie_partner_product_allowed(uuid)
  from public,anon,authenticated;


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
    elsif p_universe_slug='parapharmacie'
      and not private.naxa_parapharmacie_partner_product_allowed(prod.id) then
      raise exception 'Médicament ou produit non éligible à Parapharmacie';
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
