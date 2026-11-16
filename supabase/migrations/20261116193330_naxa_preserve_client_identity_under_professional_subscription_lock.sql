begin;

create or replace function private.naxa_partner_has_confirmed_payment(p_partner_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
 select exists(
   select 1
   from public.admin_partner_dossiers d
   join public.partners pa on pa.id=d.partner_id and pa.status='active'
   join public.partner_universes pu on pu.partner_id=pa.id
     and pu.universe_slug=d.universe_slug and pu.enabled=true
   join public.profiles owner_profile on owner_profile.id=d.promoteur_id and owner_profile.actif=true
   where d.partner_id=p_partner_id and d.dossier_status='validated'
     and private.naxa_owner_subscription_is_current(d.promoteur_id)
     and not exists(select 1 from public.naxa_subscription_access_locks l
       where l.promoteur_id=d.promoteur_id and l.is_active=true)
     and not private.naxa_owner_has_active_disciplinary_suspension(d.promoteur_id)
 )
$function$;

create or replace function private.naxa_partner_business_function(p_profile uuid)
returns text language sql stable security definer set search_path=''
as $function$
 select case when pa.partner_type='professionnel_domicile' then 'prestations' else ar.role_code end
 from public.naxa_profile_active_roles ar
 join public.profiles p on p.id=ar.profile_id and p.actif=true
 join public.partners pa on pa.id=ar.partner_id and pa.status='active'
 where ar.profile_id=p_profile and ar.partner_id is not null and ar.pharmacie_id is null
   and private.naxa_partner_has_confirmed_payment(pa.id)
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
    and private.naxa_partner_has_confirmed_payment(pa.id)
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
declare v_definition text; v_old text; v_new text;
begin
 select pg_get_functiondef('public.naxa_select_active_role(text,uuid,uuid)'::regprocedure)
 into v_definition;
 v_old := 'where pa.id=p_partner_id and pa.partner_type=''professionnel_domicile''
          and pa.status=''active''';
 v_new := 'where pa.id=p_partner_id and pa.partner_type=''professionnel_domicile''
          and pa.status=''active'' and private.naxa_partner_has_confirmed_payment(pa.id)';
 if position(v_new in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'SPD active-role payment guard anchor changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;
 v_old := 'where pa.id=p_partner_id and pa.partner_type=''parapharmacie'' and pa.status=''active''';
 v_new := 'where pa.id=p_partner_id and pa.partner_type=''parapharmacie'' and pa.status=''active''
          and private.naxa_partner_has_confirmed_payment(pa.id)';
 if position(v_new in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Parapharmacy active-role payment guard anchor changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;
 execute v_definition;
end
$patch$;

do $patch$
declare v_definition text; v_old text; v_new text;
begin
 select pg_get_functiondef('private.naxa_partner_actor_can(uuid,text)'::regprocedure)
 into v_definition;
 v_old := 'where pm.partner_id=p_partner and pm.user_id=auth.uid()
        and pm.member_role in (''owner'',''manager'',''operator'')';
 v_new := 'where pm.partner_id=p_partner and pm.user_id=auth.uid()
        and pm.member_role in (''owner'',''manager'',''operator'')
        and private.naxa_partner_has_confirmed_payment(pa.id)';
 if position(v_new in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'SPD actor guard anchor changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;
 execute v_definition;
end
$patch$;

do $patch$
declare v_definition text; v_old text; v_new text;
begin
 select pg_get_functiondef('private.naxa_partner_has_active_independent_agreement(uuid,uuid)'::regprocedure)
 into v_definition;
 v_old := 'and pa.status=''active''
        and pa.partner_type=''professionnel_domicile''';
 v_new := 'and pa.status=''active''
        and pa.partner_type=''professionnel_domicile''
        and private.naxa_partner_has_confirmed_payment(pa.id)';
 if position(v_new in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'SPD independent agreement guard anchor changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;
 execute v_definition;
end
$patch$;

drop policy if exists partner_universes_member_read on public.partner_universes;
create policy partner_universes_member_read on public.partner_universes
for select to authenticated using (
 public.is_admin() or exists(
  select 1 from public.partner_members pm join public.partners pa on pa.id=pm.partner_id
  where pm.partner_id=partner_universes.partner_id and pm.user_id=auth.uid()
    and pa.status='active' and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);
drop policy if exists partners_member_read on public.partners;
create policy partners_member_read on public.partners
for select to authenticated using (
 public.is_admin() or (
  exists(select 1 from public.partner_members pm where pm.partner_id=partners.id and pm.user_id=auth.uid())
  and status='active' and private.naxa_partner_has_confirmed_payment(partners.id)
 )
);

drop policy if exists home_service_offers_partner_insert_draft on public.home_service_offers;
create policy home_service_offers_partner_insert_draft on public.home_service_offers
for insert to authenticated with check (
 status='draft' and exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_offers.partner_id and pm.user_id=auth.uid()
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);
drop policy if exists home_service_offers_partner_read on public.home_service_offers;
create policy home_service_offers_partner_read on public.home_service_offers
for select to authenticated using (
 exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_offers.partner_id and pm.user_id=auth.uid()
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);
drop policy if exists home_service_offers_partner_update_unpublished on public.home_service_offers;
create policy home_service_offers_partner_update_unpublished on public.home_service_offers
for update to authenticated using (
 exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_offers.partner_id and pm.user_id=auth.uid()
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
) with check (
 status in ('draft','archived') and exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_offers.partner_id and pm.user_id=auth.uid()
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);

drop policy if exists home_service_requests_partner_read on public.home_service_requests;
create policy home_service_requests_partner_read on public.home_service_requests
for select to authenticated using (
 exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_requests.partner_id and pm.user_id=auth.uid()
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);
drop policy if exists home_service_request_addresses_confirmed_partner_read on public.home_service_request_addresses;
create policy home_service_request_addresses_confirmed_partner_read on public.home_service_request_addresses
for select to authenticated using (
 exists(
  select 1 from public.home_service_requests r
  join public.partner_members pm on pm.partner_id=r.partner_id
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where r.id=home_service_request_addresses.request_id
    and r.status in ('confirmed','completed')
    and pm.user_id=auth.uid() and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);

drop policy if exists home_service_reminder_preferences_read on public.home_service_reminder_preferences;
create policy home_service_reminder_preferences_read on public.home_service_reminder_preferences
for select to authenticated using (
 user_id=auth.uid() and exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_reminder_preferences.partner_id and pm.user_id=auth.uid()
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);
drop policy if exists home_service_reminder_preferences_insert on public.home_service_reminder_preferences;
create policy home_service_reminder_preferences_insert on public.home_service_reminder_preferences
for insert to authenticated with check (
 user_id=auth.uid() and exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_reminder_preferences.partner_id and pm.user_id=auth.uid()
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);
drop policy if exists home_service_reminder_preferences_update on public.home_service_reminder_preferences;
create policy home_service_reminder_preferences_update on public.home_service_reminder_preferences
for update to authenticated using (
 user_id=auth.uid() and exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_reminder_preferences.partner_id and pm.user_id=auth.uid()
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
) with check (
 user_id=auth.uid() and exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_reminder_preferences.partner_id and pm.user_id=auth.uid()
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);
drop policy if exists home_service_reminder_preferences_delete on public.home_service_reminder_preferences;
create policy home_service_reminder_preferences_delete on public.home_service_reminder_preferences
for delete to authenticated using (
 user_id=auth.uid() and exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_reminder_preferences.partner_id and pm.user_id=auth.uid()
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);

create or replace function public.admin_valider_dossier_partenaire(p_partner_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare
 v_actor uuid:=auth.uid();
 v_universe text;
 v_owner uuid;
 v_type text;
 v_expected text;
 v_role text;
 v_enabled boolean;
 v_rows integer;
 v_lock boolean;
 v_current boolean;
 v_disciplined boolean;
 v_partner_status text;
begin
 if not public.is_admin() then raise exception 'Accès administrateur requis' using errcode='42501'; end if;
 select d.universe_slug,d.promoteur_id,p.partner_type
 into v_universe,v_owner,v_type
 from public.admin_partner_dossiers d
 join public.partners p on p.id=d.partner_id
 where d.partner_id=p_partner_id and d.dossier_status='pending' and p.status='pending'
 for update of d,p;
 if not found then raise exception 'Dossier partenaire introuvable ou déjà traité' using errcode='P0002'; end if;

 v_expected:=case v_universe when 'parapharmacie' then 'parapharmacie'
  when 'examens' then 'centre_examen' when 'prestations' then 'professionnel_domicile'
  when 'aide' then 'autre' else null end;
 if v_expected is null or v_type is distinct from v_expected then
  raise exception 'Type de partenaire incohérent' using errcode='23514';
 end if;
 if v_universe<>'aide' and not exists(
  select 1 from public.universes u join public.feature_flags f on f.flag_key='universe.'||u.slug
  where u.slug=v_universe and u.enabled and f.enabled
 ) then raise exception 'Univers inactif' using errcode='23514'; end if;

 select pm.member_role into v_role from public.partner_members pm
 where pm.partner_id=p_partner_id and pm.user_id=v_owner for update;
 if not found or v_role<>'owner' then raise exception 'Titulaire non rattaché' using errcode='23514'; end if;

 select pu.enabled into v_enabled from public.partner_universes pu
 where pu.partner_id=p_partner_id and pu.universe_slug=v_universe for update;
 if not found or v_enabled then raise exception 'Association absente ou déjà active' using errcode='23514'; end if;

 update public.admin_partner_dossiers set dossier_status='validated',updated_at=now()
 where partner_id=p_partner_id and dossier_status='pending';
 if not found then raise exception 'Dossier déjà traité' using errcode='P0001'; end if;

 v_current:=private.naxa_owner_subscription_is_current(v_owner);
 select exists(select 1 from public.naxa_subscription_access_locks l
  where l.promoteur_id=v_owner and l.is_active) into v_lock;
 v_disciplined:=private.naxa_owner_has_active_disciplinary_suspension(v_owner);

 v_partner_status:=case when v_disciplined then 'suspended'
   when v_current then 'active' else 'pending' end;
 update public.partners set status=v_partner_status,verified_at=now(),verified_by=v_actor,updated_at=now()
 where id=p_partner_id;
 update public.partner_universes set enabled=(v_partner_status='active')
 where partner_id=p_partner_id and universe_slug=v_universe;
 get diagnostics v_rows=row_count;
 if v_rows<>1 then raise exception 'Association non mise à jour' using errcode='23514'; end if;

 if not v_disciplined and v_current then
  update public.naxa_subscription_access_locks
  set is_active=false,released_at=now(),updated_at=now()
  where promoteur_id=v_owner and is_active=true;
 elsif not v_current and not v_disciplined then
  insert into public.naxa_subscription_access_locks(promoteur_id,is_active,lock_reason,locked_at,released_at)
  values(v_owner,true,'initial_payment_required',now(),null)
  on conflict(promoteur_id) do update set is_active=true,
    lock_reason=case when public.naxa_subscription_access_locks.lock_reason='expired_unpaid'
      then 'expired_unpaid' else 'initial_payment_required' end,
    locked_at=coalesce(public.naxa_subscription_access_locks.locked_at,now()),
    released_at=null,updated_at=now();
 end if;

 insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
 values(v_actor,'partner.dossier_validated','admin_partner_dossier',p_partner_id::text,
  jsonb_build_object('universe_slug',v_universe,'status',v_partner_status,
   'subscription_current',v_current,'identity_actif_mutated',false));
end;
$function$;

do $patch$
declare v_definition text; v_old text; v_new text;
begin
 select pg_get_functiondef('public.admin_confirmer_reglement_promoteur(uuid,uuid)'::regprocedure)
 into v_definition;
 v_old := $old$
  if exists(select 1 from public.naxa_subscription_access_locks l where l.promoteur_id=r.promoteur_id and l.is_active=true)
    and exists(select 1 from public.admin_partner_dossiers d where d.promoteur_id=r.promoteur_id and d.dossier_status='validated')
    and not private.naxa_owner_has_active_disciplinary_suspension(r.promoteur_id) then
    update public.profiles set actif=true where id=r.promoteur_id;
    update public.naxa_subscription_access_locks set is_active=false,released_at=now(),updated_at=now()
     where promoteur_id=r.promoteur_id and is_active=true;
  end if;
$old$;
 v_new := $new$
  if exists(select 1 from public.naxa_subscription_access_locks l where l.promoteur_id=r.promoteur_id and l.is_active=true)
    and exists(select 1 from public.admin_partner_dossiers d where d.promoteur_id=r.promoteur_id and d.dossier_status='validated')
    and not private.naxa_owner_has_active_disciplinary_suspension(r.promoteur_id) then
    update public.naxa_subscription_access_locks set is_active=false,released_at=now(),updated_at=now()
     where promoteur_id=r.promoteur_id and is_active=true;
    update public.partners pa set status='active',verified_at=coalesce(pa.verified_at,now()),
      verified_by=p_admin,updated_at=now()
    from public.admin_partner_dossiers d
    where d.partner_id=pa.id and d.promoteur_id=r.promoteur_id
      and d.dossier_status='validated' and pa.status='pending';
    update public.partner_universes pu set enabled=true
    from public.admin_partner_dossiers d join public.partners pa on pa.id=d.partner_id and pa.status='active'
    where d.promoteur_id=r.promoteur_id and d.dossier_status='validated'
      and pu.partner_id=d.partner_id and pu.enabled=false;
  end if;
$new$;
 if position('update public.partners pa set status=''active''' in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Promoter payment activation block changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
   execute v_definition;
 end if;
end
$patch$;

create or replace function public.synchroniser_validite_pharmacies()
returns integer language plpgsql security definer set search_path=''
as $function$
declare n integer:=0;
begin
 update public.abonnements_promoteurs ap
 set statut='impaye',bloque_le=coalesce(ap.bloque_le,now())
 where ap.echeance<current_date and ap.statut='actif'
   and not exists(select 1 from public.abonnement_promoteur_reglements r
    where r.abonnement_id=ap.id and r.promoteur_id=ap.promoteur_id
      and r.statut='en_attente' and r.montant=ap.montant_mensuel
      and r.canal in ('orange_money','mtn_momo') and r.reference_normalisee is not null
      and r.verification_deadline_at>now());

 update public.conventions_promoteurs c
 set statut='expiree',updated_at=now()
 where c.date_expiration<current_date and c.statut='active'
   and not exists(select 1 from public.abonnements_promoteurs ap
    join public.abonnement_promoteur_reglements r on r.abonnement_id=ap.id and r.promoteur_id=ap.promoteur_id
    where ap.convention_id=c.id and ap.promoteur_id=c.promoteur_id
      and r.statut='en_attente' and r.montant=ap.montant_mensuel
      and r.canal in ('orange_money','mtn_momo') and r.reference_normalisee is not null
      and r.verification_deadline_at>now());

 update public.pharmacies ph set actif=false
 where ph.actif=true and exists(
  select 1 from public.abonnements_promoteurs ap
  join public.promoteur_pharmacies pp on pp.promoteur_id=ap.promoteur_id
  where pp.pharmacie_id=ph.id and ap.statut='impaye'
 );
 get diagnostics n=row_count;

 insert into public.naxa_subscription_access_locks(promoteur_id,is_active,lock_reason,locked_at,released_at)
 select distinct d.promoteur_id,true,'expired_unpaid',now(),null::timestamptz
 from public.admin_partner_dossiers d
 join public.profiles pr on pr.id=d.promoteur_id and pr.actif=true
 join public.abonnements_promoteurs a on a.promoteur_id=d.promoteur_id and a.statut='impaye'
 where d.dossier_status='validated'
 on conflict(promoteur_id) do update set is_active=true,lock_reason='expired_unpaid',
   locked_at=now(),released_at=null,updated_at=now();

 -- Do not change profiles.actif: pharmacy status and subscription locks scope the professional access.
 return n;
end;
$function$;

commit;
