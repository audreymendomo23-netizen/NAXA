
create or replace function private.naxa_client_identity_is_staff_of_pharmacy(
  p_client_id uuid,
  p_pharmacie_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    p_client_id is not null and p_pharmacie_id is not null
    and (
      exists(
        select 1 from public.naxa_professional_assignments a
        where a.profile_id=p_client_id and a.pharmacie_id=p_pharmacie_id
          and a.statut='active' and a.commence_at<=now()
          and (a.expire_at is null or a.expire_at>now())
      )
      or exists(
        select 1 from public.promoteur_pharmacies pp
        where pp.promoteur_id=p_client_id and pp.pharmacie_id=p_pharmacie_id and pp.actif=true
      )
      or exists(
        select 1 from public.profiles p
        where p.id=p_client_id and p.role::text in ('pharmacie','caisse')
          and p.pharmacie_id=p_pharmacie_id
      )
    ),
    false
  );
$function$;

create or replace function private.naxa_client_identity_is_partner_member(
  p_client_id uuid,
  p_partner_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    p_client_id is not null and p_partner_id is not null
    and exists(
      select 1 from public.partner_members pm
      join public.partners pa on pa.id=pm.partner_id and pa.status='active'
      where pm.user_id=p_client_id and pm.partner_id=p_partner_id
        and pm.member_role in ('owner','manager','operator')
    ),
    false
  );
$function$;

revoke all on function private.naxa_client_identity_is_staff_of_pharmacy(uuid,uuid) from public,anon;
revoke all on function private.naxa_client_identity_is_partner_member(uuid,uuid) from public,anon;
grant execute on function private.naxa_client_identity_is_staff_of_pharmacy(uuid,uuid) to authenticated;
grant execute on function private.naxa_client_identity_is_partner_member(uuid,uuid) to authenticated;

drop policy if exists prescriptions_client_read_own on public.prescriptions;
create policy prescriptions_client_read_own on public.prescriptions
for select to authenticated
using (
  client_id=auth.uid()
  and source='client'
  and public.naxa_business_function()='client'
);

drop policy if exists prescriptions_staff_read on public.prescriptions;
create policy prescriptions_staff_read on public.prescriptions
for select to authenticated
using (
  public.naxa_business_function() in ('pharmacien','promoteur')
  and public.naxa_scope_allows(auth.uid(),pharmacie_id,'PHARMACIE')
  and not private.naxa_client_identity_is_staff_of_pharmacy(client_id,pharmacie_id)
);

drop policy if exists prescription_items_client_read_own on public.prescription_items;
create policy prescription_items_client_read_own on public.prescription_items
for select to authenticated
using (
  exists(
    select 1 from public.prescriptions r
    where r.id=prescription_items.prescription_id
      and r.client_id=auth.uid()
      and r.source='client'
      and public.naxa_business_function()='client'
  )
);

drop policy if exists prescription_items_staff_read on public.prescription_items;
create policy prescription_items_staff_read on public.prescription_items
for select to authenticated
using (
  exists(
    select 1 from public.prescriptions r
    where r.id=prescription_items.prescription_id
      and public.naxa_business_function() in ('pharmacien','promoteur')
      and public.naxa_scope_allows(auth.uid(),r.pharmacie_id,'PHARMACIE')
      and not private.naxa_client_identity_is_staff_of_pharmacy(r.client_id,r.pharmacie_id)
  )
);

drop policy if exists prescription_items_pharmacien_write on public.prescription_items;
create policy prescription_items_pharmacien_write on public.prescription_items
for all to authenticated
using (
  exists(
    select 1 from public.prescriptions r
    where r.id=prescription_items.prescription_id
      and public.naxa_business_function()='pharmacien'
      and public.naxa_scope_allows(auth.uid(),r.pharmacie_id,'PHARMACIE')
      and not private.naxa_client_identity_is_staff_of_pharmacy(r.client_id,r.pharmacie_id)
  )
)
with check (
  exists(
    select 1 from public.prescriptions r
    where r.id=prescription_items.prescription_id
      and public.naxa_business_function()='pharmacien'
      and public.naxa_scope_allows(auth.uid(),r.pharmacie_id,'PHARMACIE')
      and not private.naxa_client_identity_is_staff_of_pharmacy(r.client_id,r.pharmacie_id)
  )
);

