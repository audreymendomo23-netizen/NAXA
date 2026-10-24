-- NAXA 242 — aligner la création des réservations du replay sur les holds modernes.
-- Le stock physique n'est pas débité à la réservation; la caisse le consomme une seule fois.
begin;

create or replace function private.reserve_stock(p_pharmacie uuid, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_id uuid;
  it jsonb;
  v_total integer := 0;
  v_prix integer;
  v_q integer;
  v_produit uuid;
  v_stock integer;
  v_reserved integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from public.pharmacies where id=p_pharmacie and actif) then
    raise exception 'Pharmacie indisponible';
  end if;
  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 10 then
    raise exception 'Panier invalide';
  end if;
  if exists(
    select 1
    from (select value->>'produit_id' pid, count(*) n
          from jsonb_array_elements(p_items) group by value->>'produit_id') x
    where x.n > 1
  ) then raise exception 'Produit dupliqué dans le panier'; end if;

  -- Lock products in deterministic order to serialize concurrent reservations
  -- against both other reservations and cash-register stock mutations.
  for it in
    select value from jsonb_array_elements(p_items)
    order by (value->>'produit_id')::uuid
  loop
    v_produit := (it->>'produit_id')::uuid;
    v_q := coalesce((it->>'quantite')::integer, 1);
    if v_q < 1 or v_q > 10 then raise exception 'Quantité invalide'; end if;

    select s.quantite, s.prix into v_stock, v_prix
    from public.stocks s
    where s.pharmacie_id=p_pharmacie and s.produit_id=v_produit
      and (s.date_peremption is null or s.date_peremption >= current_date)
    for update;
    if not found then raise exception 'Produit absent ou périmé'; end if;

    select coalesce(sum(ri.quantite),0)::integer into v_reserved
    from public.reservation_items ri
    join public.reservations r on r.id=ri.reservation_id
    where r.pharmacie_id=p_pharmacie
      and ri.produit_id=v_produit
      and r.statut in ('en_attente','confirmee')
      and r.expires_at > now()
      and r.consumed_at is null
      and r.stock_restored = false
      and r.stock_decremented = false;

    if v_stock - v_reserved < v_q then
      raise exception 'Stock disponible insuffisant après réservations actives';
    end if;
    v_total := v_total + v_prix * v_q;
  end loop;

  insert into public.reservations(client_id,pharmacie_id,expires_at,stock_decremented,stock_restored)
  values(auth.uid(),p_pharmacie,now()+interval '3 hours',false,false)
  returning id into v_id;

  for it in
    select value from jsonb_array_elements(p_items)
    order by (value->>'produit_id')::uuid
  loop
    v_produit := (it->>'produit_id')::uuid;
    v_q := coalesce((it->>'quantite')::integer,1);
    select s.prix into v_prix from public.stocks s
      where s.pharmacie_id=p_pharmacie and s.produit_id=v_produit;
    insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
    values(v_id,v_produit,v_q,v_prix);
  end loop;

  update public.reservations set total=v_total where id=v_id;
  return v_id;
end;
$function$;


revoke all on function private.reserve_stock(uuid,jsonb) from public, anon;
grant execute on function private.reserve_stock(uuid,jsonb) to authenticated;

create or replace function public.reserve_stock(p_pharmacie uuid, p_items jsonb)
returns uuid
language sql
set search_path = ''
as $function$
  select private.reserve_stock($1, $2)
$function$;

revoke all on function public.reserve_stock(uuid,jsonb) from public, anon;
grant execute on function public.reserve_stock(uuid,jsonb) to authenticated;
comment on function public.reserve_stock(uuid,jsonb) is
  'Crée une réservation Marketplace comme hold temporaire sans débiter le stock physique; la caisse consomme le stock lors du paiement.';

commit;
