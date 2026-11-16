-- NAXA — Gouvernance du Pharmacien par le Promoteur et effectifs indépendants de l'architecture.
-- NAXA ne vérifie ni n'approuve les professionnels de santé de la pharmacie.
-- Le Promoteur du réseau valide le justificatif et décide du poste, pour chaque pharmacie.
-- Plusieurs agents peuvent partager une fonction ; un seul Responsable peut être actif à la fois.
-- Aucun compteur d'architecture, chiffre d'affaires ou journal comptable n'est modifié.

begin;

-- Renommer les états afin que l'autorité de décision soit explicitement le Promoteur.
alter table public.naxa_pharmacien_accreditations
  drop constraint if exists naxa_pharmacien_accreditations_status_check;
alter table public.naxa_pharmacien_accreditations
  drop constraint if exists naxa_pharmacien_accreditations_check1;

-- Une éventuelle ancienne décision Admin n'est pas une validation NAXA valable :
-- elle redevient une proposition que le Promoteur doit examiner lui-même.
update public.naxa_professional_assignments a
set statut='revoked',
    revoque_par=coalesce(a.revoque_par,a.accorde_par),
    revoque_at=coalesce(a.revoque_at,now()),
    motif_revocation=coalesce(a.motif_revocation,'Réexamen requis par le Promoteur selon la règle métier')
where a.id in (
  select accreditation.assignment_id
  from public.naxa_pharmacien_accreditations accreditation
  where accreditation.assignment_id is not null
    and accreditation.status in ('approved','revoked')
)
and a.statut='active';

update public.naxa_pharmacien_accreditations
set status='pending_promoter',
    reviewed_by=null,
    reviewed_at=null,
    review_note=null,
    assignment_id=null,
    updated_at=now()
where status in ('pending_admin','approved','rejected','revoked');

alter table public.naxa_pharmacien_accreditations
  add constraint naxa_pharmacien_accreditations_status_check
  check (status in ('pending_promoter','approved_promoteur','rejected_promoteur','revoked_promoteur'));

alter table public.naxa_pharmacien_accreditations
  add constraint naxa_pharmacien_accreditations_review_state_check
  check (
    (status='pending_promoter' and reviewed_by is null and reviewed_at is null and assignment_id is null)
    or (status='approved_promoteur' and reviewed_by is not null and reviewed_at is not null and assignment_id is not null)
    or (status='rejected_promoteur' and reviewed_by is not null and reviewed_at is not null and assignment_id is null)
    or (status='revoked_promoteur' and reviewed_by is not null and reviewed_at is not null and assignment_id is not null)
  );

drop index if exists public.naxa_pharmacien_accreditations_one_pending_idx;
create unique index naxa_pharmacien_accreditations_one_pending_idx
  on public.naxa_pharmacien_accreditations(profile_id,pharmacie_id)
  where status='pending_promoter';

-- Mettre à jour le RPC de proposition existant, sans toucher au document ni aux champs métier.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.naxa_proposer_accreditation_pharmacien(uuid,uuid,text,text,text,text,date,text)'::regprocedure
  ) into v_definition;

  v_definition:=replace(v_definition,'pending_admin','pending_promoter');
  v_definition:=replace(v_definition,'attend l’Administrateur','attend la décision du Promoteur');
  v_definition:=replace(v_definition,'approved''','approved_promoteur''');
  if position('pending_promoter' in v_definition)=0
     or position('approved_promoteur' in v_definition)=0 then
    raise exception 'Mise à jour du RPC de proposition Pharmacien incomplète';
  end if;
  execute v_definition;
end
$migration$;

