begin;

-- Retire l'ancienne policy permissive qui resterait en OR avec la policy corrigée.
drop policy if exists exam_hours_partner_manage on public.exam_center_hours;

-- Toutes les capacités du personnel Examens sont subordonnées au statut complet du partenaire.
create or replace function private.exam_has_capability(p_center_id uuid, p_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.exam_staff_assignments a
      join public.profiles p on p.id=a.user_id
      join public.exam_centers c on c.id=a.center_id
      where a.center_id=p_center_id
        and a.user_id=auth.uid()
        and a.is_active is true
        and a.active_role is true
        and a.revoked_at is null
        and p.actif is true
        and private.naxa_partner_has_confirmed_payment(c.partner_id)
        and case a.role_key
          when 'directeur' then p_capability = any(array[
            'center_manage','appointments_read','appointments_manage','staff_manage',
            'security_read','security_manage','incident_report','equipment_read','equipment_manage',
            'finance_read','finance_write','finance_approve','communications_read','communications_write',
            'ai_use','result_metadata_read','quality_manage'
          ])
          when 'accueil' then p_capability = any(array[
            'appointments_read','appointments_manage','incident_report','communications_read',
            'communications_write','ai_use','result_metadata_read'
          ])
          when 'caissier' then p_capability = any(array[
            'appointments_read','incident_report','equipment_read','finance_read','finance_write',
            'communications_read','communications_write','ai_use','result_metadata_read'
          ])
          when 'comptable' then p_capability = any(array[
            'appointments_read','incident_report','finance_read','finance_write','finance_approve',
            'communications_read','ai_use','result_metadata_read'
          ])
          when 'technicien_laboratoire' then p_capability = any(array[
            'appointments_read','incident_report','equipment_read','equipment_manage',
            'results_draft','result_metadata_read','communications_read'
          ])
          when 'biologiste' then p_capability = any(array[
            'appointments_read','incident_report','equipment_read','equipment_manage',
            'results_draft','results_read','results_validate','results_publish',
            'result_files_read','result_metadata_read','communications_read'
          ])
          when 'manipulateur_imagerie' then p_capability = any(array[
            'appointments_read','incident_report','equipment_read','equipment_manage',
            'results_draft','result_metadata_read','communications_read'
          ])
          when 'radiologue' then p_capability = any(array[
            'appointments_read','incident_report','equipment_read','equipment_manage',
            'results_draft','results_read','results_validate','results_publish',
            'result_files_read','result_metadata_read','communications_read'
          ])
          when 'responsable_qualite' then p_capability = any(array[
            'appointments_read','incident_report','security_read','security_manage',
            'equipment_read','equipment_manage','quality_manage','result_metadata_read',
            'communications_read','ai_use'
          ])
          when 'responsable_securite' then p_capability = any(array[
            'incident_report','security_read','security_manage','staff_read','communications_read','ai_use'
          ])
          else false
        end
    );
$function$;

-- La publication publique suit le même verrou : identité titulaire, dossier,
-- partenaire, abonnement, suspension disciplinaire et verrou d'accès.
create or replace function private.universe_partner_is_public(p_partner_id uuid, p_universe_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.partners pa
    join public.partner_universes pu on pu.partner_id=pa.id
    join public.universes u on u.slug=pu.universe_slug
    join public.feature_flags ff on ff.flag_key='universe.'||pu.universe_slug
    join public.admin_partner_dossiers d on d.partner_id=pa.id and d.dossier_status='validated'
    where pa.id=p_partner_id
      and pa.status='active'
      and pu.universe_slug=p_universe_slug
      and pu.enabled=true
      and u.enabled=true
      and ff.enabled=true
      and (
        (p_universe_slug='prestations' and pa.partner_type='professionnel_domicile'
          and private.naxa_partner_has_confirmed_payment(pa.id))
        or
        (p_universe_slug<>'prestations'
          and private.naxa_partner_has_confirmed_payment(pa.id))
      )
  );
$function$;

-- Les lectures/écritures owner-manager directes doivent aussi respecter abonnement et suspensions.
drop policy if exists exam_appointments_partner_read on public.exam_appointments;
create policy exam_appointments_partner_read on public.exam_appointments
for select to authenticated
using (
  exists (
    select 1 from public.exam_centers c
    join public.partner_members pm on pm.partner_id=c.partner_id
    join public.profiles pr on pr.id=pm.user_id and pr.actif is true
    where c.id=exam_appointments.center_id
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager')
      and private.naxa_partner_has_confirmed_payment(c.partner_id)
  )
);

drop policy if exists exam_pack_items_partner_manage on public.exam_pack_items;
create policy exam_pack_items_partner_manage on public.exam_pack_items
for all to authenticated
using (
  exists (
    select 1 from public.exam_packs p
    join public.exam_centers c on c.id=p.center_id
    join public.partner_members pm on pm.partner_id=c.partner_id
    join public.profiles pr on pr.id=pm.user_id and pr.actif is true
    where p.id=exam_pack_items.pack_id
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager')
      and private.naxa_partner_has_confirmed_payment(c.partner_id)
  )
)
with check (
  exists (
    select 1 from public.exam_packs p
    join public.exam_centers c on c.id=p.center_id
    join public.partner_members pm on pm.partner_id=c.partner_id
    join public.profiles pr on pr.id=pm.user_id and pr.actif is true
    where p.id=exam_pack_items.pack_id
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager')
      and private.naxa_partner_has_confirmed_payment(c.partner_id)
  )
);

commit;