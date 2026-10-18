-- NAXA 094 — transactions client, commandes avec livraison et historique vérifiable.
-- Ajout uniquement : conserve les réservations et données historiques existantes.
begin;

alter table public.reservations
  add column if not exists mode text not null default 'reservation',
  add column if not exists paiement_statut text not null default 'a_verifier',
  add column if not exists paiement_mode text,
  add column if not exists commande_statut text,
  add column if not exists adresse_livraison text,
  add column if not exists quartier_livraison text,
  add column if not exists ville_livraison text,
  add column if not exists repere_livraison text,
  add column if not exists telephone_livraison text,
  add column if not exists latitude_livraison double precision,
  add column if not exists longitude_livraison double precision,
  add column if not exists frais_livraison integer not null default 0;

do $constraints$
begin
  if not exists (select 1 from pg_constraint where conname='reservations_mode_check') then
    alter table public.reservations add constraint reservations_mode_check check (mode in ('reservation','commande'));
  end if;
  if not exists (select 1 from pg_constraint where conname='reservations_paiement_statut_check') then
    alter table public.reservations add constraint reservations_paiement_statut_check check (paiement_statut in ('a_verifier','effectue'));
  end if;
  if not exists (select 1 from pg_constraint where conname='reservations_paiement_mode_check') then
    alter table public.reservations add constraint reservations_paiement_mode_check check (paiement_mode is null or paiement_mode in ('mtn_marchand','orange_money','especes_retrait','especes_livraison','a_convenir'));
  end if;
  if not exists (select 1 from pg_constraint where conname='reservations_commande_statut_check') then
    alter table public.reservations add constraint reservations_commande_statut_check check (commande_statut is null or commande_statut in ('en_attente_pharmacie','acceptee','preparation','livreur_assigne','en_livraison','livree','annulee'));
  end if;
  if not exists (select 1 from pg_constraint where conname='reservations_frais_livraison_check') then
    alter table public.reservations add constraint reservations_frais_livraison_check check (frais_livraison >= 0);
  end if;
end;
$constraints$;

update public.reservations set paiement_statut='effectue' where statut in ('payee','retiree');
create index if not exists reservations_client_mode_created_idx on public.reservations(client_id,mode,created_at desc);
create index if not exists reservations_pharmacie_commandes_idx on public.reservations(pharmacie_id,commande_statut,created_at desc) where mode='commande';

create table if not exists public.reservation_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  event_type text not null,
  from_statut public.resa_statut,
  to_statut public.resa_statut,
  paiement_ref text,
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null
);
alter table public.reservation_events add column if not exists detail jsonb not null default '{}'::jsonb;
alter table public.reservation_events drop constraint if exists reservation_events_event_type_check;
alter table public.reservation_events add constraint reservation_events_event_type_check check (event_type in ('reservation_created','status_changed','payment_declared','delivery_status_changed','payment_verified'));
create index if not exists reservation_events_client_idx on public.reservation_events(client_id,occurred_at desc);
create index if not exists reservation_events_pharmacy_idx on public.reservation_events(pharmacie_id,occurred_at desc);
create index if not exists reservation_events_reservation_idx on public.reservation_events(reservation_id,occurred_at desc);
alter table public.reservation_events enable row level security;
drop policy if exists reservation_events_client_read on public.reservation_events;
create policy reservation_events_client_read on public.reservation_events for select to authenticated using (client_id=(select auth.uid()));
drop policy if exists reservation_events_pharmacie_read on public.reservation_events;
create policy reservation_events_pharmacie_read on public.reservation_events for select to authenticated using (public.is_admin() or public.naxa_scope_allows((select auth.uid()),pharmacie_id,'PHARMACIE'));
revoke all on public.reservation_events from anon,public;
grant select on public.reservation_events to authenticated;