-- Le Promoteur, et lui seul, valide, refuse ou retire l'agrément dans son propre réseau.
create or replace function public.naxa_promoteur_decider_accreditation_pharmacien(
  p_accreditation uuid,
  p_decision text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_accreditation public.naxa_pharmacien_accreditations%rowtype;
  v_assignment uuid;
begin
  if v_actor is null
     or private.naxa_business_function(v_actor)<>'promoteur'
     or not private.naxa_promoteur_valide(v_actor) then
    raise exception 'Décision réservée au Promoteur actif et valide' using errcode='42501';
  end if;
  if p_decision not in ('approve','reject','revoke') then
    raise exception 'Décision Pharmacien invalide' using errcode='22023';
  end if;
  if p_decision in ('reject','revoke') and length(trim(coalesce(p_note,'')))<5 then
    raise exception 'Un motif de refus ou de retrait est obligatoire' using errcode='22023';
  end if;

  select * into v_accreditation
  from public.naxa_pharmacien_accreditations
  where id=p_accreditation
    and proposed_by=v_actor
  for update;
  if not found then
    raise exception 'Dossier absent ou hors réseau du Promoteur' using errcode='42501';
  end if;

  if not exists(
    select 1 from public.promoteur_pharmacies pp
    join public.pharmacies ph on ph.id=pp.pharmacie_id
    where pp.promoteur_id=v_actor
      and pp.pharmacie_id=v_accreditation.pharmacie_id
      and pp.actif=true and ph.actif=true and ph.archivee_le is null
  ) then
    raise exception 'Le Promoteur ne gère plus cette pharmacie' using errcode='42501';
  end if;

  if p_decision='approve' then
    if v_accreditation.status<>'pending_promoter' then
      raise exception 'Seule une proposition en attente du Promoteur peut être validée' using errcode='23514';
    end if;
    if v_accreditation.valid_until is not null
       and v_accreditation.valid_until<current_date then
      raise exception 'Le justificatif professionnel a expiré' using errcode='23514';
    end if;
    if not exists(
      select 1 from public.profiles p
      where p.id=v_accreditation.profile_id and p.actif=true
    ) or not exists(
      select 1 from public.pharmacies ph
      where ph.id=v_accreditation.pharmacie_id and ph.actif=true and ph.archivee_le is null
    ) or not exists(
      select 1 from storage.objects o
      where o.bucket_id='naxa-pharmacien-accreditations'
        and o.name=v_accreditation.credential_storage_path
        and coalesce(o.metadata->>'mimetype','') in ('application/pdf','image/jpeg','image/png')
    ) then
      raise exception 'Compte, pharmacie ou justificatif indisponible' using errcode='23514';
    end if;
    if exists(
      select 1 from public.naxa_professional_assignments a
      where a.profile_id=v_accreditation.profile_id
        and a.pharmacie_id=v_accreditation.pharmacie_id
        and a.role_code='pharmacien' and a.statut='active'
        and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now())
    ) then
      raise exception 'Ce compte possède déjà un poste Pharmacien actif dans cette pharmacie';
    end if;

    insert into public.naxa_professional_assignments(
      profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
      commence_at,expire_at,accorde_par
    ) values(
      v_accreditation.profile_id,v_accreditation.pharmacie_id,'pharmacien','pharmacien',
      'active','ordinaire',v_accreditation.motif,now(),null,v_actor
    ) returning id into v_assignment;

    update public.naxa_pharmacien_accreditations
    set status='approved_promoteur',reviewed_by=v_actor,reviewed_at=now(),
        review_note=nullif(trim(coalesce(p_note,'')),''),assignment_id=v_assignment,updated_at=now()
    where id=p_accreditation;
    return v_assignment;
  end if;

  if p_decision='reject' then
    if v_accreditation.status<>'pending_promoter' then
      raise exception 'Seule une proposition en attente peut être refusée' using errcode='23514';
    end if;
    update public.naxa_pharmacien_accreditations
    set status='rejected_promoteur',reviewed_by=v_actor,reviewed_at=now(),
        review_note=trim(p_note),updated_at=now()
    where id=p_accreditation;
    return null;
  end if;

  if v_accreditation.status<>'approved_promoteur' or v_accreditation.assignment_id is null then
    raise exception 'Seul un agrément validé peut être retiré' using errcode='23514';
  end if;
  update public.naxa_professional_assignments
  set statut='revoked',revoque_par=v_actor,revoque_at=now(),
      motif_revocation=trim(p_note)
  where id=v_accreditation.assignment_id and statut='active';
  if not found then
    raise exception 'Affectation Pharmacien déjà retirée ou expirée';
  end if;
  update public.naxa_pharmacien_accreditations
  set status='revoked_promoteur',reviewed_by=v_actor,reviewed_at=now(),
      review_note=trim(p_note),updated_at=now()
  where id=p_accreditation;
  return v_accreditation.assignment_id;
