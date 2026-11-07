-- NAXA — Devis de livraison calculés côté serveur et tarifs nationaux.
begin;

create table if not exists public.naxa_delivery_quotes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  latitude_client double precision not null check (latitude_client between 1.5 and 13.2),
  longitude_client double precision not null check (longitude_client between 8.2 and 16.5),
  latitude_pharmacie double precision not null check (latitude_pharmacie between 1.5 and 13.2),
  longitude_pharmacie double precision not null check (longitude_pharmacie between 8.2 and 16.5),
  distance_routiere_km numeric(7,2) not null check (distance_routiere_km > 0 and distance_routiere_km <= 250),
  duree_minutes integer not null check (duree_minutes > 0 and duree_minutes <= 1440),
  frais_livraison integer not null check (frais_livraison between 1000 and 3000),
  fournisseur_itineraire text not null check (fournisseur_itineraire in ('google_routes','osrm')),
  calcule_le timestamptz not null default now(),
  expire_le timestamptz not null default (now() + interval '10 minutes'),
  consomme_le timestamptz,
  reservation_id uuid references public.reservations(id) on delete set null,
  constraint naxa_delivery_quote_expiry_ck check (expire_le > calcule_le)
);

create index if not exists naxa_delivery_quotes_lookup_idx
  on public.naxa_delivery_quotes(client_id,pharmacie_id,calcule_le desc)
  where consomme_le is null;

alter table public.naxa_delivery_quotes enable row level security;
revoke all on table public.naxa_delivery_quotes from public,anon,authenticated;
grant all on table public.naxa_delivery_quotes to service_role;

alter table public.reservations
  add column if not exists delivery_quote_id uuid
  references public.naxa_delivery_quotes(id) on delete set null;

-- Le prix client est borné à 1 000–3 000 FCFA, sans changer la ventilation de commission déjà enregistrée.
alter table public.naxa_delivery_commission_ledger
  drop constraint if exists naxa_delivery_commission_ledger_frais_livraison_client_check,
  drop constraint if exists naxa_delivery_commission_ledger_solde_livraison_check;

alter table public.naxa_delivery_commission_ledger
  add constraint naxa_delivery_commission_ledger_frais_livraison_client_check
    check (frais_livraison_client between 1000 and 3000),
  add constraint naxa_delivery_commission_ledger_solde_livraison_check
    check (solde_livraison >= 500);

create or replace function private.naxa_apply_server_delivery_quote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_quote public.naxa_delivery_quotes%rowtype;
  v_pharmacy public.pharmacies%rowtype;
begin
  if new.mode is distinct from 'commande' then
    return new;
  end if;

  if v_uid is null or new.client_id is distinct from v_uid then
    raise exception 'La création d’une livraison doit être authentifiée par son Client';
  end if;

  if new.latitude_livraison is null or new.longitude_livraison is null
     or new.latitude_livraison not between 1.5 and 13.2
     or new.longitude_livraison not between 8.2 and 16.5 then
    raise exception 'La position GPS du Client doit se trouver au Cameroun';
  end if;

  select * into v_pharmacy
  from public.pharmacies
  where id=new.pharmacie_id
    and actif=true
    and visible_recherche=true
    and archivee_le is null
    and livraison_active=true
  for share;

  if not found or v_pharmacy.lat is null or v_pharmacy.lng is null
     or v_pharmacy.lat not between 1.5 and 13.2
     or v_pharmacy.lng not between 8.2 and 16.5 then
    raise exception 'La pharmacie doit être active, géolocalisée au Cameroun et proposer la livraison';
  end if;

  select * into v_quote
  from public.naxa_delivery_quotes q
  where q.client_id=new.client_id
    and q.pharmacie_id=new.pharmacie_id
    and q.consomme_le is null
    and q.expire_le > now()
    and abs(q.latitude_client-new.latitude_livraison) < 0.000001
    and abs(q.longitude_client-new.longitude_livraison) < 0.000001
    and abs(q.latitude_pharmacie-v_pharmacy.lat) < 0.000001
    and abs(q.longitude_pharmacie-v_pharmacy.lng) < 0.000001
  order by q.calcule_le desc
  limit 1
  for update;

  if not found then
    raise exception 'Devis routier NAXA absent ou expiré. Recalculez la distance avant de confirmer la livraison';
  end if;

  if v_quote.distance_routiere_km > v_pharmacy.rayon_livraison_km then
    raise exception 'Adresse hors du rayon de livraison de cette pharmacie';
  end if;

  new.delivery_quote_id := v_quote.id;
  new.distance_livraison_km := v_quote.distance_routiere_km;
  new.frais_livraison := v_quote.frais_livraison;

  update public.naxa_delivery_quotes
  set consomme_le=now()
  where id=v_quote.id and consomme_le is null;

  if not found then
    raise exception 'Ce devis de livraison a déjà été utilisé';
  end if;

  return new;
end;
$function$;

revoke all on function private.naxa_apply_server_delivery_quote() from public,anon,authenticated;

drop trigger if exists naxa_apply_server_delivery_quote on public.reservations;
create trigger naxa_apply_server_delivery_quote
before update of mode,latitude_livraison,longitude_livraison
on public.reservations
for each row
when (new.mode='commande')
execute function private.naxa_apply_server_delivery_quote();

comment on table public.naxa_delivery_quotes is
  'Devis routiers calculés uniquement côté serveur, à usage unique et expirant après dix minutes. Aucun tarif fourni par le navigateur n''est considéré comme fiable.';
comment on column public.reservations.delivery_quote_id is
  'Devis routier serveur consommé lors de la création de la commande de livraison.';

commit;