create or replace function public.log_reservation_event()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  if tg_op='INSERT' then
    insert into public.reservation_events(reservation_id,client_id,pharmacie_id,event_type,to_statut,paiement_ref,detail,actor_id)
    values(new.id,new.client_id,new.pharmacie_id,'reservation_created',new.statut,new.paiement_ref,jsonb_build_object('mode',new.mode,'total',new.total,'expires_at',new.expires_at),auth.uid());
    if new.paiement_ref is not null then
      insert into public.reservation_events(reservation_id,client_id,pharmacie_id,event_type,to_value,detail,actor_id)
      values(new.id,new.client_id,new.pharmacie_id,'payment_declared',new.paiement_ref,'{}'::jsonb,auth.uid());
    end if;
    return new;
  end if;
  if new.statut is distinct from old.statut then
    insert into public.reservation_events(reservation_id,client_id,pharmacie_id,event_type,from_statut,to_statut,paiement_ref,detail,actor_id)
    values(new.id,new.client_id,new.pharmacie_id,'status_changed',old.statut,new.statut,new.paiement_ref,jsonb_build_object('mode',new.mode),auth.uid());
  end if;
  if new.statut in ('annulee','expiree') and new.mode='commande' and new.commande_statut is distinct from 'annulee' then
    update public.reservations set commande_statut='annulee' where id=new.id and commande_statut is distinct from 'annulee';
  end if;
  if new.paiement_ref is distinct from old.paiement_ref and new.paiement_ref is not null then
    insert into public.reservation_events(reservation_id,client_id,pharmacie_id,event_type,paiement_ref,detail,actor_id)
    values(new.id,new.client_id,new.pharmacie_id,'payment_declared',new.paiement_ref,'{}'::jsonb,auth.uid());
  end if;
  if new.paiement_statut is distinct from old.paiement_statut and new.paiement_statut='effectue' then
    insert into public.reservation_events(reservation_id,client_id,pharmacie_id,event_type,paiement_ref,detail,actor_id)
    values(new.id,new.client_id,new.pharmacie_id,'payment_verified',new.paiement_ref,jsonb_build_object('from',old.paiement_statut,'to',new.paiement_statut,'payment_mode',new.paiement_mode),auth.uid());
  end if;
  if new.commande_statut is distinct from old.commande_statut then
    insert into public.reservation_events(reservation_id,client_id,pharmacie_id,event_type,paiement_ref,detail,actor_id)
    values(new.id,new.client_id,new.pharmacie_id,'delivery_status_changed',new.paiement_ref,jsonb_build_object('from',old.commande_statut,'to',new.commande_statut),auth.uid());
  end if;
  return new;
end;
$function$;
revoke all on function public.log_reservation_event() from public,anon,authenticated;
drop trigger if exists trg_reservation_event_history on public.reservations;
drop trigger if exists trg_naxa_reservation_event_history on public.reservations;
create trigger trg_naxa_reservation_event_history after insert or update of statut,paiement_ref,paiement_statut,commande_statut on public.reservations for each row execute function public.log_reservation_event();