end
$function$;

revoke all on function public.naxa_promoteur_decider_accreditation_pharmacien(uuid,text,text) from public,anon;
grant execute on function public.naxa_promoteur_decider_accreditation_pharmacien(uuid,text,text) to authenticated;

-- L'ancienne RPC d'approbation Admin est neutralisée définitivement.
revoke all on function public.naxa_admin_decider_accreditation_pharmacien(uuid,text,text)
  from public,anon,authenticated,service_role;

-- Les résolveurs de poste ne reconnaissent que la décision du Promoteur.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef('private.naxa_business_function(uuid)'::regprocedure)
    into v_definition;
  if position('a.status=''approved_promoteur''' in v_definition)=0 then
    if position('a.status=''approved''' in v_definition)=0 then
      raise exception 'Résolveur métier Pharmacien inattendu';
    end if;
    v_definition:=replace(v_definition,'a.status=''approved''','a.status=''approved_promoteur''');
    execute v_definition;
  end if;

  select pg_get_functiondef('public.naxa_select_active_role(text,uuid,uuid)'::regprocedure)
    into v_definition;
  if position('accreditation.status=''approved_promoteur''' in v_definition)=0 then
    if position('accreditation.status=''approved''' in v_definition)=0 then
      raise exception 'Sélecteur de rôle Pharmacien inattendu';
    end if;
    v_definition:=replace(
      v_definition,
      'accreditation.status=''approved''',
      'accreditation.status=''approved_promoteur'''
    );
    execute v_definition;
  end if;
end
$migration$;

-- L'affectation générique ne peut pas bypasser le circuit de validation du Promoteur.
-- Elle accepte les autres rôles assignables, y compris plusieurs agents de même fonction.
do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.naxa_grant_professional_assignment(uuid,uuid,text,timestamp with time zone,timestamp with time zone,text)'::regprocedure
  ) into v_definition;

  v_old := 'if p_fonction=''pharmacien'' then raise exception ''Le poste Pharmacien exige une proposition et une validation administrative'' using errcode=''42501''; end if;';
  v_new := 'if p_fonction=''pharmacien'' then raise exception ''Le poste Pharmacien doit être validé par le Promoteur du réseau'' using errcode=''42501''; end if;';
  if position(v_new in v_definition)=0 then
    if position(v_old in v_definition)=0 then
      raise exception 'Garde Pharmacien de l''affectation générique inattendue';
    end if;
    v_definition:=replace(v_definition,v_old,v_new);
  end if;

  v_old := E'where a.pharmacie_id=p_pharmacie and a.role_code=''responsable''\n      and a.statut=''active'' and a.commence_at<=now()\n      and (a.expire_at is null or a.expire_at>now());\n    if v_count>=coalesce(v_max_responsables,0) then\n      raise exception ''Quota Responsables atteint'';';
  v_new := E'where a.pharmacie_id=p_pharmacie and a.role_code=''responsable''\n      and a.statut=''active''\n      and a.commence_at<coalesce(p_expire_at,''infinity''::timestamptz)\n      and (a.expire_at is null or a.expire_at>p_commence_at);\n    if v_count>0 then\n      raise exception ''Cette pharmacie possède déjà un Responsable sur cette période'';';
  if position(v_new in v_definition)=0 then
    if position(v_old in v_definition)=0 then
      raise exception 'Contrôle du Responsable de l''affectation générique inattendu';
    end if;
    v_definition:=replace(v_definition,v_old,v_new);
  end if;

  v_old := E'\n  if p_fonction=''caisse'' and v_max_caisses is not null then\n    perform pg_advisory_xact_lock(hashtextextended(''naxa-caisse-quota:''||p_pharmacie::text,0));\n    select count(*) into v_count\n    from public.naxa_professional_assignments a\n    join public.profiles p on p.id=a.profile_id and p.actif=true\n    where a.pharmacie_id=p_pharmacie and a.role_code=''caisse''\n      and a.statut=''active'' and a.commence_at<=now()\n      and (a.expire_at is null or a.expire_at>now())\n      and a.profile_id<>p_target;\n    if v_count>=v_max_caisses then raise exception ''Quota Caisses atteint''; end if;\n  end if;\n';
  if position('Quota Caisses atteint' in v_definition)>0 then
    if position(v_old in v_definition)=0 then
      raise exception 'Bloc de quota Caisses inattendu dans l''affectation générique';
    end if;
    v_definition:=replace(v_definition,v_old,E'\n');
  end if;
  execute v_definition;
