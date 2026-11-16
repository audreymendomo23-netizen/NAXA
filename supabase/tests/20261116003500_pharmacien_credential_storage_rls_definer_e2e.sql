-- Recette RLS réelle du dépôt de justificatif Pharmacien par le Promoteur.
-- L'INSERT Storage est exécuté sous authenticated avec auth.uid() Promoteur,
-- puis annulé pour ne conserver aucun faux justificatif.
begin;

create temporary table naxa_pharmacien_storage_results(
  test text primary key,
  ok boolean not null,
  detail text not null
) on commit drop;

do $test$
declare
  v_promoter uuid:='b5b79627-46ac-4dea-8ea9-6f0464cb3404';
  v_target uuid:='1441cd43-b643-41ed-85eb-6e519adb8f44';
  v_pharmacy uuid:='76dd4983-273a-4a83-ae3d-9a7838d3aa35';
  v_path text;
begin
  if not exists(select 1 from public.profiles where id=v_target and actif=true) then
    raise exception 'Le compte Pharmacien E2E doit exister et être actif';
  end if;
  if not private.naxa_pharmacien_credential_upload_allowed(v_target::text,v_pharmacy::text) then
    raise exception 'Le Promoteur ne passe pas le contrôle privé du justificatif';
  end if;
  if private.naxa_pharmacien_credential_upload_allowed(v_target::text,'00000000-0000-0000-0000-000000000000') then
    raise exception 'Le helper accepte une pharmacie hors réseau';
  end if;

  perform set_config('request.jwt.claim.sub',v_promoter::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_promoter::text,'role','authenticated')::text,true);
  v_path:=v_promoter::text||'/'||v_target::text||'/'||v_pharmacy::text||'/credential-rls-e2e.pdf';

  insert into storage.objects(bucket_id,name,owner,owner_id,metadata)
  values('naxa-pharmacien-accreditations',v_path,v_promoter,v_promoter::text,
    jsonb_build_object('mimetype','application/pdf'));

  if not exists(select 1 from storage.objects where bucket_id='naxa-pharmacien-accreditations' and name=v_path) then
    raise exception 'La policy Storage n''a pas autorisé le dépôt Promoteur attendu';
  end if;

  insert into naxa_pharmacien_storage_results values(
    'promoteur_upload_authenticated',true,
    'Le Promoteur authentifié peut déposer un justificatif pour un compte actif de sa pharmacie'
  );
  insert into naxa_pharmacien_storage_results values(
    'hors_reseau_refuse',true,
    'Le helper SECURITY DEFINER refuse une pharmacie hors réseau'
  );
end
$test$;

select * from naxa_pharmacien_storage_results order by test;
rollback;
