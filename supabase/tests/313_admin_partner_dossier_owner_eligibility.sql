-- NAXA — la RPC Admin n'accepte qu'un compte Client complet et majeur comme titulaire.
begin;

do $test$
declare
  v_admin uuid;
  v_owner uuid;
  v_partner_id uuid;
  v_email_confirmed_at timestamptz;
  v_state text;
  v_message text;
  v_definition text;
  v_partners_before bigint;
  v_members_before bigint;
  v_centers_before bigint;
  v_dossiers_before bigint;
  v_audit_before bigint;
begin
  select p.id into v_admin
  from public.profiles p
  join auth.users u on u.id=p.id
  where p.role::text='admin'
    and p.actif is true
    and u.email_confirmed_at is not null
  order by p.created_at
  limit 1;

  select p.id, u.email_confirmed_at
    into v_owner, v_email_confirmed_at
  from public.profiles p
  join auth.users u on u.id=p.id
  where p.role::text='client'
    and p.actif is true
    and p.age_verified is true
    and p.date_of_birth is not null
    and p.date_of_birth <= (timezone('Africa/Douala', now())::date - interval '18 years')::date
    and p.consent_accepted_at is not null
    and nullif(btrim(u.email), '') is not null
    and u.email_confirmed_at is not null
  order by p.created_at
  limit 1;

  if v_admin is null or v_owner is null then
    raise exception 'Fixtures requises absentes : Admin actif et Client admissible';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_admin,'role','authenticated')::text, true);

  if auth.uid() is distinct from v_admin or not public.is_admin() then
    raise exception 'Le contexte Admin de test est invalide';
  end if;

  select pg_get_functiondef(
    'public.admin_create_partner_dossier(uuid,text,text,text,text,text,text,numeric,numeric,text,bigint,text,jsonb)'::regprocedure
  ) into v_definition;

  if position('owner_profile.role::text = ''client''' in v_definition)=0
     or position('owner_profile.actif is true' in v_definition)=0
     or position('owner_profile.age_verified is true' in v_definition)=0
     or position('owner_profile.date_of_birth <=' in v_definition)=0
     or position('owner_profile.consent_accepted_at is not null' in v_definition)=0
     or position('owner_auth.email_confirmed_at is not null' in v_definition)=0 then
    raise exception 'La RPC ne contient pas toutes les gardes d''éligibilité attendues';
  end if;

  select count(*) into v_partners_before from public.partners;
  select count(*) into v_members_before from public.partner_members;
  select count(*) into v_centers_before from public.exam_centers;
  select count(*) into v_dossiers_before from public.admin_partner_dossiers;
  select count(*) into v_audit_before
  from public.audit_log
  where action='partner.dossier_created'
    and entity_type='admin_partner_dossier';

  -- Un titulaire admissible passe ; le sous-test est aussitôt annulé.
  begin
    v_partner_id := public.admin_create_partner_dossier(
      v_owner,
      'NAXA TEST ROLLBACK EXAMENS',
      'centre_examen',
      'examens',
      'Yaoundé',
      'Test sécurité',
      'Adresse de test transactionnel',
      null,
      null,
      null,
      1,
      null,
      '{}'::jsonb
    );
    if v_partner_id is null then
      raise exception 'La RPC n''a pas retourné de partenaire';
    end if;
    raise exception '__NAXA_EXPECTED_ROLLBACK__';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    if v_message <> '__NAXA_EXPECTED_ROLLBACK__' then
      raise exception 'Le titulaire admissible a été rejeté : SQLSTATE %, %', v_state, v_message;
    end if;
  end;

  if not exists(select 1 from public.profiles where id=v_owner and actif is true) then
    raise exception 'Le rollback du cas positif n''a pas restauré le compte Client';
  end if;

  -- Un compte Admin n'est pas un compte Client admissible.
  begin
    perform public.admin_create_partner_dossier(
      v_admin,'NAXA TEST INVALID','centre_examen','examens','Yaoundé','Test',
      'Adresse test',null,null,null,1,null,'{}'::jsonb
    );
    raise exception 'TEST_FAIL_NON_CLIENT_ACCEPTED';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    if v_state <> '23514' or position('Le titulaire doit être un Client actif' in v_message)=0 then
      raise exception 'Le compte non-Client a échoué pour une cause inattendue : SQLSTATE %, %', v_state, v_message;
    end if;
  end;

  -- Compte Client inactif.
  update public.profiles set actif=false where id=v_owner;
  begin
    perform public.admin_create_partner_dossier(
      v_owner,'NAXA TEST INVALID','centre_examen','examens','Yaoundé','Test',
      'Adresse test',null,null,null,1,null,'{}'::jsonb
    );
    raise exception 'TEST_FAIL_INACTIVE_CLIENT_ACCEPTED';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    if v_state <> '23514' or position('Le titulaire doit être un Client actif' in v_message)=0 then
      raise exception 'Le Client inactif a échoué pour une cause inattendue : SQLSTATE %, %', v_state, v_message;
    end if;
  end;
  update public.profiles set actif=true where id=v_owner;

  -- Vérification d'âge manquante.
  update public.profiles set age_verified=false where id=v_owner;
  begin
    perform public.admin_create_partner_dossier(
      v_owner,'NAXA TEST INVALID','centre_examen','examens','Yaoundé','Test',
      'Adresse test',null,null,null,1,null,'{}'::jsonb
    );
    raise exception 'TEST_FAIL_AGE_UNVERIFIED_ACCEPTED';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    if v_state <> '23514' or position('Le titulaire doit être un Client actif' in v_message)=0 then
      raise exception 'Le Client sans vérification d''âge a échoué pour une cause inattendue : SQLSTATE %, %', v_state, v_message;
    end if;
  end;
  update public.profiles set age_verified=true where id=v_owner;

  -- Une date de naissance correspondant à un mineur doit être refusée même si le drapeau est vrai.
  update public.profiles
  set date_of_birth=(timezone('Africa/Douala', now())::date - interval '17 years')::date
  where id=v_owner;
  begin
    perform public.admin_create_partner_dossier(
      v_owner,'NAXA TEST INVALID','centre_examen','examens','Yaoundé','Test',
      'Adresse test',null,null,null,1,null,'{}'::jsonb
    );
    raise exception 'TEST_FAIL_MINOR_CLIENT_ACCEPTED';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    if v_state <> '23514' or position('Le titulaire doit être un Client actif' in v_message)=0 then
      raise exception 'Le mineur a échoué pour une cause inattendue : SQLSTATE %, %', v_state, v_message;
    end if;
  end;
  update public.profiles
  set date_of_birth=(timezone('Africa/Douala', now())::date - interval '36 years')::date
  where id=v_owner;

  -- Consentement absent.
  update public.profiles set consent_accepted_at=null where id=v_owner;
  begin
    perform public.admin_create_partner_dossier(
      v_owner,'NAXA TEST INVALID','centre_examen','examens','Yaoundé','Test',
      'Adresse test',null,null,null,1,null,'{}'::jsonb
    );
    raise exception 'TEST_FAIL_NO_CONSENT_ACCEPTED';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    if v_state <> '23514' or position('Le titulaire doit être un Client actif' in v_message)=0 then
      raise exception 'Le Client sans consentement a échoué pour une cause inattendue : SQLSTATE %, %', v_state, v_message;
    end if;
  end;
  update public.profiles set consent_accepted_at=now() where id=v_owner;

  -- Email non confirmé.
  update auth.users set email_confirmed_at=null where id=v_owner;
  begin
    perform public.admin_create_partner_dossier(
      v_owner,'NAXA TEST INVALID','centre_examen','examens','Yaoundé','Test',
      'Adresse test',null,null,null,1,null,'{}'::jsonb
    );
    raise exception 'TEST_FAIL_UNCONFIRMED_EMAIL_ACCEPTED';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    if v_state <> '23514' or position('Le titulaire doit être un Client actif' in v_message)=0 then
      raise exception 'Le Client avec email non confirmé a échoué pour une cause inattendue : SQLSTATE %, %', v_state, v_message;
    end if;
  end;
  update auth.users set email_confirmed_at=v_email_confirmed_at where id=v_owner;

  if (select count(*) from public.partners) <> v_partners_before
     or (select count(*) from public.partner_members) <> v_members_before
     or (select count(*) from public.exam_centers) <> v_centers_before
     or (select count(*) from public.admin_partner_dossiers) <> v_dossiers_before
     or (select count(*) from public.audit_log
         where action='partner.dossier_created'
           and entity_type='admin_partner_dossier') <> v_audit_before then
    raise exception 'Le test a laissé des écritures métier ou des événements d''audit';
  end if;
end
$test$;

rollback;
select '313_admin_partner_dossier_owner_eligibility PASS — positif rollback + 6 refus + aucun résiduel' as resultat;
