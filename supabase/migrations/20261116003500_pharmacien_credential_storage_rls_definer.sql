-- NAXA — Corrige le dépôt du justificatif Pharmacien par le Promoteur.
-- La policy Storage ne doit pas lire directement profiles.target sous RLS :
-- le Promoteur ne possède pas de droit de lecture global sur les profils.
-- Le helper SECURITY DEFINER vérifie le compte cible sans exposer ses données.

begin;

create or replace function private.naxa_pharmacien_credential_upload_allowed(
  p_target_profile_id text,
  p_pharmacie_id text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select auth.uid() is not null
    and p_target_profile_id is not null
    and p_pharmacie_id is not null
    and exists (
      select 1
      from public.profiles promoter
      join public.promoteur_pharmacies pp
        on pp.promoteur_id=promoter.id and pp.actif is true
      join public.pharmacies ph
        on ph.id=pp.pharmacie_id and ph.actif is true and ph.archivee_le is null
      join public.profiles target
        on target.id::text=p_target_profile_id and target.actif is true
      where promoter.id=auth.uid()
        and promoter.role::text='promoteur'
        and promoter.actif is true
        and ph.id::text=p_pharmacie_id
        and private.naxa_promoteur_valide(promoter.id)
    );
$function$;

revoke all on function private.naxa_pharmacien_credential_upload_allowed(text,text)
  from public,anon;
grant execute on function private.naxa_pharmacien_credential_upload_allowed(text,text)
  to authenticated;

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
  and coalesce(metadata->>'mimetype','') in ('application/pdf','image/jpeg','image/png')
);

comment on function private.naxa_pharmacien_credential_upload_allowed(text,text)
  is 'Contrôle serveur privé du dépôt de justificatif Pharmacien par le Promoteur du réseau courant, sans exposer profiles sous RLS.';

commit;
