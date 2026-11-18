-- NAXA — espace Assistance Client -> équipe NAXA.
-- Réutilise tickets_support/messages_support sans mélanger le chat pharmacie.
begin;

create sequence if not exists public.tickets_support_reference_seq
  as bigint start with 1 increment by 1 minvalue 1 no cycle;

alter table public.tickets_support
  add column if not exists reference_code text,
  add column if not exists categorie text not null default 'autre',
  add column if not exists last_activity_at timestamptz not null default now();

update public.tickets_support
set reference_code =
  'NX-' || to_char(created_at at time zone 'Africa/Douala', 'YYMM') || '-' ||
  lpad(nextval('public.tickets_support_reference_seq')::text, 7, '0')
where reference_code is null;

alter table public.tickets_support
  alter column reference_code set default (
    'NX-' || to_char(now() at time zone 'Africa/Douala', 'YYMM') || '-' ||
    lpad(nextval('public.tickets_support_reference_seq')::text, 7, '0')
  ),
  alter column reference_code set not null;

create unique index if not exists tickets_support_reference_code_uq
  on public.tickets_support(reference_code);

alter table public.tickets_support
  drop constraint if exists tickets_support_categorie_check;
alter table public.tickets_support
  add constraint tickets_support_categorie_check
  check (categorie in (
    'compte','technique','commande','signalement',
    'confidentialite','suggestion','autre'
  ));

alter table public.messages_support
  add column if not exists piece_jointe_path text,
  add column if not exists piece_jointe_nom text,
  add column if not exists piece_jointe_mime text,
  add column if not exists piece_jointe_taille bigint;

alter table public.messages_support
  drop constraint if exists messages_support_piece_jointe_coherence_check;
alter table public.messages_support
  add constraint messages_support_piece_jointe_coherence_check
  check (
    (
      piece_jointe_path is null
      and piece_jointe_nom is null
      and piece_jointe_mime is null
      and piece_jointe_taille is null
    )
    or (
      piece_jointe_path is not null
      and piece_jointe_path ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$'
    )
  );

create index if not exists tickets_support_naxa_client_activity_idx
  on public.tickets_support(auteur_profile_id, last_activity_at desc)
  where type = 'support_naxa';

drop policy if exists tickets_support_client_create_naxa_support on public.tickets_support;
create policy tickets_support_client_create_naxa_support
on public.tickets_support
for insert
to authenticated
with check (
  auteur_profile_id = (select auth.uid())
  and pharmacie_id is null
  and type = 'support_naxa'
  and statut = 'ouvert'
  and categorie in (
    'compte','technique','commande','signalement',
    'confidentialite','suggestion','autre'
  )
  and exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid())
      and me.role = 'client'::public.role_type
      and me.actif is true
  )
);

drop policy if exists messages_support_chat_participant_insert on public.messages_support;
create policy messages_support_chat_participant_insert
on public.messages_support
for insert
to authenticated
with check (
  auteur_profile_id = (select auth.uid())
  and interne = false
  and length(btrim(contenu)) between 1 and 2000
  and exists (
    select 1
    from public.tickets_support t
    join public.profiles me on me.id = (select auth.uid())
    where t.id = messages_support.ticket_id
      and (
        (
          t.type = 'conseil_pharmacien'
          and t.statut = 'ouvert'
          and (
            (t.auteur_profile_id = (select auth.uid()) and me.role = 'client'::public.role_type)
            or
            (t.pharmacie_id = (select public.my_pharmacie())
              and me.role = 'pharmacie'::public.role_type)
          )
        )
        or
        (
          t.type = 'support_naxa'
          and t.pharmacie_id is null
          and t.auteur_profile_id = (select auth.uid())
          and t.statut <> 'ferme'
          and me.role = 'client'::public.role_type
          and me.actif is true
        )
      )
  )
  and (
    piece_jointe_path is null
    or (
      piece_jointe_path like (select auth.uid()::text) || '/' || ticket_id::text || '/%'
      and piece_jointe_mime in ('application/pdf','image/jpeg','image/png','image/webp')
      and piece_jointe_taille between 1 and 4194304
    )
  )
);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'naxa-support-attachments',
  'naxa-support-attachments',
  false,
  4194304,
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 4194304,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists naxa_support_attachment_insert_own on storage.objects;
create policy naxa_support_attachment_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'naxa-support-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and storage.filename(name) ~* '^[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$'
  and coalesce(metadata->>'mimetype','') in ('application/pdf','image/jpeg','image/png','image/webp')
  and exists (
    select 1
    from public.tickets_support t
    join public.profiles me on me.id = (select auth.uid())
    where t.id::text = (storage.foldername(name))[2]
      and t.auteur_profile_id = (select auth.uid())
      and t.type = 'support_naxa'
      and t.pharmacie_id is null
      and t.statut <> 'ferme'
      and me.role = 'client'::public.role_type
      and me.actif is true
  )
);

