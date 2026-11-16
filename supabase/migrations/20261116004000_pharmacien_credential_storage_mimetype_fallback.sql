-- NAXA — Les uploads Storage peuvent exposer le MIME du fichier dans le header,
-- sans le recopier uniformément dans metadata.mimetype selon le client HTTP.
-- Le bucket conserve sa liste MIME autorisée ; la policy accepte le suffixe sûr
-- uniquement lorsque la metadata MIME est absente ou générique.

begin;

drop policy if exists naxa_pharmacien_credential_insert_promoter on storage.objects;
create policy naxa_pharmacien_credential_insert_promoter
on storage.objects
for insert
to authenticated
with check (
  bucket_id='naxa-pharmacien-accreditations'
  and array_length(storage.foldername(name),1)=3
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and private.naxa_pharmacien_credential_upload_allowed(
    (storage.foldername(name))[2],
    (storage.foldername(name))[3]
  )
  and (
    coalesce(metadata->>'mimetype','') in ('application/pdf','image/jpeg','image/png')
    or (
      coalesce(metadata->>'mimetype','') in ('','application/octet-stream')
      and name ~* '\.(pdf|jpe?g|png)$'
    )
  )
);

commit;
