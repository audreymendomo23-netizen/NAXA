begin;

create table if not exists public.naxa_delivery_reviews (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null unique references public.naxa_delivery_missions(id) on delete restrict,
  reservation_id uuid not null unique references public.reservations(id) on delete restrict,
  client_id uuid not null references auth.users(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  livreur_id uuid references auth.users(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  check (comment is null or length(comment)<=500)
);
create index if not exists naxa_delivery_reviews_pharmacy_idx
  on public.naxa_delivery_reviews(pharmacie_id,created_at desc);
create index if not exists naxa_delivery_reviews_courier_idx
  on public.naxa_delivery_reviews(livreur_id,created_at desc);
alter table public.naxa_delivery_reviews enable row level security;
revoke all on public.naxa_delivery_reviews from public,anon,authenticated;
grant all on public.naxa_delivery_reviews to service_role;

create or replace function public.naxa_client_delivery_review_exists(p_reservation uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'Connexion Client requise'; end if;
  return exists(
    select 1 from public.naxa_delivery_reviews r
    where r.reservation_id=p_reservation and r.client_id=v_uid
  );
end;
$function$;
revoke all on function public.naxa_client_delivery_review_exists(uuid) from public,anon;
grant execute on function public.naxa_client_delivery_review_exists(uuid) to authenticated;

create or replace function public.naxa_client_review_delivery(
  p_reservation uuid,
  p_rating smallint,
  p_comment text default null
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_comment text:=nullif(trim(coalesce(p_comment,'')),'');
begin
  if v_uid is null then raise exception 'Connexion Client requise'; end if;
  if p_rating not between 1 and 5 or length(coalesce(v_comment,''))>500 then
    raise exception 'Note ou commentaire invalide';
  end if;
  select * into v_m
  from public.naxa_delivery_missions m
  where m.reservation_id=p_reservation and m.client_id=v_uid
  for update;
  if not found or v_m.statut<>'delivered' then
    raise exception 'Vous pouvez évaluer uniquement une livraison terminée';
  end if;
  insert into public.naxa_delivery_reviews(
    mission_id,reservation_id,client_id,pharmacie_id,livreur_id,rating,comment
  ) values(
    v_m.id,v_m.reservation_id,v_uid,v_m.pharmacie_id,v_m.livreur_id,p_rating,v_comment
  );
  insert into public.notifications(pharmacie_id,type,titre,corps,reservation_id,related_entity_id)
  values(v_m.pharmacie_id,'delivery_review','Nouvel avis de livraison',
    'Le Client a évalué la livraison terminée.',v_m.reservation_id,v_m.id);
  if v_m.livreur_id is not null then
    insert into public.notifications(user_id,type,titre,corps,reservation_id,related_entity_id)
    values(v_m.livreur_id,'delivery_review','Avis reçu sur une livraison',
      'Le Client a laissé un avis après confirmation de la remise.',v_m.reservation_id,v_m.id);
  end if;
  return true;
exception when unique_violation then
  raise exception 'Un avis a déjà été envoyé pour cette livraison';
end;
$function$;
revoke all on function public.naxa_client_review_delivery(uuid,smallint,text) from public,anon;
grant execute on function public.naxa_client_review_delivery(uuid,smallint,text) to authenticated;

create or replace function public.naxa_delivery_commission_report(
  p_from date default date_trunc('month',current_date)::date,
  p_to date default current_date,
  p_pharmacie uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then
    raise exception 'Période de rapport invalide';
  end if;
  v_role:=public.naxa_business_function(v_uid);
  if not public.is_admin() and v_role<>'promoteur' then
    raise exception 'Rapport de commission réservé à l’Administration et au Promoteur';
  end if;
  if v_role='promoteur' and p_pharmacie is not null and not exists(
    select 1 from public.promoteur_pharmacies pp
    where pp.promoteur_id=v_uid and pp.pharmacie_id=p_pharmacie and pp.actif
  ) then raise exception 'Pharmacie hors réseau Promoteur'; end if;

  with scoped as (
    select l.*,ph.nom,ph.ville,coalesce(l.region,ph.region,ph.ville,'Non renseignée') as region_label
    from public.naxa_delivery_commission_ledger l
    join public.pharmacies ph on ph.id=l.pharmacie_id
    where l.delivered_at>=p_from::timestamptz
      and l.delivered_at<(p_to+1)::timestamptz
      and (p_pharmacie is null or l.pharmacie_id=p_pharmacie)
      and (
        public.is_admin()
        or (v_role='promoteur' and exists(
          select 1 from public.promoteur_pharmacies pp
          where pp.promoteur_id=v_uid and pp.pharmacie_id=l.pharmacie_id and pp.actif
        ))
      )
  ),
  by_pharmacy as (
    select pharmacie_id,nom,ville,region_label,
      count(*)::integer as livraisons,
      sum(frais_livraison_client)::integer as frais_clients,
      sum(commission_naxa)::integer as commission_acquise,
      sum(solde_livraison)::integer as solde_livraison,
      sum(case when regle_le is not null then commission_naxa else 0 end)::integer as commission_reglee,
      sum(case when regle_le is null then commission_naxa else 0 end)::integer as commission_a_regler
    from scoped group by pharmacie_id,nom,ville,region_label
  ),
  by_region as (
    select region_label,count(*)::integer as livraisons,
      sum(commission_naxa)::integer as commission_acquise
    from scoped group by region_label
  )
  select jsonb_build_object(
    'periode_du',p_from,'periode_au',p_to,
    'totaux',jsonb_build_object(
      'livraisons',coalesce((select sum(livraisons) from by_pharmacy),0),
      'frais_clients',coalesce((select sum(frais_clients) from by_pharmacy),0),
      'commission_acquise',coalesce((select sum(commission_acquise) from by_pharmacy),0),
      'commission_reglee',coalesce((select sum(commission_reglee) from by_pharmacy),0),
      'commission_a_regler',coalesce((select sum(commission_a_regler) from by_pharmacy),0),
      'solde_livraison',coalesce((select sum(solde_livraison) from by_pharmacy),0)
    ),
    'par_pharmacie',coalesce((select jsonb_agg(to_jsonb(x) order by x.commission_acquise desc) from by_pharmacy x),'[]'::jsonb),
    'par_region',coalesce((select jsonb_agg(to_jsonb(x) order by x.commission_acquise desc) from by_region x),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;
revoke all on function public.naxa_delivery_commission_report(date,date,uuid) from public,anon;
grant execute on function public.naxa_delivery_commission_report(date,date,uuid) to authenticated;

commit;
