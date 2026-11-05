-- NAXA Storage — bucket configuration and authorization-policy contract.
-- Structural assertions only; binary upload/download requires the Storage HTTP API.
begin;

do $test$
declare
  v_public boolean;
  v_limit bigint;
  v_mimes text[];
  v_check text;
  v_using text;
begin
  select public, file_size_limit, allowed_mime_types
    into v_public, v_limit, v_mimes
  from storage.buckets where id = 'pharmacies-photos';
  if not found or v_public is distinct from true or v_limit <> 524288
     or not (v_mimes @> array['image/jpeg','image/png','image/webp']) then
    raise exception 'pharmacies-photos bucket configuration invalid';
  end if;

  select public, file_size_limit, allowed_mime_types
    into v_public, v_limit, v_mimes
  from storage.buckets where id = 'medicaments';
  if not found or v_public is distinct from true or v_limit <> 5242880
     or not (v_mimes @> array['image/jpeg','image/png','image/webp']) then
    raise exception 'medicaments bucket configuration invalid';
  end if;

  select with_check into v_check from pg_policies
  where schemaname='storage' and tablename='objects'
    and policyname='promoteur_pharmacy_logo_insert' and cmd='INSERT';
  if v_check is null or position('auth.uid()' in v_check)=0
     or position('promoteur_pharmacies' in v_check)=0
     or position('pharmacies-photos' in v_check)=0 then
    raise exception 'Promoteur logo upload must be restricted to active linked pharmacies';
  end if;

  select qual, with_check into v_using, v_check from pg_policies
  where schemaname='storage' and tablename='objects'
    and policyname='promoteur_pharmacy_logo_update' and cmd='UPDATE';
  if v_using is null or v_check is null
     or position('auth.uid()' in v_using)=0
     or position('auth.uid()' in v_check)=0 then
    raise exception 'Promoteur logo replacement must check both old and new object scope';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='promoteur_pharmacy_logo_delete' and cmd='DELETE'
  ) then raise exception 'Promoteur logo delete policy missing'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='medicaments_admin_insert' and cmd='INSERT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='medicaments_admin_update' and cmd='UPDATE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='medicaments_admin_delete' and cmd='DELETE'
  ) then raise exception 'Admin active-role write policies for medicaments missing'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='medicaments_public_read' and cmd='SELECT'
  ) then raise exception 'Public medicament image read policy missing'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='pharmacie_documents_storage_admin_insert'
      and cmd='INSERT' and position('is_admin' in with_check)>0
  ) or not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='pharmacie_documents_storage_admin_select'
      and cmd='SELECT' and position('is_admin' in qual)>0
  ) or not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='pharmacie_documents_storage_admin_update'
      and cmd='UPDATE' and position('is_admin' in qual)>0
      and position('is_admin' in with_check)>0
  ) or not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='pharmacie_documents_storage_admin_delete'
      and cmd='DELETE' and position('is_admin' in qual)>0
  ) then raise exception 'Pharmacy documents must remain Admin-only for all object operations'; end if;

  if not exists (
    select 1 from storage.buckets where id='credit-marketplace-justificatifs' and public=false
  ) or not exists (
    select 1 from storage.buckets where id='pharmacie-documents' and public=false
  ) or not exists (
    select 1 from storage.buckets where id='preuves-reglements-promoteurs' and public=false
  ) then raise exception 'A private document bucket is missing or incorrectly public'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='credit_marketplace_proof_insert_own'
      and cmd='INSERT' and position('auth.uid()' in with_check)>0
  ) or not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='credit_marketplace_proof_read_own'
      and cmd='SELECT' and position('auth.uid()' in qual)>0
  ) then raise exception 'Marketplace credit proof must remain owner-scoped'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='credit_marketplace_proof_delete_own'
      and cmd='DELETE' and position('auth.uid()' in qual)>0
  ) then raise exception 'Marketplace credit proof deletion must remain owner-scoped'; end if;

  if exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and (
        coalesce(qual,'') ilike '%preuves-reglements-promoteurs%'
        or coalesce(with_check,'') ilike '%preuves-reglements-promoteurs%'
      )
  ) then raise exception 'Promoter payment proofs must remain server-mediated, not directly writable by client roles'; end if;

end
$test$;

rollback;
select 'naxa_storage_bucket_and_policy_contract PASS' as resultat;