drop policy if exists naxa_support_attachment_read_own on storage.objects;
create policy naxa_support_attachment_read_own
on storage.objects for select to authenticated
using (
  bucket_id = 'naxa-support-attachments'
  and exists (
    select 1
    from public.messages_support m
    join public.tickets_support t on t.id = m.ticket_id
    where m.piece_jointe_path = objects.name
      and m.interne = false
      and t.auteur_profile_id = (select auth.uid())
      and t.type = 'support_naxa'
  )
);

drop policy if exists naxa_support_attachment_delete_own on storage.objects;
create policy naxa_support_attachment_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'naxa-support-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.tickets_support t
    where t.id::text = (storage.foldername(name))[2]
      and t.auteur_profile_id = (select auth.uid())
      and t.type = 'support_naxa'
  )
);

create or replace function public.support_chat_mark_first_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ticket public.tickets_support%rowtype;
  v_profile public.profiles%rowtype;
  v_prior_messages integer := 0;
begin
  select * into v_ticket
  from public.tickets_support t
  where t.id = new.ticket_id;

  if not found then return new; end if;

  select * into v_profile
  from public.profiles p
  where p.id = new.auteur_profile_id;

  if v_ticket.type = 'support_naxa' then
    if new.interne then return new; end if;

    select count(*)::integer into v_prior_messages
    from public.messages_support m
    where m.ticket_id = new.ticket_id
      and m.id <> new.id
      and m.interne = false;

    update public.tickets_support t
    set last_activity_at = new.created_at,
        first_response_at = case
          when v_profile.role = 'admin' and v_profile.actif is true
            then coalesce(t.first_response_at, new.created_at)
          else t.first_response_at
        end,
        statut = case
          when v_profile.role = 'admin' and v_profile.actif is true
            then 'en_attente_client'
          when v_profile.role = 'client'
            and v_profile.id = v_ticket.auteur_profile_id
            and v_prior_messages > 0
            and t.statut <> 'ferme'
            then 'en_cours'
          else t.statut
        end
    where t.id = new.ticket_id;
    return new;
  end if;

  update public.tickets_support t
  set first_response_at = coalesce(t.first_response_at, new.created_at),
      last_activity_at = new.created_at
  where t.id = new.ticket_id
    and t.first_response_at is null
    and t.auteur_profile_id <> new.auteur_profile_id
    and t.pharmacie_id = (
      select p.pharmacie_id
      from public.profiles p
      where p.id = new.auteur_profile_id
    );

  update public.tickets_support t
  set last_activity_at = new.created_at
  where t.id = new.ticket_id
    and t.last_activity_at < new.created_at;

  return new;
end;
$function$;

revoke all on function public.support_chat_mark_first_response() from public, anon, authenticated;

commit;

      and piece_jointe_nom is not null
      and length(piece_jointe_nom) between 1 and 180
      and piece_jointe_mime is not null
      and piece_jointe_mime in ('application/pdf','image/jpeg','image/png','image/webp')
      and piece_jointe_taille is not null
      and piece_jointe_taille between 1 and 4194304
    )
  );

create index if not exists tickets_support_naxa_client_activity_idx
  on public.tickets_support(auteur_profile_id, last_activity_at desc)
  where type = 'support_naxa';

drop policy if exists tickets_support_client_create_naxa_support on public.tickets_support;
create policy tickets_support_client_create_naxa_support
on public.tickets_support
for insert
to authenticated
with check (
  auteur_profile_id = (select auth.uid())
  and pharmacie_id is null
  and type = 'support_naxa'
  and statut = 'ouvert'
  and categorie in (
    'compte','technique','commande','signalement',
    'confidentialite','suggestion','autre'
  )
  and exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid())
      and me.role = 'client'::public.role_type
      and me.actif is true
  )
);

