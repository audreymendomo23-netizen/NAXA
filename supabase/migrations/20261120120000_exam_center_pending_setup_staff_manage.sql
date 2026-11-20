-- NAXA — préparation du personnel d'un Centre d'examens avant ouverture.
-- Seul le Directeur propriétaire/gestionnaire peut configurer l'équipe
-- lorsque le Partenaire et son dossier sont pending et que le Centre reste draft.
-- Aucune permission opérationnelle n'est accordée avant paiement confirmé.

begin;

create or replace function private.exam_has_capability(p_center_id uuid,p_capability text)
returns boolean
language sql
stable
security definer
set search_path=''
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
        and (
          private.naxa_partner_has_confirmed_payment(c.partner_id)
          or (
            p_capability='staff_manage'
            and a.role_key='directeur'
            and c.status='draft'
            and exists (
              select 1
              from public.partners pa
              join public.partner_members pm
                on pm.partner_id=pa.id
               and pm.user_id=auth.uid()
               and pm.member_role in ('owner','manager')
              join public.profiles owner_profile
                on owner_profile.id=pm.user_id
               and owner_profile.actif is true
              join public.admin_partner_dossiers d
                on d.partner_id=pa.id
               and d.promoteur_id=auth.uid()
               and d.universe_slug='examens'
               and d.dossier_status='pending'
              join public.partner_universes pu
                on pu.partner_id=pa.id
               and pu.universe_slug='examens'
               and pu.enabled is false
              where pa.id=c.partner_id
                and pa.partner_type='centre_examen'
                and pa.status='pending'
            )
          )
        )
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

revoke all on function private.exam_has_capability(uuid,text) from public,anon;
grant execute on function private.exam_has_capability(uuid,text) to authenticated;

drop policy if exists exam_centers_staff_read on public.exam_centers;
create policy exam_centers_staff_read on public.exam_centers
for select to authenticated
using (
  private.exam_has_capability(id,'appointments_read')
  or private.exam_has_capability(id,'staff_read')
  or private.exam_has_capability(id,'staff_manage')
);

commit;
