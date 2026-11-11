-- NAXA — empêcher la création d'un dossier Parapharmacie sur une identité Pharmacie.
begin;

do $patch$
declare
  v_sql text;
  v_old text;
  v_new text;
begin
  v_sql:=pg_get_functiondef(
    'public.admin_create_partner_dossier(uuid,text,text,text,text,text,text,numeric,numeric,text,bigint,text,jsonb)'::regprocedure
  );

  v_old:=$old$
  if p_owner_user_id is null or not exists (
    select 1 from public.profiles where id=p_owner_user_id
  ) then raise exception 'Compte Promoteur introuvable' using errcode = '23503'; end if;
  -- Le compte propriétaire reste suspendu tant que le dossier est en attente.
  update public.profiles set actif=false where id=p_owner_user_id;
$old$;

  v_new:=$new$
  if p_owner_user_id is null or not exists (
    select 1 from public.profiles where id=p_owner_user_id
  ) then raise exception 'Compte titulaire introuvable' using errcode = '23503'; end if;

  if p_universe_slug='parapharmacie' and not exists (
    select 1
    from public.profiles p
    join auth.users u on u.id=p.id
    where p.id=p_owner_user_id
      and p.role::text='client'
      and p.username is not null
      and p.first_name is not null
      and p.last_name is not null
      and p.phone is not null
      and p.date_of_birth is not null
      and p.date_of_birth <= (current_date-interval '18 years')::date
      and p.age_verified=true
      and p.consent_accepted_at is not null
      and u.email_confirmed_at is not null
      and not exists (
        select 1 from public.naxa_professional_account_domains d
        where d.profile_id=p.id and d.domain_code='PHARMACIE'
      )
      and not exists (
        select 1 from public.naxa_professional_assignments a
        where a.profile_id=p.id
      )
      and not exists (
        select 1 from public.promoteur_pharmacies pp
        where pp.promoteur_id=p.id
      )
  ) then
    raise exception 'La Parapharmacie exige une identité distincte : compte Client NAXA complet, majeur, consentant et e-mail confirmé, sans rattachement Pharmacie.'
      using errcode='23514';
  end if;

  -- Le compte titulaire reste suspendu tant que le dossier est en attente.
  update public.profiles set actif=false where id=p_owner_user_id;
$new$;

  if position(v_old in v_sql)=0 then
    raise exception 'Bloc de contrôle du compte titulaire introuvable dans admin_create_partner_dossier';
  end if;
  execute replace(v_sql,v_old,v_new);
end;
$patch$;

commit;
