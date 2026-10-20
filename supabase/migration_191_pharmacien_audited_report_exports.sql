-- NAXA ERP — export CSV du rapport Pharmacien avec trace serveur préalable.
begin;

alter table public.pharmacien_audit_events
  drop constraint if exists pharmacien_audit_events_entity_type_check,
  drop constraint if exists pharmacien_audit_events_action_check;
alter table public.pharmacien_audit_events
  add constraint pharmacien_audit_events_entity_type_check
    check (entity_type in ('consultation','prescription','preparation','report')),
  add constraint pharmacien_audit_events_action_check
    check (action in ('created','status_changed','complement_requested','preparation_updated','updated','exported'));

create or replace function public.pharmacien_journaliser_export(
  p_period text,
  p_row_count integer
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  u uuid := (select auth.uid());
  p uuid;
  v_id uuid;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  if p_period is null or p_period not in ('jour','7jours','30jours','tout') then
    raise exception 'Période de rapport invalide';
  end if;
  if p_row_count is null or p_row_count < 0 or p_row_count > 500 then
    raise exception 'Nombre de lignes exportées invalide';
  end if;
  select pr.pharmacie_id into p from public.profiles pr
  join public.pharmacies f on f.id=pr.pharmacie_id and f.actif=true and f.visible_recherche=true
  where pr.id=u and pr.actif=true and pr.fonction_interne='pharmacien';
  if p is null then raise exception 'Export réservé à un compte Pharmacien actif d’une pharmacie publiée'; end if;

  insert into public.pharmacien_audit_events(
    pharmacie_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    p, u, 'report', gen_random_uuid(), 'exported',
    jsonb_build_object('period',p_period,'row_count',p_row_count,'format','csv')
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.pharmacien_journaliser_export(text,integer) from public, anon;
grant execute on function public.pharmacien_journaliser_export(text,integer) to authenticated;

comment on function public.pharmacien_journaliser_export(text,integer) is
  'Journalise côté serveur l’export CSV du rapport Pharmacien avant génération locale du fichier, sans inclure de données patient.';
commit;
