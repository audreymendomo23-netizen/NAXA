-- NAXA — dépôt sécurisé des justificatifs et procédure Admin d'agrément.
begin;

alter table public.suivi_professionals
  drop constraint if exists suivi_professionals_professional_role_check;
alter table public.suivi_professionals
  add constraint suivi_professionals_professional_role_check
  check(professional_role in ('medecin','pharmacien','infirmier','sage_femme','chirurgien_dentiste','kinesitherapeute','technicien_laboratoire','autre_sante'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('suivi-accreditations','suivi-accreditations',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf','image/jpeg','image/png'];

drop policy if exists suivi_professionals_self_insert_pending on public.suivi_professionals;
create policy suivi_professionals_self_insert_pending on public.suivi_professionals
for insert to authenticated with check(
  user_id=(select auth.uid())
  and verified=false
  and verification_status='pending'
  and verified_by is null
  and verified_at is null
);
drop policy if exists suivi_professionals_self_update_pending on public.suivi_professionals;
create policy suivi_professionals_self_update_pending on public.suivi_professionals
for update to authenticated
using(user_id=(select auth.uid()) and verification_status in ('pending','rejected','expired'))
with check(
  user_id=(select auth.uid())
  and verified=false
  and verification_status='pending'
  and verified_by is null
  and verified_at is null
);
grant select,insert,update on public.suivi_professionals to authenticated;

drop policy if exists suivi_accreditations_owner_insert on storage.objects;
create policy suivi_accreditations_owner_insert on storage.objects
for insert to authenticated with check(
  bucket_id='suivi-accreditations'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);
drop policy if exists suivi_accreditations_owner_or_admin_select on storage.objects;
create policy suivi_accreditations_owner_or_admin_select on storage.objects
for select to authenticated using(
  bucket_id='suivi-accreditations'
  and (
    (storage.foldername(name))[1]=(select auth.uid())::text
    or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
  )
);
drop policy if exists suivi_accreditations_owner_delete on storage.objects;
create policy suivi_accreditations_owner_delete on storage.objects
for delete to authenticated using(
  bucket_id='suivi-accreditations'
  and (
    (storage.foldername(name))[1]=(select auth.uid())::text
    or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
  )
);

commit;
