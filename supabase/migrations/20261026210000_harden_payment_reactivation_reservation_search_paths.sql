begin;

create or replace function private.declare_payment(p_id uuid, p_ref text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.reservations
     set paiement_ref = p_ref
   where id = p_id
     and client_id = auth.uid()
     and statut in ('en_attente', 'confirmee');

  if not found then
    raise exception 'Réservation introuvable ou close';
  end if;
end
$function$;

create or replace function private.reactiver_pharmacie(p_pharmacie uuid, p_reference text default null)
returns date
language plpgsql
security definer
set search_path = ''
as $function$
declare
  a public.abonnements;
  v_fin date;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à NAXA';
  end if;

  select * into a
    from public.abonnements
   where pharmacie_id = p_pharmacie
   for update;

  if not found then
    insert into public.abonnements(pharmacie_id, formule, montant_mensuel, debut, echeance, statut)
    values (p_pharmacie, 'essentiel', 30000, current_date,
            current_date + interval '1 month' - interval '1 day', 'actif')
    returning * into a;

    insert into public.abonnement_paiements(abonnement_id, pharmacie_id, periode_du, periode_au, montant, reference, enregistre_par)
    values (a.id, p_pharmacie, current_date, a.echeance, 30000,
            nullif(trim(coalesce(p_reference, '')), ''), auth.uid());
  else
    v_fin := current_date + interval '1 month' - interval '1 day';

    update public.abonnements
       set statut = 'actif',
           montant_mensuel = 30000,
           debut = current_date,
           echeance = v_fin,
           fin = v_fin,
           rappel_5j_envoye_at = null,
           dernier_paiement_le = now(),
           dernier_paiement_ref = nullif(trim(coalesce(p_reference, '')), ''),
           bloque_le = null,
           reactive_le = now(),
           reactive_par = auth.uid()
     where id = a.id;

    insert into public.abonnement_paiements(abonnement_id, pharmacie_id, periode_du, periode_au, montant, reference, enregistre_par)
    values (a.id, p_pharmacie, current_date, v_fin, 30000,
            nullif(trim(coalesce(p_reference, '')), ''), auth.uid());
  end if;

  update public.pharmacies set actif = true where id = p_pharmacie;
  update public.profiles
     set actif = true
   where pharmacie_id = p_pharmacie
     and role in ('promoteur', 'caisse', 'pharmacie');

  return coalesce(v_fin, a.echeance);
end
$function$;

create or replace function private.reserve_stock(p_pharmacie uuid, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
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
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;

  if not exists(select 1 from public.pharmacies where id = p_pharmacie and actif) then
    raise exception 'Pharmacie indisponible';
  end if;

  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 10 then
    raise exception 'Panier invalide';
  end if;

  if exists (
    select 1
      from (select value->>'produit_id' pid, count(*) n
              from jsonb_array_elements(p_items) group by value->>'produit_id') x
     where x.n > 1
  ) then
    raise exception 'Produit dupliqué dans le panier';
  end if;

  for it in
    select value from jsonb_array_elements(p_items)
     order by (value->>'produit_id')::uuid
  loop
    v_produit := (it->>'produit_id')::uuid;
    v_q := coalesce((it->>'quantite')::integer, 1);
    if v_q < 1 or v_q > 10 then
      raise exception 'Quantité invalide';
    end if;

    select s.quantite, s.prix into v_stock, v_prix
      from public.stocks s
     where s.pharmacie_id = p_pharmacie
       and s.produit_id = v_produit
       and (s.date_peremption is null or s.date_peremption >= current_date)
     for update;

    if not found then
      raise exception 'Produit absent ou périmé';
    end if;

    select coalesce(sum(ri.quantite), 0)::integer into v_reserved
      from public.reservation_items ri
      join public.reservations r on r.id = ri.reservation_id
     where r.pharmacie_id = p_pharmacie
       and ri.produit_id = v_produit
       and r.statut in ('en_attente', 'confirmee')
       and r.expires_at > now()
       and r.consumed_at is null
       and r.stock_restored = false
       and r.stock_decremented = false;

    if v_stock - v_reserved < v_q then
      raise exception 'Stock disponible insuffisant après réservations actives';
    end if;
    v_total := v_total + v_prix * v_q;
  end loop;

  insert into public.reservations(client_id, pharmacie_id, expires_at, stock_decremented, stock_restored)
  values (auth.uid(), p_pharmacie, now() + interval '3 hours', false, false)
  returning id into v_id;

  for it in
    select value from jsonb_array_elements(p_items)
     order by (value->>'produit_id')::uuid
  loop
    v_produit := (it->>'produit_id')::uuid;
    v_q := coalesce((it->>'quantite')::integer, 1);

    select s.prix into v_prix
      from public.stocks s
     where s.pharmacie_id = p_pharmacie
       and s.produit_id = v_produit;

    insert into public.reservation_items(reservation_id, produit_id, quantite, prix_unitaire)
    values (v_id, v_produit, v_q, v_prix);
  end loop;

  update public.reservations set total = v_total where id = v_id;
  return v_id;
end
$function$;

alter function private.search_pharmacies_panier(jsonb,double precision,double precision,double precision) set search_path = '';

commit;