create or replace function public.creer_transactions_client(
  p_pharmacie uuid,
  p_items jsonb,
  p_paiement_mode text,
  p_adresse jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  v_user uuid := auth.uid();
  v_mode text;
  v_items jsonb;
  v_id uuid;
  v_expire timestamptz;
  v_result jsonb := '[]'::jsonb;
  v_anonyme boolean := true;
  v_adresse jsonb := coalesce(p_adresse,'{}'::jsonb);
  v_ville text;
  v_quartier text;
  v_rue text;
  v_telephone text;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.role='client' and p.actif) then raise exception 'Compte client requis'; end if;
  if not exists(select 1 from public.pharmacies p where p.id=p_pharmacie and p.actif and p.visible_recherche and p.archivee_le is null) then raise exception 'Pharmacie indisponible'; end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>10 then raise exception 'Panier invalide'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) x where coalesce(x->>'mode','') not in ('reservation','commande') or coalesce((x->>'quantite')::int,0) not between 1 and 10 or coalesce(x->>'produit_id','') !~* '^[0-9a-f-]{36}$') then raise exception 'Article ou quantité invalide'; end if;
  if exists(select 1 from (select x->>'produit_id' pid,count(*) n from jsonb_array_elements(p_items) x group by x->>'produit_id' having count(*)>1) d) then raise exception 'Chaque médicament doit apparaître une seule fois dans le panier'; end if;
  if coalesce(p_paiement_mode,'') not in ('mtn_marchand','orange_money','especes_retrait','especes_livraison','a_convenir') then raise exception 'Mode de paiement invalide'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) x where x->>'mode'='commande') and p_paiement_mode='especes_retrait' then raise exception 'Les espèces au retrait ne conviennent pas à une commande livrée'; end if;
  if not exists(select 1 from jsonb_array_elements(p_items) x where x->>'mode'='commande') and p_paiement_mode='especes_livraison' then raise exception 'Les espèces à la livraison ne conviennent pas à une réservation'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) x where x->>'mode'='commande') then
    v_ville:=left(trim(coalesce(v_adresse->>'ville','')),80);
    v_quartier:=left(trim(coalesce(v_adresse->>'quartier','')),80);
    v_rue:=left(trim(coalesce(v_adresse->>'rue','')),200);
    v_telephone:=left(trim(coalesce(v_adresse->>'telephone','')),30);
    if v_ville='' or v_quartier='' or v_rue='' or length(v_telephone)<6 then raise exception 'Adresse de livraison et téléphone obligatoires pour une commande'; end if;
    if p_paiement_mode='especes_retrait' then raise exception 'Les espèces au retrait ne conviennent pas à une commande livrée'; end if;
  end if;
  if not exists(select 1 from public.client_preferences p where p.user_id=v_user) then
    insert into public.client_preferences(user_id) values(v_user) on conflict(user_id) do nothing;
  end if;
  select coalesce(p.anonyme_defaut,true) into v_anonyme from public.client_preferences p where p.user_id=v_user;
  for v_mode in select distinct x->>'mode' from jsonb_array_elements(p_items) x order by 1 loop
    select jsonb_agg(jsonb_build_object('produit_id',x->>'produit_id','quantite',(x->>'quantite')::int) order by x->>'produit_id')
      into v_items from jsonb_array_elements(p_items) x where x->>'mode'=v_mode;
    v_id:=private.reserve_stock(p_pharmacie,v_items);
    v_expire:=now()+case when v_mode='reservation' then interval '4 hours' else interval '24 hours' end;
    update public.reservations set
      mode=v_mode,
      paiement_statut='a_verifier',
      paiement_mode=p_paiement_mode,
      commande_statut=case when v_mode='commande' then 'en_attente_pharmacie' else null end,
      expires_at=v_expire,
      adresse_livraison=case when v_mode='commande' then v_rue else null end,
      quartier_livraison=case when v_mode='commande' then v_quartier else null end,
      ville_livraison=case when v_mode='commande' then v_ville else null end,
      repere_livraison=case when v_mode='commande' then left(trim(coalesce(v_adresse->>'repere','')),200) else null end,
      telephone_livraison=case when v_mode='commande' then v_telephone else null end,
      latitude_livraison=case when v_mode='commande' and coalesce(v_adresse->>'latitude','') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_adresse->>'latitude')::double precision else null end,
      longitude_livraison=case when v_mode='commande' and coalesce(v_adresse->>'longitude','') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_adresse->>'longitude')::double precision else null end
    where id=v_id and client_id=v_user;
    insert into public.fils_messages(pharmacie_id,client_id,anonyme)
      values(p_pharmacie,v_user,v_anonyme) on conflict(client_id,pharmacie_id) do nothing;
    insert into public.notifications(pharmacie_id,type,titre,corps,fil_id)
      values(p_pharmacie,v_mode,case when v_mode='reservation' then 'Nouvelle réservation' else 'Nouvelle commande' end,
      case when v_mode='reservation' then 'Une réservation attend votre confirmation.' else 'Une commande avec livraison attend votre réponse.' end,
      (select f.id from public.fils_messages f where f.client_id=v_user and f.pharmacie_id=p_pharmacie));
    v_result:=v_result||jsonb_build_array(jsonb_build_object('id',v_id,'mode',v_mode,'expires_at',v_expire));
  end loop;
  return v_result;