drop policy if exists messages_support_chat_participant_insert on public.messages_support;
create policy messages_support_chat_participant_insert
on public.messages_support
for insert
to authenticated
with check (
  auteur_profile_id = (select auth.uid())
  and interne = false
  and length(btrim(contenu)) between 1 and 2000
  and exists (
    select 1
    from public.tickets_support t
    join public.profiles me on me.id = (select auth.uid())
    where t.id = messages_support.ticket_id
      and (
        (
          t.type = 'conseil_pharmacien'
          and t.statut = 'ouvert'
          and (
            (t.auteur_profile_id = (select auth.uid()) and me.role = 'client'::public.role_type)
            or
            (t.pharmacie_id = (select public.my_pharmacie())
              and me.role = 'pharmacie'::public.role_type)
          )
        )
        or
        (
          t.type = 'support_naxa'
          and t.pharmacie_id is null
          and t.auteur_profile_id = (select auth.uid())
          and t.statut <> 'ferme'
          and me.role = 'client'::public.role_type
          and me.actif is true
        )
      )
  )
  and (
    piece_jointe_path is null
    or (
      piece_jointe_path like (select auth.uid()::text) || '/' || ticket_id::text || '/%'
      and piece_jointe_mime in ('application/pdf','image/jpeg','image/png','image/webp')
      and piece_jointe_taille between 1 and 4194304
    )
  )
);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'naxa-support-attachments',
  'naxa-support-attachments',
  false,
  4194304,
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 4194304,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists naxa_support_attachment_insert_own on storage.objects;
create policy naxa_support_attachment_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'naxa-support-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and storage.filename(name) ~* '^[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$'
  and coalesce(metadata->>'mimetype','') in ('application/pdf','image/jpeg','image/png','image/webp')
  and exists (
    select 1
    from public.tickets_support t
    join public.profiles me on me.id = (select auth.uid())
    where t.id::text = (storage.foldername(name))[2]
      and t.auteur_profile_id = (select auth.uid())
      and t.type = 'support_naxa'
      and t.pharmacie_id is null
      and t.statut <> 'ferme'
      and me.role = 'client'::public.role_type
      and me.actif is true
  )
);

drop policy if exists naxa_support_attachment_read_own on storage.objects;
create policy naxa_support_attachment_read_own
on storage.objects for select to authenticated
using (
  bucket_id = 'naxa-support-attachments'
  and exists (
    select 1
    from public.messages_support m
    join public.tickets_support t on t.id = m.ticket_id
    where m.piece_jointe_path = objects.name
      and m.interne = false
      and t.auteur_profile_id = (select auth.uid())
      and t.type = 'support_naxa'
  )
);

drop policy if exists naxa_support_attachment_delete_own on storage.objects;
create policy naxa_support_attachment_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'naxa-support-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.tickets_support t
    where t.id::text = (storage.foldername(name))[2]
      and t.auteur_profile_id = (select auth.uid())
      and t.type = 'support_naxa'
  )
);

create or replace function public.support_chat_mark_first_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ticket public.tickets_support%rowtype;
  v_profile public.profiles%rowtype;
  v_prior_messages integer := 0;
begin
  select * into v_ticket
  from public.tickets_support t
  where t.id = new.ticket_id;

  if not found then return new; end if;

  select * into v_profile
  from public.profiles p
  where p.id = new.auteur_profile_id;

  if v_ticket.type = 'support_naxa' then
    if new.interne then return new; end if;

    select count(*)::integer into v_prior_messages
    from public.messages_support m
    where m.ticket_id = new.ticket_id
      and m.id <> new.id
      and m.interne = false;

    update public.tickets_support t
    set last_activity_at = new.created_at,
        first_response_at = case
          when v_profile.role = 'admin' and v_profile.actif is true
            then coalesce(t.first_response_at, new.created_at)
          else t.first_response_at
        end,
        statut = case
          when v_profile.role = 'admin' and v_profile.actif is true
            then 'en_attente_client'
          when v_profile.role = 'client'
            and v_profile.id = v_ticket.auteur_profile_id
            and v_prior_messages > 0
            and t.statut <> 'ferme'
            then 'en_cours'
          else t.statut
        end
    where t.id = new.ticket_id;
    return new;
  end if;

  update public.tickets_support t
  set first_response_at = coalesce(t.first_response_at, new.created_at),
      last_activity_at = new.created_at
  where t.id = new.ticket_id
    and t.first_response_at is null
    and t.auteur_profile_id <> new.auteur_profile_id
    and t.pharmacie_id = (
      select p.pharmacie_id
      from public.profiles p
      where p.id = new.auteur_profile_id
    );

  update public.tickets_support t
  set last_activity_at = new.created_at
  where t.id = new.ticket_id
    and t.last_activity_at < new.created_at;

  return new;
end;
$function$;

revoke all on function public.support_chat_mark_first_response() from public, anon, authenticated;

commit;
