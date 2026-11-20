-- NAXA §148 — invariants d'accès à l'espace Partenaire et aux tables Examens.
begin;
do $test$
declare
 v_definition text;
 v_policy text;
 v_table text;
 v_capability text;
 v_public text;
 v_required text[] := array['exam_centers','exam_services','exam_packs','exam_center_hours','exam_slots'];
begin
 select lower(pg_get_functiondef(
  'public.admin_create_partner_dossier(uuid,text,text,text,text,text,text,numeric,numeric,text,bigint,text,jsonb)'::regprocedure
 )) into v_definition;
 if position('update public.profiles set actif=false' in v_definition)>0 then
  raise exception 'La création du dossier modifie encore le statut global du profil';
 end if;
 if position('owner_profile.actif is true' in v_definition)=0 then
  raise exception 'La garde d''identité active à la création a disparu';
 end if;

 select lower(pg_get_functiondef('private.naxa_partner_has_confirmed_payment(uuid)'::regprocedure))
 into v_definition;
 if position('owner_profile.actif=true' in v_definition)=0
    or position('partner_subscriptions' in v_definition)=0
    or position('first_confirmed_payment_at' in v_definition)=0
    or position('period_start' in v_definition)=0
    or position('due_date' in v_definition)=0
    or position('naxa_owner_has_active_disciplinary_suspension' in v_definition)=0 then
  raise exception 'Le contrôle partenaire ne vérifie plus identité propriétaire, abonnement indépendant de la structure et suspension';
 end if;

 select lower(coalesce(qual,'') || ' ' || coalesce(with_check,''))
 into v_policy
 from pg_policies
 where schemaname='public' and tablename='partners' and policyname='partners_member_read';
 if v_policy is null or position('naxa_partner_has_confirmed_payment' in v_policy)=0
    or position('profiles' in v_policy)=0 then
  raise exception 'La lecture membre de partners ne reprend pas les gardes d''accès';
 end if;

 select lower(pg_get_functiondef('private.exam_has_capability(uuid,text)'::regprocedure)) into v_capability;
 if position('naxa_partner_has_confirmed_payment' in v_capability)=0 then
  raise exception 'Les droits du personnel ne sont pas subordonnés à l''accès partenaire';
 end if;
 select lower(pg_get_functiondef('private.universe_partner_is_public(uuid,text)'::regprocedure)) into v_public;
 if position('naxa_partner_has_confirmed_payment' in v_public)=0 then
  raise exception 'La publication publique ne respecte pas les verrous du partenaire';
 end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename='exam_center_hours' and policyname='exam_hours_partner_manage') then
  raise exception 'Une ancienne policy permissive des horaires reste active';
 end if;
 foreach v_table in array v_required loop
  select lower(coalesce(qual,'') || ' ' || coalesce(with_check,''))
  into v_policy
  from pg_policies
  where schemaname='public' and tablename=v_table
    and policyname=case v_table
      when 'exam_centers' then 'exam_centers_partner_manage'
      when 'exam_services' then 'exam_services_partner_manage'
      when 'exam_packs' then 'exam_packs_partner_manage'
      when 'exam_center_hours' then 'exam_center_hours_partner_manage'
      else 'exam_slots_partner_manage' end;
  if v_policy is null or position('naxa_partner_has_confirmed_payment' in v_policy)=0
     or position('profiles' in v_policy)=0
     or position('owner' in v_policy)=0 or position('manager' in v_policy)=0 then
   raise exception 'Policy de gestion % incomplète : %',v_table,v_policy;
  end if;
 end loop;
 select lower(coalesce(qual,'') || ' ' || coalesce(with_check,''))
 into v_policy from pg_policies
 where schemaname='public' and tablename='exam_equipment'
  and policyname='exam_equipment_public_verified_read';
 if v_policy is null or position('universe_partner_is_public' in v_policy)=0 then
  raise exception 'La lecture publique du matériel ne respecte pas le statut partenaire';
 end if;
 foreach v_table in array array['exam_appointments','exam_pack_items'] loop
  select lower(coalesce(qual,'') || ' ' || coalesce(with_check,''))
   into v_policy from pg_policies
   where schemaname='public' and tablename=v_table
    and policyname=case v_table when 'exam_appointments' then 'exam_appointments_partner_read' else 'exam_pack_items_partner_manage' end;
  if v_policy is null or position('naxa_partner_has_confirmed_payment' in v_policy)=0 then
   raise exception 'Policy partenaire % non alignée',v_table;
  end if;
 end loop;
end
$test$;
rollback;
select '315_partner_workspace_access_invariants PASS — identité indépendante, accès partenaire et 5 policies Examens alignés' as resultat;
