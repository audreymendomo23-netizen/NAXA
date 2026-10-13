-- NAXA 075 — préférences client, fils/messages et notifications.
begin;

create table if not exists public.client_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  adresse_defaut text check (adresse_defaut is null or char_length(adresse_defaut) <= 200),
  quartier text check (quartier is null or char_length(quartier) <= 80),
  paiement_mode text not null default 'mtn_momo' check (paiement_mode in ('mtn_momo','orange_money','especes')),
  paiement_numero text check (paiement_numero is null or paiement_numero ~ '^6[0-9]{8}$'),
  langue text not null default 'fr' check (langue in ('fr','en')),
  notif_messages boolean not null default true,
  notif_reservations boolean not null default true,
  anonyme_defaut boolean not null default true,
  note_app smallint check (note_app between 1 and 5),
  avis_app text check (avis_app is null or char_length(avis_app) <= 500),
  updated_at timestamptz not null default now()
);

create table if not exists public.fils_messages (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  produit_id uuid references public.produits(id) on delete set null,
  anonyme boolean not null default true,
  created_at timestamptz not null default now(),
  unique (client_id, pharmacie_id)
);

create table if not exists public.messages_pharmacie (
  id uuid primary key default gen_random_uuid(),
  fil_id uuid not null references public.fils_messages(id) on delete cascade,
  expediteur text not null check (expediteur in ('client','pharmacie')),
  corps text not null check (char_length(trim(corps)) between 1 and 1000),
  lu_le timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  pharmacie_id uuid references public.pharmacies(id) on delete cascade,
  type text not null,
  titre text not null check (char_length(titre) between 1 and 160),
  corps text not null check (char_length(corps) <= 1000),
  fil_id uuid references public.fils_messages(id) on delete cascade,
  lu_le timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_un_destinataire check ((user_id is not null)::int + (pharmacie_id is not null)::int = 1)
);

alter table public.client_preferences enable row level security;
alter table public.fils_messages enable row level security;
alter table public.messages_pharmacie enable row level security;
alter table public.notifications enable row level security;

drop policy if exists client_preferences_self on public.client_preferences;
create policy client_preferences_self on public.client_preferences
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists fils_messages_client_read on public.fils_messages;
create policy fils_messages_client_read on public.fils_messages
  for select to authenticated using (client_id = (select auth.uid()));

drop policy if exists messages_pharmacie_read_participant on public.messages_pharmacie;
create policy messages_pharmacie_read_participant on public.messages_pharmacie
  for select to authenticated using (
    exists (select 1 from public.fils_messages f where f.id = fil_id and f.client_id = (select auth.uid()))
    or exists (select 1 from public.fils_messages f where f.id = fil_id and public.can_access_pharmacy(f.pharmacie_id))
  );

drop policy if exists notifications_read_recipient on public.notifications;
create policy notifications_read_recipient on public.notifications
  for select to authenticated using (
    user_id = (select auth.uid())
    or (pharmacie_id is not null and public.can_access_pharmacy(pharmacie_id))
  );

revoke all on public.client_preferences, public.fils_messages, public.messages_pharmacie, public.notifications from anon, public;
grant select, insert, update, delete on public.client_preferences to authenticated;
grant select on public.fils_messages, public.messages_pharmacie, public.notifications to authenticated;
revoke insert, update, delete on public.fils_messages, public.messages_pharmacie, public.notifications from anon, authenticated;

create or replace function public.envoyer_message_client(p_pharmacie uuid, p_produit uuid, p_corps text, p_anonyme boolean default true)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_user uuid := auth.uid(); v_fil uuid; v_nom text;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if char_length(trim(coalesce(p_corps,''))) not between 1 and 1000 then raise exception 'Message invalide'; end if;
  if not exists (select 1 from public.profiles p where p.id=v_user and p.role='client') then raise exception 'Rôle client requis'; end if;
  if (select count(*) from public.messages_pharmacie m join public.fils_messages f on f.id=m.fil_id where f.client_id=v_user and m.expediteur='client' and m.created_at > now()-interval '1 hour') >= 20 then raise exception 'Limite de 20 messages par heure atteinte'; end if;
  insert into public.fils_messages(pharmacie_id,client_id,produit_id,anonyme)
  values(p_pharmacie,v_user,p_produit,coalesce(p_anonyme,true))
  on conflict(client_id,pharmacie_id) do update set produit_id=coalesce(excluded.produit_id,public.fils_messages.produit_id), anonyme=excluded.anonyme
  returning id into v_fil;
  insert into public.messages_pharmacie(fil_id,expediteur,corps) values(v_fil,'client',trim(p_corps));
  select coalesce(nullif(trim(first_name),''),'Client') into v_nom from public.profiles where id=v_user;
  insert into public.notifications(pharmacie_id,type,titre,corps,fil_id)
  values(p_pharmacie,'message',case when coalesce(p_anonyme,true) then 'Nouveau message de Client anonyme' else 'Nouveau message de '||coalesce(v_nom,'Client') end,left(trim(p_corps),1000),v_fil);
  return v_fil;