drop policy if exists prescription_preparations_staff_read on public.prescription_preparations;
create policy prescription_preparations_staff_read on public.prescription_preparations
for select to authenticated
using (
  public.naxa_business_function()='pharmacien'
  and public.naxa_scope_allows(auth.uid(),pharmacie_id,'PHARMACIE')
  and exists(
    select 1 from public.prescriptions r
    where r.id=prescription_preparations.prescription_id
      and r.pharmacie_id=prescription_preparations.pharmacie_id
      and not private.naxa_client_identity_is_staff_of_pharmacy(r.client_id,r.pharmacie_id)
  )
);

drop policy if exists resa_read on public.reservations;
create policy resa_read on public.reservations
for select to authenticated
using (
  (client_id=auth.uid() and public.naxa_business_function()='client')
  or (
    public.naxa_scope_allows(auth.uid(),pharmacie_id,'PHARMACIE')
    and not private.naxa_client_identity_is_staff_of_pharmacy(client_id,pharmacie_id)
  )
  or public.is_admin()
);

drop policy if exists reservation_events_participant_read on public.reservation_events;
create policy reservation_events_participant_read on public.reservation_events
for select to authenticated
using (
  (client_id=auth.uid() and public.naxa_business_function()='client')
  or public.is_admin()
  or (
    public.naxa_scope_allows(auth.uid(),pharmacie_id,'PHARMACIE')
    and not private.naxa_client_identity_is_staff_of_pharmacy(client_id,pharmacie_id)
  )
);

drop policy if exists reservation_items_client_or_pharmacy_read on public.reservation_items;
drop policy if exists resa_items_read on public.reservation_items;
create policy resa_items_read on public.reservation_items
for select to authenticated
using (
  exists(select 1 from public.reservations r where r.id=reservation_items.reservation_id)
);

drop policy if exists reservation_item_lots_participant_read on public.reservation_item_lots;
create policy reservation_item_lots_participant_read on public.reservation_item_lots
for select to authenticated
using (
  exists(select 1 from public.reservations r where r.id=reservation_item_lots.reservation_id)
);

drop policy if exists assurance_snapshots_scope_read on public.assurance_reservation_snapshots;
create policy assurance_snapshots_scope_read on public.assurance_reservation_snapshots
for select to authenticated
using (
  (client_id=auth.uid() and public.naxa_business_function()='client')
  or (
    public.can_access_pharmacy(pharmacie_id)
    and not private.naxa_client_identity_is_staff_of_pharmacy(client_id,pharmacie_id)
  )
);

drop policy if exists universe_reservations_admin_read on public.universe_reservations;
create policy universe_reservations_admin_read on public.universe_reservations
for select to authenticated
using (public.is_admin());

drop policy if exists universe_reservations_client_read on public.universe_reservations;
create policy universe_reservations_client_read on public.universe_reservations
for select to authenticated
using (client_id=auth.uid() and public.naxa_business_function()='client');

drop policy if exists universe_reservations_partner_read on public.universe_reservations;
create policy universe_reservations_partner_read on public.universe_reservations
for select to authenticated
using (
  partner_id=public.naxa_active_role_partner()
  and exists(
    select 1 from public.partners pa
    where pa.id=universe_reservations.partner_id and pa.status='active'
      and (
        (pa.partner_type='parapharmacie' and private.naxa_partner_actor_can(pa.id,'VIEW_RESERVATIONS'))
        or (
          pa.partner_type='professionnel_domicile'
          and exists(select 1 from public.partner_members pm
            where pm.partner_id=pa.id and pm.user_id=auth.uid()
              and pm.member_role in ('owner','manager','operator'))
        )
      )
  )
  and not private.naxa_client_identity_is_partner_member(client_id,partner_id)
);

drop policy if exists universe_reservation_items_client_read on public.universe_reservation_items;
create policy universe_reservation_items_client_read on public.universe_reservation_items
for select to authenticated
using (
  exists(select 1 from public.universe_reservations r where r.id=universe_reservation_items.reservation_id)
);

