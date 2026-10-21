-- Tests structurels de l’outbox Comptable (après migration_20261021_compta_outbox.sql).
begin;

do $test$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.ventes'::regclass and tgname='compta_outbox_vente_encaissee'
      and not tgisinternal
  ) then raise exception 'Trigger outbox ventes absent'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.depenses'::regclass and tgname='compta_outbox_depense_validee'
      and not tgisinternal
  ) then raise exception 'Trigger outbox dépenses absent'; end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.compta_evenement'::regclass
      and conname='compta_evenement_statut_check'
      and pg_get_constraintdef(oid) like '%en_cours%'
  ) then raise exception 'Statut de réclamation en_cours absent'; end if;

  if has_function_privilege('authenticated','public.compta_evenements_reclamer(integer)','EXECUTE') then
    raise exception 'Un utilisateur authentifié peut réclamer la file comptable';
  end if;
  if has_function_privilege('authenticated','public.compta_evenement_terminer(uuid,uuid,boolean,text)','EXECUTE') then
    raise exception 'Un utilisateur authentifié peut finaliser la file comptable';
  end if;
  if not has_function_privilege('service_role','public.compta_evenements_reclamer(integer)','EXECUTE') then
    raise exception 'service_role ne peut pas réclamer la file comptable';
  end if;
  if not has_function_privilege('service_role','public.compta_evenement_terminer(uuid,uuid,boolean,text)','EXECUTE') then
    raise exception 'service_role ne peut pas finaliser la file comptable';
  end if;
end;
$test$;

rollback;
select '161_compta_outbox PASS' as resultat;
