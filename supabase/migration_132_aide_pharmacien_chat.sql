-- NAXA 132 — phase 1 « Besoin d'aide ? » : chat gratuit client–pharmacie.
-- Additif : réutilise tickets_support/messages_support, sans créer un canal parallèle.
begin;

create index if not exists tickets_support_conseil_client_idx
  on public.tickets_support (auteur_profile_id, created_at desc)
  where type = 'conseil_pharmacien';
create index if not exists tickets_support_conseil_pharmacie_idx
  on public.tickets_support (pharmacie_id, created_at desc)
  where type = 'conseil_pharmacien';
create index if not exists messages_support_ticket_created_idx
  on public.messages_support (ticket_id, created_at);

-- Un client ne peut ouvrir un chat que pour une pharmacie active et visible.
drop policy if exists tickets_support_client_create_pharmacist_chat on public.tickets_support;
create policy tickets_support_client_create_pharmacist_chat
on public.tickets_support
for insert
to authenticated
with check (
  auteur_profile_id = (select auth.uid())
  and pharmacie_id is not null
  and type = 'conseil_pharmacien'
  and statut = 'ouvert'
  and exists (
    select 1
    from public.profiles me
    join public.pharmacies p on p.id = tickets_support.pharmacie_id
    where me.id = (select auth.uid())
      and me.role = 'client'::public.role_type
      and coalesce(me.actif, true)
      and p.actif = true
      and p.visible_recherche = true
      and p.archivee_le is null
  )
);

-- Le participant ne voit jamais les notes internes du support ; seuls les admins
-- conservent l'accès aux notes internes.
drop policy if exists messages_support_acces on public.messages_support;
create policy messages_support_acces
on public.messages_support
for select
to authenticated
using (
  (select public.is_admin())
  or (
    interne = false
    and exists (
      select 1
      from public.tickets_support t
      where t.id = messages_support.ticket_id
        and (
          t.auteur_profile_id = (select auth.uid())
          or t.pharmacie_id = (select public.my_pharmacie())
        )
    )
  )
);

-- Un message public ne peut être envoyé que par le client du ticket ou
-- par un compte pharmacie rattaché à la pharmacie choisie. Les notes internes
-- ne sont jamais accessibles par cette politique.
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
      and t.statut = 'ouvert'
      and (
        (t.auteur_profile_id = (select auth.uid()) and me.role = 'client'::public.role_type)
        or
        (t.pharmacie_id = (select public.my_pharmacie())
          and me.role = 'pharmacie'::public.role_type)
      )
  )
);

-- Création atomique du ticket et de son premier message.
create or replace function public.open_pharmacist_chat(p_pharmacy_id uuid, p_message text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_ticket_id uuid;
  v_message text := btrim(coalesce(p_message, ''));
begin
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if length(v_message) < 1 or length(v_message) > 2000 then
    raise exception 'Le message doit contenir entre 1 et 2000 caractères' using errcode = '22023';
  end if;

  insert into public.tickets_support (auteur_profile_id, pharmacie_id, sujet, type, statut)
  values (auth.uid(), p_pharmacy_id, 'Conseil pharmacien', 'conseil_pharmacien', 'ouvert')
  returning id into v_ticket_id;

  insert into public.messages_support (ticket_id, auteur_profile_id, contenu, interne)
  values (v_ticket_id, auth.uid(), v_message, false);

  return v_ticket_id;
end;
$function$;

revoke all on function public.open_pharmacist_chat(uuid, text) from public, anon;
grant execute on function public.open_pharmacist_chat(uuid, text) to authenticated;

create or replace function public.support_chat_mark_first_response()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  update public.tickets_support t
  set first_response_at = coalesce(t.first_response_at, new.created_at)
  where t.id = new.ticket_id
    and t.first_response_at is null
    and t.auteur_profile_id <> new.auteur_profile_id
    and t.pharmacie_id = (
      select p.pharmacie_id from public.profiles p where p.id = new.auteur_profile_id
    );
  return new;
end;
$function$;

revoke all on function public.support_chat_mark_first_response() from public, anon, authenticated;
drop trigger if exists support_chat_mark_first_response on public.messages_support;
create trigger support_chat_mark_first_response
after insert on public.messages_support
for each row execute function public.support_chat_mark_first_response();

commit;