end;
$function$;

revoke all on function public.creer_transactions_client(uuid,jsonb,text,jsonb) from public,anon;
grant execute on function public.creer_transactions_client(uuid,jsonb,text,jsonb) to authenticated;

create or replace function public.mettre_a_jour_commande_client(
  p_id uuid,
  p_statut text,
  p_paiement_confirme boolean default false
) returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_r public.reservations;
  v_allowed boolean:=false;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  select * into v_r from public.reservations where id=p_id for update;
  if not found or v_r.mode<>'commande' then raise exception 'Commande introuvable'; end if;
  if not (public.is_admin() or public.naxa_scope_allows(v_user,v_r.pharmacie_id,'PHARMACIE')) then raise exception 'Action non autorisée'; end if;
  v_allowed:=case
    when v_r.commande_statut='en_attente_pharmacie' then p_statut in ('acceptee','annulee')
    when v_r.commande_statut='acceptee' then p_statut in ('preparation','annulee')
    when v_r.commande_statut='preparation' then p_statut in ('livreur_assigne','en_livraison','annulee')
    when v_r.commande_statut='livreur_assigne' then p_statut in ('en_livraison','annulee')
    when v_r.commande_statut='en_livraison' then p_statut='livree'
    else false end;
  if not v_allowed and p_statut is distinct from v_r.commande_statut then raise exception 'Transition de commande interdite'; end if;
  if p_statut='annulee' and v_r.statut not in ('annulee','expiree','retiree') then
    perform private.set_reservation_status(p_id,'annulee'::public.resa_statut);
  end if;
  if p_paiement_confirme then
    if v_r.statut not in ('payee','retiree') then perform private.set_reservation_status(p_id,'payee'::public.resa_statut); end if;
    update public.reservations set paiement_statut='effectue' where id=p_id;
  end if;
  update public.reservations set
    commande_statut=p_statut,
    expires_at=case when p_statut in ('acceptee','preparation','livreur_assigne','en_livraison','livree') and not p_paiement_confirme and v_r.paiement_statut<>'effectue' then now()+interval '100 years' else expires_at end
  where id=p_id;
  return true;
end;
$function$;
revoke all on function public.mettre_a_jour_commande_client(uuid,text,boolean) from public,anon;
grant execute on function public.mettre_a_jour_commande_client(uuid,text,boolean) to authenticated;

create or replace function public.set_reservation_status(p_id uuid,p_statut public.resa_statut)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_r public.reservations; v_user uuid:=auth.uid();
begin
  select * into v_r from public.reservations where id=p_id for update;
  if not found then raise exception 'Réservation introuvable'; end if;
  if v_r.mode='commande' and p_statut='annulee' and v_r.client_id=v_user and v_r.commande_statut not in ('en_attente_pharmacie','acceptee') then
    raise exception 'Cette commande ne peut plus être annulée depuis NAXA. Contactez la pharmacie.';
  end if;
  perform private.set_reservation_status(p_id,p_statut);
  if p_statut in ('payee','retiree') then update public.reservations set paiement_statut='effectue' where id=p_id; end if;
  if p_statut in ('annulee','expiree') and v_r.mode='commande' then update public.reservations set commande_statut='annulee' where id=p_id; end if;
end;
$function$;
revoke all on function public.set_reservation_status(uuid,public.resa_statut) from public,anon;
grant execute on function public.set_reservation_status(uuid,public.resa_statut) to authenticated;

commit;
