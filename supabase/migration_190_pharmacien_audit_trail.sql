-- NAXA ERP — journal d'audit Pharmacien append-only pour consultations, prescriptions et préparations.
begin;

create table if not exists public.pharmacien_audit_events (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (entity_type in ('consultation','prescription','preparation')),
  entity_id uuid not null,
  action text not null check (action in ('created','status_changed','complement_requested','preparation_updated','updated')),
  old_status text,
  new_status text,
  reason text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object')
);
create index if not exists pharmacien_audit_events_scope_date_idx
  on public.pharmacien_audit_events(pharmacie_id, occurred_at desc);
create index if not exists pharmacien_audit_events_entity_idx
  on public.pharmacien_audit_events(entity_type, entity_id, occurred_at desc);

alter table public.pharmacien_audit_events enable row level security;
revoke all on public.pharmacien_audit_events from anon, authenticated;
grant select on public.pharmacien_audit_events to authenticated;

drop policy if exists pharmacien_audit_events_read_scope on public.pharmacien_audit_events;
create policy pharmacien_audit_events_read_scope
on public.pharmacien_audit_events for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid())
      and p.actif=true
      and p.fonction_interne='pharmacien'
      and p.pharmacie_id=pharmacien_audit_events.pharmacie_id
  )
);

create or replace function public.capture_pharmacien_audit_event()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  n jsonb := to_jsonb(new);
  o jsonb;
  v_pharmacy uuid;
  v_entity uuid;
  v_actor uuid;
  v_old_status text;
  v_new_status text;
  v_action text;
  v_reason text;
  v_entity_type text;
begin
  if tg_op='UPDATE' then o := to_jsonb(old); else o := '{}'::jsonb; end if;
  v_pharmacy := nullif(n->>'pharmacie_id','')::uuid;
  v_entity := coalesce(nullif(n->>'id','')::uuid, nullif(n->>'prescription_id','')::uuid);
  v_actor := coalesce(
    nullif(n->>'validateur_id','')::uuid,
    nullif(n->>'pharmacien_id','')::uuid,
    nullif(n->>'assistant_id','')::uuid,
    nullif(n->>'created_by','')::uuid,
    (select auth.uid())
  );
  v_old_status := nullif(o->>'statut','');
  v_new_status := nullif(n->>'statut','');
  v_reason := coalesce(nullif(n->>'motif_complement',''), nullif(n->>'motif_rejet',''));
  v_entity_type := case
    when tg_table_name='consultations_pharmaceutiques' then 'consultation'
    when tg_table_name='prescription_preparations' then 'preparation'
    else 'prescription'
  end;

  if v_pharmacy is null or v_entity is null then
    raise exception 'Journal Pharmacien impossible : périmètre ou identifiant manquant';
  end if;

  if tg_op='INSERT' then
    v_action := 'created';
  elsif v_old_status is distinct from v_new_status then
    v_action := 'status_changed';
  elsif n->>'motif_complement' is distinct from o->>'motif_complement'
        and nullif(n->>'motif_complement','') is not null then
    v_action := 'complement_requested';
  elsif tg_table_name='prescription_preparations' then
    v_action := 'preparation_updated';
  else
    v_action := 'updated';
  end if;

  if tg_op='UPDATE'
     and v_old_status is not distinct from v_new_status
     and n->>'motif_complement' is not distinct from o->>'motif_complement'
     and n->>'motif_rejet' is not distinct from o->>'motif_rejet'
     and n->>'updated_at' is not distinct from o->>'updated_at' then
    return new;
  end if;

  insert into public.pharmacien_audit_events(
    pharmacie_id, actor_user_id, entity_type, entity_id, action,
    old_status, new_status, reason, metadata
  ) values (
    v_pharmacy, v_actor, v_entity_type, v_entity, v_action,
    v_old_status, v_new_status, v_reason,
    jsonb_build_object('source_table',tg_table_name,'operation',tg_op)
  );
  return new;
end;
$$;

revoke all on function public.capture_pharmacien_audit_event() from public, anon, authenticated;

drop trigger if exists capture_pharmacien_consultation_audit on public.consultations_pharmaceutiques;
create trigger capture_pharmacien_consultation_audit
after insert or update on public.consultations_pharmaceutiques
for each row execute function public.capture_pharmacien_audit_event();

drop trigger if exists capture_pharmacien_prescription_audit on public.prescriptions;
create trigger capture_pharmacien_prescription_audit
after insert or update on public.prescriptions
for each row execute function public.capture_pharmacien_audit_event();

drop trigger if exists capture_pharmacien_preparation_audit on public.prescription_preparations;
create trigger capture_pharmacien_preparation_audit
after insert or update on public.prescription_preparations
for each row execute function public.capture_pharmacien_audit_event();

-- Refuse toute mutation directe du journal par les rôles applicatifs.
create or replace function public.prevent_pharmacien_audit_event_mutation()
returns trigger language plpgsql security definer set search_path=''
as $$ begin raise exception 'Le journal d’audit Pharmacien est append-only'; end; $$;
revoke all on function public.prevent_pharmacien_audit_event_mutation() from public, anon, authenticated;
drop trigger if exists pharmacien_audit_events_no_update on public.pharmacien_audit_events;
create trigger pharmacien_audit_events_no_update before update or delete on public.pharmacien_audit_events
for each row execute function public.prevent_pharmacien_audit_event_mutation();

comment on table public.pharmacien_audit_events is
  'Journal append-only des créations et changements d’état des consultations, prescriptions et préparations dans le périmètre de la pharmacie.';
commit;