end;
$function$;

create or replace function public.repondre_message(p_fil uuid, p_corps text)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_user uuid := auth.uid(); v_pharmacie uuid; v_client uuid; v_expediteur text; v_id uuid;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if char_length(trim(coalesce(p_corps,''))) not between 1 and 1000 then raise exception 'Message invalide'; end if;
  select pharmacie_id,client_id into v_pharmacie,v_client from public.fils_messages where id=p_fil;
  if v_client is null then raise exception 'Conversation introuvable'; end if;
  if v_user=v_client then v_expediteur:='client';
  elsif public.can_access_pharmacy(v_pharmacie) then v_expediteur:='pharmacie';
  else raise exception 'Accès refusé'; end if;
  insert into public.messages_pharmacie(fil_id,expediteur,corps) values(p_fil,v_expediteur,trim(p_corps)) returning id into v_id;
  if v_expediteur='client' then
    insert into public.notifications(pharmacie_id,type,titre,corps,fil_id) values(v_pharmacie,'message','Nouveau message client',left(trim(p_corps),1000),p_fil);
  else
    insert into public.notifications(user_id,type,titre,corps,fil_id) values(v_client,'message','Réponse de la pharmacie',left(trim(p_corps),1000),p_fil);
  end if;
  return v_id;
end;
$function$;

create or replace function public.marquer_fil_lu(p_fil uuid)
returns boolean language plpgsql security definer set search_path = ''
as $function$
declare v_user uuid := auth.uid(); v_pharmacie uuid; v_client uuid;
begin
  select pharmacie_id,client_id into v_pharmacie,v_client from public.fils_messages where id=p_fil;
  if v_user is null or (v_user<>v_client and not public.can_access_pharmacy(v_pharmacie)) then raise exception 'Accès refusé'; end if;
  update public.messages_pharmacie set lu_le=now() where fil_id=p_fil and lu_le is null and expediteur <> case when v_user=v_client then 'client' else 'pharmacie' end;
  update public.notifications set lu_le=now() where fil_id=p_fil and lu_le is null and (user_id=v_user or (pharmacie_id=v_pharmacie and public.can_access_pharmacy(v_pharmacie)));
  return true;
end;
$function$;

create or replace function public.boite_pharmacie(p_pharmacie uuid)
returns table(fil_id uuid, libelle text, dernier_message text, date_dernier_message timestamptz, non_lus bigint)
language sql stable security definer set search_path = ''
as $function$
  select f.id, case when f.anonyme then 'Client anonyme' else 'Client' end,
    (select m.corps from public.messages_pharmacie m where m.fil_id=f.id order by m.created_at desc limit 1),
    (select m.created_at from public.messages_pharmacie m where m.fil_id=f.id order by m.created_at desc limit 1),
    (select count(*) from public.messages_pharmacie m where m.fil_id=f.id and m.expediteur='client' and m.lu_le is null)
  from public.fils_messages f where f.pharmacie_id=p_pharmacie and public.can_access_pharmacy(p_pharmacie)
  order by f.created_at desc;
$function$;

revoke all on function public.envoyer_message_client(uuid,uuid,text,boolean) from public, anon;
revoke all on function public.repondre_message(uuid,text) from public, anon;
revoke all on function public.marquer_fil_lu(uuid) from public, anon;
revoke all on function public.boite_pharmacie(uuid) from public, anon;
grant execute on function public.envoyer_message_client(uuid,uuid,text,boolean) to authenticated;
grant execute on function public.repondre_message(uuid,text) to authenticated;
grant execute on function public.marquer_fil_lu(uuid) to authenticated;
grant execute on function public.boite_pharmacie(uuid) to authenticated;

do $publication$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then alter publication supabase_realtime add table public.notifications; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages_pharmacie') then alter publication supabase_realtime add table public.messages_pharmacie; end if;
  end if;
end;
$publication$;
commit;
