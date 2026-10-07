-- NAXA Partie 3/6 — Accréditation Responsable
-- Additif non destructif. L'API historique doit exiger CREATE_RESPONSABLE pour N2.
create or replace function public.accrediter_profile(p_target uuid,p_pharmacie uuid,p_niveau smallint,p_parent uuid default null)
returns uuid language plpgsql security definer set search_path='' as $naxa$
declare v_id uuid; v_uid uuid:=(select auth.uid()); v_actor_fn text:=public.naxa_business_function(v_uid); v_target_fn text; v_parent_fn text; v_arch text; v_max_resp integer; v_max_caisse integer; v_count integer;
begin
 if p_parent is null or p_niveau not in (2,3) then raise exception 'Niveau ou parent invalide'; end if;
 if not exists(select 1 from public.profiles where id=v_uid and actif) then raise exception 'Acteur invalide'; end if;
 if not exists(select 1 from public.profiles where id=p_target and actif) then raise exception 'Cible invalide'; end if;
 if not public.is_admin() then
   if v_actor_fn<>'promoteur' then raise exception 'Accréditation non autorisée'; end if;
   if not public.naxa_promoteur_valide(v_uid) then raise exception 'Promoteur commercialement invalide'; end if;
   if not public.naxa_scope_allows(v_uid,p_pharmacie,'PHARMACIE') then raise exception 'Pharmacie hors périmètre'; end if;
   if p_niveau=2 and not public.naxa_has_privilege('CREATE_RESPONSABLE',p_pharmacie,'PHARMACIE') then raise exception 'Privilège CREATE_RESPONSABLE insuffisant'; end if;
   if p_niveau=3 and not public.naxa_has_privilege('CREATE_CAISSE',p_pharmacie,'PHARMACIE') then raise exception 'Privilège CREATE_CAISSE insuffisant'; end if;
 end if;
 select architecture_code,max_responsables,max_caisses into v_arch,v_max_resp,v_max_caisse from public.pharmacie_architectures where pharmacie_id=p_pharmacie and active;
 if v_arch is null then raise exception 'Architecture NAXA non assignée'; end if;
 if p_niveau=2 and v_arch not in ('PARENTS_AINES_CADETS','HYBRIDE') then raise exception 'Cette architecture ne permet pas de Responsable'; end if;
 select public.naxa_business_function(p_target) into v_target_fn;
 if p_niveau=2 and v_target_fn<>'responsable' then raise exception 'Niveau 2 exige fonction Responsable'; end if;
 if p_niveau=3 and v_target_fn<>'caisse' then raise exception 'Niveau 3 exige fonction Caisse'; end if;
 select public.naxa_business_function(p_parent) into v_parent_fn;
 if p_niveau=2 and v_parent_fn<>'promoteur' then raise exception 'Responsable doit avoir un Promoteur comme parent'; end if;
 if p_niveau=3 and v_parent_fn not in ('responsable','promoteur') then raise exception 'Caisse doit avoir un Responsable ou un Promoteur comme parent'; end if;
 if p_niveau=2 and v_actor_fn='promoteur' and p_parent<>v_uid then raise exception 'Le Promoteur doit être le parent du Responsable'; end if;
 if p_niveau=3 and v_actor_fn='responsable' and p_parent<>v_uid then raise exception 'Un Responsable ne peut accréditer que ses Caisses directes'; end if;
 if v_parent_fn='promoteur' and not public.is_admin() and not public.naxa_promoteur_valide(p_parent) then raise exception 'Parent Promoteur commercialement invalide'; end if;
 if v_parent_fn='promoteur' and not public.is_admin() and not exists(select 1 from public.promoteur_pharmacies where promoteur_id=p_parent and pharmacie_id=p_pharmacie and actif) then raise exception 'Parent Promoteur hors périmètre'; end if;
 if p_niveau=2 then select count(*) into v_count from public.profiles where pharmacie_id=p_pharmacie and actif and niveau_interne=2 and public.naxa_business_function(id)='responsable'; if v_max_resp is not null and v_count>=v_max_resp then raise exception 'Quota Responsables atteint'; end if;
 else select count(*) into v_count from public.profiles where pharmacie_id=p_pharmacie and actif and niveau_interne=3 and public.naxa_business_function(id)='caisse'; if v_max_caisse is not null and v_count>=v_max_caisse then raise exception 'Quota Caisses atteint'; end if; end if;
 insert into public.profile_accreditations(grantor_profile_id,target_profile_id,pharmacie_id,niveau) values(v_uid,p_target,p_pharmacie,p_niveau) returning id into v_id;
 update public.profiles set parent_profile_id=p_parent,pharmacie_id=p_pharmacie,niveau_interne=p_niveau,niveau_hierarchique=p_niveau,architecture_code=v_arch,actif=true where id=p_target;
 return v_id;
end $naxa$;
revoke all on function public.accrediter_profile(uuid,uuid,smallint,uuid) from public,anon,authenticated;
grant execute on function public.accrediter_profile(uuid,uuid,smallint,uuid) to authenticated;
create or replace function public.accrediter_responsable(p_target uuid,p_pharmacie uuid)
returns uuid language plpgsql security definer set search_path='' as $naxa$
begin return public.accrediter_profile(p_target,p_pharmacie,2,(select auth.uid())); end
$naxa$;
revoke all on function public.accrediter_responsable(uuid,uuid) from public,anon,authenticated;
grant execute on function public.accrediter_responsable(uuid,uuid) to authenticated;