drop policy if exists naxa_client_prescription_read_linked on storage.objects;
create policy naxa_client_prescription_read_linked on storage.objects
for select to authenticated
using (
  bucket_id='naxa-client-prescriptions'
  and (
    (
      split_part(name,'/',1)=auth.uid()::text
      and public.naxa_business_function()='client'
    )
    or exists(
      select 1 from public.prescriptions r
      where r.document_ref=storage.objects.name
        and (
          (r.client_id=auth.uid() and public.naxa_business_function()='client')
          or (
            public.naxa_business_function()='pharmacien'
            and public.naxa_scope_allows(auth.uid(),r.pharmacie_id,'PHARMACIE')
            and not private.naxa_client_identity_is_staff_of_pharmacy(r.client_id,r.pharmacie_id)
          )
          or public.is_admin()
        )
    )
  )
);

drop policy if exists audit_log_admin_insert on public.audit_log;
create policy audit_log_admin_insert on public.audit_log
for insert to authenticated
with check (public.is_admin() and (actor_id is null or actor_id=auth.uid()));

drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read on public.audit_log
for select to authenticated
using (public.is_admin());

drop policy if exists naxa_session_audit_read_scope on public.naxa_session_audit;
create policy naxa_session_audit_read_scope on public.naxa_session_audit
for select to authenticated
using (
  user_id=auth.uid()
  or public.is_admin()
  or (
    public.naxa_business_function()='promoteur'
    and private.naxa_promoteur_valide(auth.uid())
    and exists(select 1 from public.promoteur_pharmacies pp
      where pp.promoteur_id=auth.uid()
        and pp.pharmacie_id=naxa_session_audit.pharmacie_id
        and pp.actif=true)
  )
);

drop policy if exists partner_products_admin_all on public.partner_products;
create policy partner_products_admin_all on public.partner_products
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists partner_products_legacy_delete on public.partner_products;
create policy partner_products_legacy_delete on public.partner_products
for delete to authenticated
using (
  exists(
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id and pa.status='active'
    where pm.partner_id=partner_products.partner_id
      and pm.user_id=auth.uid()
      and pm.member_role in ('owner','manager','operator')
      and pa.partner_type<>'parapharmacie'
      and public.naxa_active_role_partner()=pa.id
  )
);

drop policy if exists partner_independent_templates_read on public.partner_independent_agreement_templates;
create policy partner_independent_templates_read on public.partner_independent_agreement_templates
for select to authenticated
using (
  status='published'
  or (status in ('draft','archived') and public.is_admin())
);

drop policy if exists partner_independent_agreements_owner_or_admin_read on public.partner_independent_agreements;
create policy partner_independent_agreements_owner_or_admin_read on public.partner_independent_agreements
for select to authenticated
using (professional_user_id=auth.uid() or public.is_admin());

drop policy if exists partner_weekly_availability_owner_read on public.partner_weekly_availability;
create policy partner_weekly_availability_owner_read on public.partner_weekly_availability
for select to authenticated
using (
  (partner_has_active_independent_agreement(partner_id)
    and public.naxa_active_role_partner()=partner_id)
  or public.is_admin()
);

drop policy if exists fournisseurs_insert_staff on public.fournisseurs;
create policy fournisseurs_insert_staff on public.fournisseurs
for insert to authenticated
with check (
  created_by=auth.uid()
  and (
    public.is_admin()
    or public.naxa_business_function() in (
      'promoteur','pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier'
    )
  )
);

drop policy if exists fournisseurs_read_staff on public.fournisseurs;
create policy fournisseurs_read_staff on public.fournisseurs
for select to authenticated
using (
  public.is_admin()
  or public.naxa_business_function() in (
    'promoteur','pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier'
  )
  or exists(
    select 1 from public.commandes_fournisseurs c
    where c.fournisseur_id=fournisseurs.id
      and public.naxa_scope_allows(auth.uid(),c.pharmacie_id,'PHARMACIE')
  )
);

drop policy if exists fournisseurs_update_staff on public.fournisseurs;
create policy fournisseurs_update_staff on public.fournisseurs
for update to authenticated
using (
  public.is_admin()
  or (
    created_by=auth.uid()
    and public.naxa_business_function() in (
      'promoteur','pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier'
    )
  )
)
with check (
  public.is_admin()
  or (
    created_by=auth.uid()
    and public.naxa_business_function() in (
      'promoteur','pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier'
    )
  )
);

drop policy if exists fournisseurs_delete_staff on public.fournisseurs;
create policy fournisseurs_delete_staff on public.fournisseurs
for delete to authenticated
using (
  public.is_admin()
  or (
    created_by=auth.uid()
    and public.naxa_business_function() in (
      'promoteur','pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier'
    )
  )
);
