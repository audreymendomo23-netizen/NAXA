begin;
drop policy if exists exam_equipment_public_verified_read on public.exam_equipment;
create policy exam_equipment_public_verified_read on public.exam_equipment
for select to anon, authenticated
using (
  is_public is true
  and image_url like 'https://%'
  and image_source_url like 'https://%'
  and image_license is not null
  and image_verified_at is not null
  and exists (
    select 1 from public.exam_centers c
    where c.id=exam_equipment.center_id
      and c.status='active'
      and public.universe_partner_is_public(c.partner_id,'examens')
  )
);
commit;