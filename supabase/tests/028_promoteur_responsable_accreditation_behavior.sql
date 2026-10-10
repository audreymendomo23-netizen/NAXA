-- NAXA 028 behavior — architecture, accréditation Responsable et validité commerciale.
-- Fixture autonome ; aucune donnée ne persiste après rollback.

begin;
create temp table arch_ids(promoteur uuid,pharmacie uuid,other_pharmacie uuid,target_resp uuid);

do $test$
declare
  p uuid := '028b0000-0000-4000-8000-000000000001';
  target uuid := '028b0000-0000-4000-8000-000000000002';
  ph uuid := '028b0000-0000-4000-8000-000000000101';
  other uuid := '028b0000-0000-4000-8000-000000000102';
  conv uuid;
begin
  set local session_replication_role=replica;
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
   ('00000000-0000-0000-0000-000000000000',p,'authenticated','authenticated','arch-p-028b@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
   ('00000000-0000-0000-0000-000000000000',target,'authenticated','authenticated','arch-r-028b@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now())
  on conflict(id) do nothing;
  set local session_replication_role=origin;

  insert into public.profiles(id,role,actif,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values
   (p,'promoteur',true,'promoteur',1,1,'PARENTS_AINES_CADETS'),
   (target,'pharmacie',true,'responsable',2,2,'PARENTS_AINES_CADETS')
  on conflict(id) do update set role=excluded.role,actif=true,fonction_interne=excluded.fonction_interne,niveau_interne=excluded.niveau_interne,niveau_hierarchique=excluded.niveau_hierarchique,architecture_code=excluded.architecture_code;

  insert into public.pharmacies(id,nom,ville,lat,lng,est_demo,actif)
  values(ph,'NAXA Test Architecture A3','Yaoundé',3.87,11.52,false,true),(other,'NAXA Test hors scope','Yaoundé',3.88,11.53,false,true)
  on conflict(id) do update set est_demo=false,actif=true;

  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
  values(p,30000,current_date+30,'active','PARENTS_AINES_CADETS')
  on conflict(promoteur_id) do update set montant_mensuel=30000,date_expiration=current_date+30,statut='active',architecture_code='PARENTS_AINES_CADETS'
  returning id into conv;

  insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
  values(p,conv,30000,current_date,current_date+30,'actif')
  on conflict(promoteur_id) do update set convention_id=excluded.convention_id,montant_mensuel=30000,debut=current_date,echeance=current_date+30,statut='actif';

  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
  values(ph,'PARENTS_AINES_CADETS',p,true,5,5)
  on conflict(pharmacie_id) do update set architecture_code=excluded.architecture_code,assigned_by=excluded.assigned_by,active=true,max_responsables=5,max_caisses=5;

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(p,ph,true)
  on conflict(promoteur_id,pharmacie_id) do update set actif=true;

  update public.profiles set pharmacie_id=ph,parent_profile_id=p where id=target;
  insert into arch_ids values(p,ph,other,target);

  perform set_config('request.jwt.claim.sub',p::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',p::text,'role','authenticated')::text,true);

  if not public.naxa_has_privilege('CREATE_RESPONSABLE',ph,'PHARMACIE') then raise exception 'A3 doit autoriser CREATE_RESPONSABLE dans la pharmacie liée'; end if;
  if public.naxa_has_privilege('CREATE_RESPONSABLE',other,'PHARMACIE') then raise exception 'CREATE_RESPONSABLE ne doit pas sortir du réseau'; end if;

  if public.accrediter_profile(target,ph,2::smallint,p) is null then raise exception 'Accréditation Responsable non créée'; end if;
  if not exists(select 1 from public.profiles where id=target and fonction_interne='responsable' and niveau_interne=2 and pharmacie_id=ph and parent_profile_id=p) then
    raise exception 'Profil Responsable mal accrédité';
  end if;

  update public.conventions_promoteurs set date_expiration=current_date-1,statut='expiree' where promoteur_id=p;
  update public.abonnements_promoteurs set echeance=current_date-1,statut='impaye' where promoteur_id=p;
  if public.naxa_can('CREATE_RESPONSABLE',ph,null) then raise exception 'Privilège encore autorisé après expiration commerciale'; end if;

  update public.conventions_promoteurs set date_expiration=current_date+30,statut='active',architecture_code='ORPHELIN' where promoteur_id=p;
  update public.abonnements_promoteurs set echeance=current_date+30,statut='actif' where promoteur_id=p;
  update public.pharmacie_architectures set architecture_code='ORPHELIN',max_responsables=0,max_caisses=1 where pharmacie_id=ph;
  if public.naxa_has_privilege('CREATE_RESPONSABLE',ph,'PHARMACIE') then raise exception 'A1 ne doit pas autoriser CREATE_RESPONSABLE'; end if;
end
$test$;

rollback;
select '028_promoteur_responsable_accreditation_behavior PASS' as resultat;
