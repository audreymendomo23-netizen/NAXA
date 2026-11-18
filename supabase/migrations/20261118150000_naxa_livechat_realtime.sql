-- NAXA — Livechat Client/Admin temps réel.
-- Migration additive sur le support existant ; aucun ticket ni compte de test créé.
begin;

-- Ticket + premier message créés dans une même transaction. SECURITY INVOKER
-- préserve le contrôle RLS et exige le rôle métier Client effectivement sélectionné.
create or replace function public.open_naxa_support_ticket(
  p_categorie text,
  p_sujet text,
  p_message text
)
returns table(ticket_id uuid, reference_code text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_ticket_id uuid;
  v_reference_code text;
  v_subject text := btrim(coalesce(p_sujet, ''));
  v_message text := btrim(coalesce(p_message, ''));
begin
  if v_user_id is null then
    raise exception 'Connexion Client requise' using errcode = '42501';
  end if;

  if p_categorie not in (
    'compte','technique','commande','signalement',
    'confidentialite','suggestion','autre'
  ) or length(v_subject) not between 5 and 100
    or length(v_message) not between 1 and 2000 then
    raise exception 'Catégorie, sujet ou message invalide' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id
      and p.role = 'client'::public.role_type
      and p.actif is true
  ) or public.naxa_business_function() is distinct from 'client' then
    raise exception 'Assistance réservée à un Client actif dans son espace Client' using errcode = '42501';
  end if;

  insert into public.tickets_support as inserted_ticket(
    auteur_profile_id, pharmacie_id, sujet, type, statut, categorie
  )
  values (v_user_id, null, v_subject, 'support_naxa', 'ouvert', p_categorie)
  returning inserted_ticket.id, inserted_ticket.reference_code
    into v_ticket_id, v_reference_code;

  insert into public.messages_support(
    ticket_id, auteur_profile_id, contenu, interne
  )
  values (v_ticket_id, v_user_id, v_message, false);

  ticket_id := v_ticket_id;
  reference_code := v_reference_code;
  return next;
end;
$function$;

revoke all on function public.open_naxa_support_ticket(text,text,text)
  from public, anon;
grant execute on function public.open_naxa_support_ticket(text,text,text)
  to authenticated;

-- RLS INSERT : seul le propriétaire Client actif dans son espace Client
-- peut créer un ticket support NAXA. La conversation pharmacie reste inchangée.
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
  and public.naxa_business_function() = 'client'
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
          and public.naxa_business_function() = 'client'
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

-- Les fichiers restent privés et accessibles uniquement au Client propriétaire
-- dans l'espace Client actif. L'Admin utilise les URL signées côté serveur.
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
  and public.naxa_business_function() = 'client'
  and exists (
    select 1 from public.tickets_support t
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
  and public.naxa_business_function() = 'client'
  and exists (
    select 1 from public.messages_support m
    join public.tickets_support t on t.id = m.ticket_id
    join public.profiles me on me.id = (select auth.uid())
    where m.piece_jointe_path = objects.name
      and m.interne = false
      and t.auteur_profile_id = (select auth.uid())
      and t.type = 'support_naxa'
      and me.role = 'client'::public.role_type
      and me.actif is true
  )
);

drop policy if exists naxa_support_attachment_delete_own on storage.objects;
create policy naxa_support_attachment_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'naxa-support-attachments'
  and public.naxa_business_function() = 'client'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.tickets_support t
    join public.profiles me on me.id = (select auth.uid())
    where t.id::text = (storage.foldername(name))[2]
      and t.auteur_profile_id = (select auth.uid())
      and t.type = 'support_naxa'
      and me.role = 'client'::public.role_type
      and me.actif is true
  )
);

-- Notification in-app aux Admin actifs à chaque nouveau dossier.
create or replace function private.naxa_support_notify_new_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.type <> 'support_naxa' or new.pharmacie_id is not null then
    return new;
  end if;

  insert into public.notifications(user_id, type, titre, corps, related_entity_id)
  select
    p.id,
    'support_naxa_nouvelle_demande',
    'Nouvelle demande d’assistance Client',
    'Une nouvelle demande NAXA attend son traitement : ' || new.reference_code || '.',
    new.id
  from public.profiles p
  where p.role = 'admin'::public.role_type
    and p.actif is true;

  return new;
end;
$function$;

revoke all on function private.naxa_support_notify_new_ticket()
  from public, anon, authenticated;

drop trigger if exists trg_naxa_support_notify_new_ticket on public.tickets_support;
create trigger trg_naxa_support_notify_new_ticket
after insert on public.tickets_support
for each row execute function private.naxa_support_notify_new_ticket();

