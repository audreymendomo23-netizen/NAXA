-- NAXA — La politique Storage d'accréditation appelle le wrapper public contrôlé.
-- Ne pas accorder EXECUTE sur le helper privé : le wrapper borne l'appel à auth.uid()
-- (ou à l'Administrateur) et conserve le contrôle de validité du Promoteur.
begin;

drop policy if exists naxa_pharmacien_credential_insert_promoter on storage.objects;
create policy naxa_pharmacien_credential_insert_promoter
  on storage.objects for insert to authenticated
  with check (
    bucket_id='naxa-pharmacien-accreditations'
    and array_length(storage.foldername(name),1)=3
    and (storage.foldername(name))[1]=(select auth.uid())::text
    and exists (
      select 1
      from public.profiles promoter
      join public.promoteur_pharmacies pp on pp.promoteur_id=promoter.id and pp.actif=true
      join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
      join public.profiles target on target.id=(storage.foldername(name))[2]::uuid and target.actif=true
      where promoter.id=(select auth.uid())
        and promoter.role::text='promoteur'
        and (storage.foldername(name))[3]=ph.id::text
        and public.naxa_promoteur_valide(promoter.id)
    )
    and coalesce(metadata->>'mimetype','') in ('application/pdf','image/jpeg','image/png')
  );

commit;
