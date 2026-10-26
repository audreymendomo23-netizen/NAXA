create or replace function public.admin_refuser_reglement_promoteur(p_reglement uuid,p_admin uuid,p_motif text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare r public.abonnement_promoteur_reglements%rowtype;
begin
 if not exists(select 1 from public.profiles where id=p_admin and role::text='admin' and actif=true) then raise exception 'Accès administrateur actif requis'; end if;
 if length(trim(coalesce(p_motif,'')))<5 or length(trim(coalesce(p_motif,'')))>500 then raise exception 'Un motif de 5 à 500 caractères est requis'; end if;
 select * into r from public.abonnement_promoteur_reglements where id=p_reglement for update;
 if not found then raise exception 'Règlement introuvable'; end if;
 if r.statut <> 'en_attente' then raise exception 'Ce règlement n’est plus en attente'; end if;
 update public.abonnement_promoteur_reglements set statut='conteste',motif_contestation=trim(p_motif),updated_at=now() where id=r.id;
 insert into public.notifications(user_id,type,titre,corps)
 values(r.promoteur_id,'abonnement_reglement_conteste','Règlement à corriger','Le règlement enregistré nécessite une correction : '||trim(p_motif)||'. Contactez NAXA pour régulariser le dossier.');
 insert into public.journal_admin(admin_profile_id,action,cible_type,cible_id,motif,detail)
 values(p_admin,'reglement_promoteur_conteste','promoteur',r.promoteur_id::text,trim(p_motif),jsonb_build_object('reglement_id',r.id,'montant',r.montant));
 return r.id;
end $$;
revoke all on function public.admin_refuser_reglement_promoteur(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_refuser_reglement_promoteur(uuid,uuid,text) to service_role;