-- Notification Admin à chaque réponse ultérieure du Client ; le premier message
-- est déjà signalé par le trigger du ticket, il n'est donc pas compté deux fois.
create or replace function private.naxa_support_notify_client_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ticket public.tickets_support%rowtype;
  v_prior_messages integer := 0;
begin
  if new.interne or new.auteur_profile_id is null then return new; end if;

  select * into v_ticket
  from public.tickets_support t
  where t.id = new.ticket_id
    and t.type = 'support_naxa'
    and t.pharmacie_id is null;

  if not found or new.auteur_profile_id <> v_ticket.auteur_profile_id then
    return new;
  end if;

  select count(*)::integer into v_prior_messages
  from public.messages_support m
  where m.ticket_id = new.ticket_id
    and m.id <> new.id
    and m.interne = false;

  if v_prior_messages = 0 then return new; end if;

  insert into public.notifications(user_id, type, titre, corps, related_entity_id)
  select
    p.id,
    'support_naxa_nouveau_message',
    'Nouveau message d’un Client',
    'Le Client a répondu dans la demande ' || v_ticket.reference_code || '.',
    v_ticket.id
  from public.profiles p
  where p.role = 'admin'::public.role_type
    and p.actif is true;

  return new;
end;
$function$;

revoke all on function private.naxa_support_notify_client_reply()
  from public, anon, authenticated;

drop trigger if exists trg_naxa_support_notify_client_reply on public.messages_support;
create trigger trg_naxa_support_notify_client_reply
after insert on public.messages_support
for each row execute function private.naxa_support_notify_client_reply();

-- Si le Client répond à une demande résolue, le trigger historique remet
-- déjà le statut à en_cours ; cet additif efface aussi resolved_at.
create or replace function private.naxa_support_clear_resolution_on_client_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.interne or new.auteur_profile_id is null then return new; end if;

  update public.tickets_support t
  set resolved_at = null
  where t.id = new.ticket_id
    and t.type = 'support_naxa'
    and t.auteur_profile_id = new.auteur_profile_id
    and t.statut = 'en_cours'
    and t.resolved_at is not null;

  return new;
end;
$function$;

revoke all on function private.naxa_support_clear_resolution_on_client_reply()
  from public, anon, authenticated;

drop trigger if exists trg_naxa_support_clear_resolution_on_client_reply on public.messages_support;
create trigger trg_naxa_support_clear_resolution_on_client_reply
after insert on public.messages_support
for each row execute function private.naxa_support_clear_resolution_on_client_reply();

-- Lecture des tickets/messages : Admin actif + espace Admin, ou propriétaire
-- Client actif + espace Client. Le chat pharmacie historique reste séparé.
drop policy if exists tickets_support_acces on public.tickets_support;
create policy tickets_support_acces
on public.tickets_support
for select
to authenticated
using (
  (
    public.is_admin()
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'::public.role_type
        and p.actif is true
    )
    and public.naxa_business_function() = 'admin'
  )
  or (
    auteur_profile_id = (select auth.uid())
    and (
      type <> 'support_naxa'
      or (
        exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid())
            and p.role = 'client'::public.role_type
            and p.actif is true
        )
        and public.naxa_business_function() = 'client'
      )
    )
  )
  or pharmacie_id = (select public.my_pharmacie())
);

drop policy if exists messages_support_acces on public.messages_support;
create policy messages_support_acces
on public.messages_support
for select
to authenticated
using (
  (
    public.is_admin()
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'::public.role_type
        and p.actif is true
    )
    and public.naxa_business_function() = 'admin'
  )
  or (
    interne = false
    and exists (
      select 1 from public.tickets_support t
      where t.id = messages_support.ticket_id
        and (
          (
            t.type = 'support_naxa'
            and t.auteur_profile_id = (select auth.uid())
            and exists (
              select 1 from public.profiles p
              where p.id = (select auth.uid())
                and p.role = 'client'::public.role_type
                and p.actif is true
            )
            and public.naxa_business_function() = 'client'
          )
          or (
            t.type <> 'support_naxa'
            and (
              t.auteur_profile_id = (select auth.uid())
              or t.pharmacie_id = (select public.my_pharmacie())
            )
          )
        )
    )
  )
);

-- Publication Supabase Realtime : seules les lignes lisibles par RLS sont diffusées.
do $publication$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'tickets_support'
    ) then
      execute 'alter publication supabase_realtime add table public.tickets_support';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages_support'
    ) then
      execute 'alter publication supabase_realtime add table public.messages_support';
    end if;
  else
    raise exception 'Publication supabase_realtime absente';
  end if;
end;
$publication$;

commit;
