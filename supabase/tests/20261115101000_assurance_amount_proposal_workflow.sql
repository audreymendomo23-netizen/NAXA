do $test$
declare
  v_propose text;
  v_propose_normal text;
  v_reply text;
  v_reply_normal text;
  v_confirm text;
  v_confirm_normal text;
  v_policy text;
  v_rls boolean;
begin
  if to_regclass('public.assurance_montant_propositions') is null then
    raise exception 'Table des propositions versionnées absente';
  end if;

  select c.relrowsecurity into v_rls
  from pg_class c
  where c.oid='public.assurance_montant_propositions'::regclass;
  if v_rls is not true then
    raise exception 'RLS doit être activée sur les propositions';
  end if;

  select qual into v_policy
  from pg_policies
  where schemaname='public'
    and tablename='assurance_montant_propositions'
    and policyname='assurance_montant_propositions_scope_read';
  if v_policy is null
     or position('client_id' in v_policy)=0
     or position('can_access_pharmacy' in v_policy)=0
     or position('is_admin' in v_policy)=0 then
    raise exception 'Lecture limitée au Client propriétaire, à la pharmacie et à l''Admin';
  end if;

  if has_table_privilege('authenticated','public.assurance_montant_propositions','INSERT')
     or has_table_privilege('authenticated','public.assurance_montant_propositions','UPDATE')
     or has_table_privilege('authenticated','public.assurance_montant_propositions','DELETE')
     or has_table_privilege('anon','public.assurance_montant_propositions','SELECT') then
    raise exception 'Les écritures directes client/anon doivent être interdites';
  end if;
  if not has_table_privilege('authenticated','public.assurance_montant_propositions','SELECT') then
    raise exception 'Le Client et la pharmacie doivent pouvoir lire l''historique via RLS';
  end if;

  if not exists (
    select 1 from pg_index i
    join pg_class c on c.oid=i.indexrelid
    where c.relname='assurance_montant_propositions_pending_dossier_uq'
      and i.indisunique and i.indpred is not null
  ) then
    raise exception 'Une seule proposition en attente par dossier doit être garantie par index';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.assurance_proposer_montant(uuid,bigint,text)','EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.assurance_proposer_montant(uuid,bigint,text)','EXECUTE'
  ) then
    raise exception 'RPC de proposition accessible uniquement aux comptes authentifiés';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.assurance_repondre_proposition_montant(uuid,boolean)','EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.assurance_repondre_proposition_montant(uuid,boolean)','EXECUTE'
  ) then
    raise exception 'RPC de réponse accessible uniquement aux comptes authentifiés';
  end if;

  v_propose:=pg_get_functiondef(
    'public.assurance_proposer_montant(uuid,bigint,text)'::regprocedure
  );
  v_reply:=pg_get_functiondef(
    'public.assurance_repondre_proposition_montant(uuid,boolean)'::regprocedure
  );
  v_confirm:=pg_get_functiondef(
    'public.assurance_confirmer_prise_en_charge(uuid,text)'::regprocedure
  );
  v_propose_normal:=regexp_replace(lower(v_propose),'\\s+',' ','g');
  v_reply_normal:=regexp_replace(lower(v_reply),'\\s+',' ','g');
  v_confirm_normal:=regexp_replace(lower(v_confirm),'\\s+',' ','g');

  if position('security definer' in v_propose_normal)=0
     or position('set search_path to ''''' in v_propose_normal)=0
     or position('private.naxa_scope_allows' in v_propose_normal)=0
     or position('p_montant_assureur_fcfa>least(' in v_propose_normal)=0
     or position('montant_modifie_le=now()' in v_propose_normal)=0
     or position('set montant_brut_fcfa' in v_propose_normal)>0
     or position('set montant_assureur_fcfa' in v_propose_normal)>0
     or position('set montant_client_fcfa' in v_propose_normal)>0 then
    raise exception 'Proposition : scope, rôle, plafond initial et snapshot monétaire immuable requis';
  end if;

  if position('p.role=''client''' in v_reply_normal)=0
     or position('p_accepter is null' in v_reply_normal)=0
     or position('v_d.client_id is distinct from v_uid' in v_reply_normal)=0
     or position('set montant_prise_en_charge=v_p.montant_assureur_fcfa' in v_reply_normal)=0
     or position('set accord_client_modification_le=now()' in v_reply_normal)=0
     or position('accord_client_refuse' in v_reply_normal)=0
     or position('set montant_assureur_fcfa' in v_reply_normal)>0 then
    raise exception 'Réponse Client : propriétaire authentifié, consentement explicite, dossier opérationnel et snapshot initial immuable requis';
  end if;

  if position('p.statut=''proposee''' in v_confirm_normal)=0
     or position('proposition de montant attend encore' in v_confirm_normal)=0 then
    raise exception 'La confirmation finale doit être bloquée tant qu''une proposition attend le Client';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.assurance_evenements'::regclass
      and conname='assurance_evenements_type_check'
      and position('accord_client_refuse' in pg_get_constraintdef(oid))>0
  ) then
    raise exception 'Le journal doit enregistrer le refus du Client';
  end if;
end
$test$;

select 'Assurance amount proposal lifecycle: versioned history, pharmacy-scoped proposing, explicit Client consent/refusal, immutable initial snapshot, pending-confirmation guard and RLS: PASS' as result;
