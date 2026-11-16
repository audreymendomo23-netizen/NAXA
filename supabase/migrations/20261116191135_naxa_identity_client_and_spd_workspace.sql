begin;

insert into public.naxa_roles(code,libelle,description,categorie,portee,assignable,actif)
values('prestations','Prestations à domicile','Accès à un espace professionnel SPD selon un membership actif.','PROFESSIONNEL','RESEAU',false,true)
on conflict(code) do update set libelle=excluded.libelle,description=excluded.description,
 categorie=excluded.categorie,portee=excluded.portee,assignable=false,actif=true;

create or replace function private.naxa_partner_business_function(p_profile uuid)
returns text language sql stable security definer set search_path=''
as $function$
  select case when pa.partner_type='professionnel_domicile' then 'prestations' else ar.role_code end
  from public.naxa_profile_active_roles ar
  join public.profiles p on p.id=ar.profile_id and p.actif=true
  join public.partners pa on pa.id=ar.partner_id and pa.status='active'
  where ar.profile_id=p_profile and ar.partner_id is not null and ar.pharmacie_id is null
    and (
      (pa.partner_type='parapharmacie'
       and ar.role_code<>'prestations'
       and exists(select 1 from public.naxa_professional_account_domains d
         where d.profile_id=p.id and d.domain_code='PARAPHARMACIE')
       and exists(select 1 from public.naxa_partner_architectures aa
         where aa.partner_id=pa.id and aa.active=true)
       and (
         (ar.role_code='promoteur' and exists(select 1 from public.partner_members pm
           where pm.partner_id=pa.id and pm.user_id=p.id and pm.member_role='owner'))
         or exists(select 1 from public.naxa_partner_professional_assignments a
           where a.profile_id=p.id and a.partner_id=pa.id and a.role_code=ar.role_code
             and a.statut='active' and a.commence_at<=now()
             and (a.expire_at is null or a.expire_at>now()))
       ))
      or
      (pa.partner_type='professionnel_domicile' and ar.role_code='prestations'
       and exists(select 1 from public.partner_universes pu
         where pu.partner_id=pa.id and pu.universe_slug='prestations' and pu.enabled=true)
       and exists(select 1 from public.partner_members pm
         where pm.partner_id=pa.id and pm.user_id=p.id
           and pm.member_role in ('owner','manager','operator')))
    )
  limit 1
$function$;

