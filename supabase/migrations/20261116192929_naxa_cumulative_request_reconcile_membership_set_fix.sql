do $patch$
declare v_definition text; v_old text; v_new text;
begin
 select pg_get_functiondef('public.naxa_request_cumulative_activity(uuid,text,uuid,uuid,text,text)'::regprocedure)
 into v_definition;
 v_old := $old$
 if found then
   if v_existing.status='approved' then return null; end if;
   if v_existing.status='pending' then return v_existing.id; end if;
   raise exception 'Une demande équivalente a déjà été refusée ; une nouvelle décision Admin est nécessaire' using errcode='23514';
 end if;
$old$;
 v_new := $new$
 if found then
   if v_existing.status='rejected' then
     raise exception 'Une demande équivalente a déjà été refusée ; une nouvelle décision Admin est nécessaire' using errcode='23514';
   end if;
   if p_direction='PHARMACIE_VERS_SPD' then
     with expected as (
       select distinct pp.promoteur_id approver_id,pp.pharmacie_id organization_id
       from public.naxa_professional_assignments a
       join public.promoteur_pharmacies pp on pp.pharmacie_id=a.pharmacie_id and pp.actif=true
       join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
       where a.profile_id=p_target_profile_id and a.statut='active'
         and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now())
       union
       select distinct pp.promoteur_id,pp.pharmacie_id
       from public.promoteur_pharmacies pp
       join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
       where pp.promoteur_id=p_target_profile_id and pp.actif=true
       union
       select distinct pp.promoteur_id,pp.pharmacie_id
       from public.profiles p
       join public.promoteur_pharmacies pp on pp.pharmacie_id=p.pharmacie_id and pp.actif=true
       join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
       where p.id=p_target_profile_id and p.role::text in ('pharmacie','caisse')
     )
     select
       not exists(select 1 from expected e where not exists(
         select 1 from public.naxa_cumulative_activity_approvals a
         where a.request_id=v_existing.id and a.organization_type='pharmacie'
           and a.organization_id=e.organization_id and a.approver_id=e.approver_id
           and a.status in ('pending','approved')
       ))
       and not exists(select 1 from public.naxa_cumulative_activity_approvals a
         where a.request_id=v_existing.id and a.organization_type='pharmacie'
           and a.status in ('pending','approved')
           and not exists(select 1 from expected e
             where e.organization_id=a.organization_id and e.approver_id=a.approver_id))
     into v_set_matches;
   else
     with expected as (
       select distinct owner.user_id approver_id,pa.id organization_id
       from public.partner_members member
       join public.partners pa on pa.id=member.partner_id
         and pa.partner_type='professionnel_domicile' and pa.status='active'
       join public.partner_universes pu on pu.partner_id=pa.id
         and pu.universe_slug='prestations' and pu.enabled=true
       join public.partner_members owner on owner.partner_id=pa.id and owner.member_role='owner'
       where member.user_id=p_target_profile_id and member.member_role in ('owner','manager','operator')
     )
     select
       not exists(select 1 from expected e where not exists(
         select 1 from public.naxa_cumulative_activity_approvals a
         where a.request_id=v_existing.id and a.organization_type='spd'
           and a.organization_id=e.organization_id and a.approver_id=e.approver_id
           and a.status in ('pending','approved')
       ))
       and not exists(select 1 from public.naxa_cumulative_activity_approvals a
         where a.request_id=v_existing.id and a.organization_type='spd'
           and a.status in ('pending','approved')
           and not exists(select 1 from expected e
             where e.organization_id=a.organization_id and e.approver_id=a.approver_id))
     into v_set_matches;
   end if;
   if v_set_matches then
     if v_existing.status='approved' then return null; end if;
     if v_existing.status='pending' then return v_existing.id; end if;
   end if;
   update public.naxa_cumulative_activity_approvals
   set status='invalidated',decided_at=coalesce(decided_at,now()),
       decision_reason='Ensemble des organisations ou des autorités modifié'
   where request_id=v_existing.id and status in ('pending','approved');
   update public.naxa_cumulative_activity_requests
   set status='cancelled',updated_at=now()
   where id=v_existing.id;
 end if;
$new$;
 if position('if v_existing.status=''approved'' then return null' in v_definition)=0 then
   raise exception 'Existing request reuse block already reconciled or changed';
 end if;
 v_definition:=replace(v_definition,v_old,v_new);
 execute v_definition;
end
$patch$;