end
$migration$;

-- Réactivation Caisse : l'architecture vérifie l'existence du niveau Caisse,
-- mais ne plafonne plus le nombre d'utilisateurs Caisse.
do $migration$
declare
  v_definition text;
  v_old text;
begin
  select pg_get_functiondef(
    'public.naxa_set_professional_assignment_status(uuid,uuid,boolean)'::regprocedure
  ) into v_definition;
  v_old := E'    if v_max is not null then\n      perform pg_advisory_xact_lock(hashtextextended(''naxa-caisse-quota:''||p_pharmacie::text,0));\n      select count(*) into v_count from public.naxa_professional_assignments a\n      join public.profiles p on p.id=a.profile_id and p.actif\n      where a.pharmacie_id=p_pharmacie and a.role_code=''caisse''\n        and a.statut=''active'' and a.commence_at<=now()\n        and (a.expire_at is null or a.expire_at>now())\n        and a.profile_id<>p_target;\n      if v_count>=v_max then raise exception ''Quota Caisses atteint''; end if;\n    end if;\n';
  if position('Quota Caisses atteint' in v_definition)>0 then
    if position(v_old in v_definition)=0 then
      raise exception 'Bloc de quota Caisses inattendu dans la réactivation';
    end if;
    v_definition:=replace(v_definition,v_old,'');
    execute v_definition;
  end if;
end
$migration$;

-- Invariant DB : empêche aussi une deuxième affectation Responsable concurrente
-- si une autre RPC tente un INSERT direct dans la table.
create or replace function private.naxa_guard_one_responsable_per_pharmacy()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if new.role_code<>'responsable' or new.statut<>'active' then
    return new;
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('naxa-responsable-quota:'||new.pharmacie_id::text,0)
  );
  if exists(
    select 1
    from public.naxa_professional_assignments a
    where a.pharmacie_id=new.pharmacie_id
      and a.role_code='responsable'
      and a.statut='active'
      and a.id is distinct from new.id
      and a.commence_at<coalesce(new.expire_at,'infinity'::timestamptz)
      and (a.expire_at is null or a.expire_at>new.commence_at)
  ) then
    raise exception 'Une pharmacie ne peut avoir qu''un seul Responsable actif sur une même période'
      using errcode='23505';
  end if;
  return new;
end
$function$;

drop trigger if exists naxa_one_responsable_per_pharmacy on public.naxa_professional_assignments;
create trigger naxa_one_responsable_per_pharmacy
before insert or update of pharmacie_id,role_code,statut,commence_at,expire_at
on public.naxa_professional_assignments
for each row execute function private.naxa_guard_one_responsable_per_pharmacy();

commit;