do $patch$
declare v_definition text; v_old text; v_new text;
begin
 select pg_get_functiondef('private.naxa_business_function_base(uuid)'::regprocedure) into v_definition;
 v_old := '(ar.role_code=''client'' and p.role::text=''client'' and ar.pharmacie_id is null)';
 v_new := '(ar.role_code=''client'' and p.role::text<>''admin'' and ar.pharmacie_id is null
              and p.username is not null and p.first_name is not null and p.last_name is not null
              and p.phone is not null and p.date_of_birth is not null
              and p.date_of_birth<=(current_date-interval ''18 years'')::date
              and p.age_verified=true and p.consent_accepted_at is not null)';
 if position(v_new in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Client role predicate changed; abort patch'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
   execute v_definition;
 end if;

 select pg_get_functiondef('public.naxa_select_active_role(text,uuid,uuid)'::regprocedure) into v_definition;
 v_old := 'v_allowed:=v_profile.role::text=p_role_code;';
 v_new := 'v_allowed:=case when p_role_code=''client'' then
      v_profile.role::text<>''admin''
      and v_profile.username is not null and v_profile.first_name is not null
      and v_profile.last_name is not null and v_profile.phone is not null
      and v_profile.date_of_birth is not null
      and v_profile.date_of_birth<=(current_date-interval ''18 years'')::date
      and v_profile.age_verified=true and v_profile.consent_accepted_at is not null
    else v_profile.role::text=p_role_code end;';
 if position(v_new in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Active-role root predicate changed; abort patch'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;

 v_old := $old$
    if not exists (
      select 1 from public.partners pa
      join public.naxa_partner_architectures aa on aa.partner_id=pa.id and aa.active=true
      join public.naxa_professional_account_domains d
        on d.profile_id=v_uid and d.domain_code='PARAPHARMACIE'
      where pa.id=p_partner_id and pa.partner_type='parapharmacie' and pa.status='active'
    ) then raise exception 'Établissement Parapharmacie hors périmètre ou inactif'; end if;

    if p_role_code='promoteur' then
      v_allowed:=exists (
        select 1 from public.partner_members pm
        where pm.partner_id=p_partner_id and pm.user_id=v_uid and pm.member_role='owner'
      );
    else
      v_allowed:=exists (
        select 1 from public.naxa_partner_professional_assignments a
        where a.profile_id=v_uid and a.partner_id=p_partner_id
          and a.role_code=p_role_code and a.statut='active'
          and a.commence_at<=now()
          and (a.expire_at is null or a.expire_at>now())
      );
    end if;
$old$;
 v_new := $new$
    if p_role_code='prestations' then
      v_allowed:=exists (
        select 1 from public.partners pa
        join public.partner_universes pu on pu.partner_id=pa.id
          and pu.universe_slug='prestations' and pu.enabled=true
        join public.partner_members pm on pm.partner_id=pa.id and pm.user_id=v_uid
          and pm.member_role in ('owner','manager','operator')
        where pa.id=p_partner_id and pa.partner_type='professionnel_domicile'
          and pa.status='active'
      );
    else
      if not exists (
        select 1 from public.partners pa
        join public.naxa_partner_architectures aa on aa.partner_id=pa.id and aa.active=true
        join public.naxa_professional_account_domains d
          on d.profile_id=v_uid and d.domain_code='PARAPHARMACIE'
        where pa.id=p_partner_id and pa.partner_type='parapharmacie' and pa.status='active'
      ) then raise exception 'Établissement Parapharmacie hors périmètre ou inactif'; end if;

      if p_role_code='promoteur' then
        v_allowed:=exists (
          select 1 from public.partner_members pm
          where pm.partner_id=p_partner_id and pm.user_id=v_uid and pm.member_role='owner'
        );
      else
        v_allowed:=exists (
          select 1 from public.naxa_partner_professional_assignments a
          where a.profile_id=v_uid and a.partner_id=p_partner_id
            and a.role_code=p_role_code and a.statut='active'
            and a.commence_at<=now()
            and (a.expire_at is null or a.expire_at>now())
        );
      end if;
    end if;
$new$;
 if position('pa.partner_type=''professionnel_domicile''' in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Partner active-role block changed; abort patch'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;
 execute v_definition;
end
$patch$;

create or replace function private.naxa_partner_scope_allows(
 p_profile uuid,p_partner uuid,p_scope text default 'PARTENAIRE'
)
returns boolean language sql stable security definer set search_path=''
as $function$
 select case
  when p_profile is null or p_partner is null or p_scope<>'PARTENAIRE' then false
  when p_profile=(select auth.uid()) and public.is_admin() then true
  else exists(
   select 1 from public.naxa_profile_active_roles ar
   join public.partners pa on pa.id=ar.partner_id and pa.id=p_partner and pa.status='active'
   where ar.profile_id=p_profile and ar.partner_id=p_partner and ar.pharmacie_id is null
    and (
      (pa.partner_type='parapharmacie' and ar.role_code=private.naxa_partner_business_function(p_profile)
       and exists(select 1 from public.naxa_professional_account_domains d
        where d.profile_id=ar.profile_id and d.domain_code='PARAPHARMACIE'))
      or
      (pa.partner_type='professionnel_domicile' and ar.role_code='prestations'
       and exists(select 1 from public.partner_members pm
        where pm.partner_id=pa.id and pm.user_id=p_profile
          and pm.member_role in ('owner','manager','operator')))
    )
  )
 end
$function$;

do $patch$
declare v_definition text; v_old text;
begin
 select pg_get_functiondef('public.admin_create_partner_dossier(uuid,text,text,text,text,text,text,numeric,numeric,text,bigint,text,jsonb)'::regprocedure)
 into v_definition;
 v_old := 'p.role::text=''client'' and p.actif=true';
 if position('p.role::text<>''admin'' and p.actif=true' in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Partner owner identity predicate changed; abort patch'; end if;
   v_definition:=replace(v_definition,v_old,'p.role::text<>''admin'' and p.actif=true');
 end if;
 v_old := '  update public.profiles set actif=false where id=p_owner_user_id;';
 if position(v_old in v_definition)>0 then
   v_definition:=replace(v_definition,v_old,'  -- Partner subscription lock does not disable the NAXA identity or Client space.');
 end if;
 execute v_definition;
end
$patch$;

revoke all on function public.naxa_select_active_role(text,uuid,uuid) from public,anon;
grant execute on function public.naxa_select_active_role(text,uuid,uuid) to authenticated;
commit;
