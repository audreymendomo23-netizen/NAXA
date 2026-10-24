-- NAXA 238 — favoris liés au compte et rappels de réachat consentis.
begin;
create table if not exists public.favoris_client (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 produit_ref text not null check (char_length(trim(produit_ref)) between 1 and 200),
 produit_id uuid references public.produits(id) on delete set null,
 nom text not null check (char_length(trim(nom)) between 1 and 200),
 dosage text not null default '' check (char_length(dosage)<=100),
 photo_url text, prix integer not null default 0 check (prix>=0),
 pharmacie text not null default '' check (char_length(pharmacie)<=200),
 demo boolean not null default false, saved_at timestamptz not null default now(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,produit_ref)
);
create index if not exists favoris_client_user_saved_idx on public.favoris_client(user_id,saved_at desc);
alter table public.favoris_client enable row level security;
drop policy if exists favoris_client_self on public.favoris_client;
create policy favoris_client_self on public.favoris_client for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.favoris_client from anon,public;
grant select,insert,update,delete on public.favoris_client to authenticated;

create table if not exists public.naxa_achat_suivi_propositions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 reservation_id uuid not null references public.reservations(id) on delete cascade,
 produit_id uuid not null references public.produits(id) on delete restrict,
 produit_nom text not null, dosage text, prix integer not null default 0 check(prix>=0),
 statut text not null default 'en_attente' check(statut in ('en_attente','acceptee','ignoree')),
 created_at timestamptz not null default now(), resolved_at timestamptz,
 unique(reservation_id,produit_id)
);
create index if not exists naxa_achat_suivi_user_pending_idx on public.naxa_achat_suivi_propositions(user_id,created_at desc) where statut='en_attente';
alter table public.naxa_achat_suivi_propositions enable row level security;
drop policy if exists naxa_achat_suivi_select_self on public.naxa_achat_suivi_propositions;
create policy naxa_achat_suivi_select_self on public.naxa_achat_suivi_propositions for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists naxa_achat_suivi_update_self on public.naxa_achat_suivi_propositions;
create policy naxa_achat_suivi_update_self on public.naxa_achat_suivi_propositions for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.naxa_achat_suivi_propositions from anon,public;
grant select,update on public.naxa_achat_suivi_propositions to authenticated;

create table if not exists public.naxa_favoris_rappels (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 produit_ref text not null, produit_nom text not null check(char_length(trim(produit_nom)) between 1 and 200),
 reservation_id uuid references public.reservations(id) on delete set null,
 reminder_date date not null, mode text not null default 'renouvellement' check(mode in ('renouvellement','suivi_traitement')),
 source text not null check(source in ('achat_caisse','manuel')), actif boolean not null default true,
 consent_at timestamptz not null, notified_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists naxa_favoris_rappels_due_idx on public.naxa_favoris_rappels(reminder_date) where actif and notified_at is null;
create index if not exists naxa_favoris_rappels_user_idx on public.naxa_favoris_rappels(user_id,reminder_date);
alter table public.naxa_favoris_rappels enable row level security;
drop policy if exists naxa_favoris_rappels_self on public.naxa_favoris_rappels;
create policy naxa_favoris_rappels_self on public.naxa_favoris_rappels for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.naxa_favoris_rappels from anon,public;
grant select,insert,update,delete on public.naxa_favoris_rappels to authenticated;
grant all on public.favoris_client,public.naxa_achat_suivi_propositions,public.naxa_favoris_rappels to service_role;

alter table public.notifications add column if not exists related_entity_id uuid;
create unique index if not exists notifications_favoris_achat_once on public.notifications(user_id,type,related_entity_id)
 where type='favoris_achat_confirme' and related_entity_id is not null;

create or replace function public.naxa_creer_proposition_favoris_apres_encaissement()
returns trigger language plpgsql security definer set search_path='' as $function$
begin
 if new.statut='payee' and old.statut is distinct from new.statut and new.client_id is not null then
  insert into public.naxa_achat_suivi_propositions(user_id,reservation_id,produit_id,produit_nom,dosage,prix)
  select new.client_id,new.id,ri.produit_id,p.nom,p.dosage,ri.prix_unitaire
  from public.reservation_items ri join public.produits p on p.id=ri.produit_id
  where ri.reservation_id=new.id on conflict(reservation_id,produit_id) do nothing;
  insert into public.notifications(user_id,type,titre,corps,related_entity_id)
  values(new.client_id,'favoris_achat_confirme','Votre achat est confirmé',
   'Souhaitez-vous ajouter ce médicament à vos favoris et programmer un rappel de réachat ?',new.id)
  on conflict(user_id,type,related_entity_id) where type='favoris_achat_confirme' and related_entity_id is not null do nothing;
 end if;
 return new;
end;$function$;
drop trigger if exists naxa_reservation_achat_favoris on public.reservations;
create trigger naxa_reservation_achat_favoris after update of statut on public.reservations
 for each row when(new.statut='payee' and old.statut is distinct from new.statut)
 execute function public.naxa_creer_proposition_favoris_apres_encaissement();

create or replace function public.accepter_proposition_favori(p_proposition uuid,p_date_rappel date default null)
returns boolean language plpgsql security definer set search_path='' as $function$
declare v_user uuid:=auth.uid(); v_prop public.naxa_achat_suivi_propositions%rowtype;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_date_rappel is not null and p_date_rappel<current_date then raise exception 'Date de rappel passée'; end if;
 select * into v_prop from public.naxa_achat_suivi_propositions where id=p_proposition and user_id=v_user for update;
 if not found or v_prop.statut<>'en_attente' then raise exception 'Proposition introuvable ou déjà traitée'; end if;
 insert into public.favoris_client(user_id,produit_ref,produit_id,nom,dosage,prix,pharmacie,demo,saved_at,updated_at)
 values(v_user,v_prop.produit_id::text,v_prop.produit_id,v_prop.produit_nom,coalesce(v_prop.dosage,''),v_prop.prix,'Achat confirmé en caisse',false,now(),now())
 on conflict(user_id,produit_ref) do nothing;
 if p_date_rappel is not null then
  insert into public.naxa_favoris_rappels(user_id,produit_ref,produit_nom,reservation_id,reminder_date,mode,source,actif,consent_at)
  values(v_user,v_prop.produit_id::text,v_prop.produit_nom,v_prop.reservation_id,p_date_rappel,'renouvellement','achat_caisse',true,now());
 end if;
 update public.naxa_achat_suivi_propositions set statut='acceptee',resolved_at=now() where id=v_prop.id;
 return true;
end;$function$;
revoke all on function public.accepter_proposition_favori(uuid,date) from public,anon;
grant execute on function public.accepter_proposition_favori(uuid,date) to authenticated;
comment on table public.favoris_client is 'Favoris synchronisés au compte client; localStorage reste un cache de compatibilité.';
comment on table public.naxa_favoris_rappels is 'Rappels de réachat créés uniquement après accord explicite du client.';
commit;
