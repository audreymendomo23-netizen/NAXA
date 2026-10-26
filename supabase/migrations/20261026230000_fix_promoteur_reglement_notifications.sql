-- Notifications de règlement sans fil_id : ce champ référence fils_messages.id, pas un règlement.
create or replace function public.admin_enregistrer_reglement_promoteur(p_promoteur uuid,p_montant integer,p_canal text,p_canal_autre text,p_reference text,p_paye_le timestamptz,p_preuve_path text,p_admin uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_abonnement public.abonnements_promoteurs%rowtype; v_id uuid;
begin
 if not exists(select 1 from public.profiles where id=p_admin and role::text='admin' and actif=true) then raise exception 'Accès administrateur actif requis'; end if;
 if p_promoteur is null or not exists(select 1 from public.profiles where id=p_promoteur and role::text='promoteur') then raise exception 'Promoteur introuvable'; end if;
 if p_montant is null or p_montant<=0 or p_canal not in ('especes','orange_money','mtn_momo','virement','depot_bancaire','autre') then raise exception 'Montant ou canal invalide'; end if;
 if p_canal='autre' and length(trim(coalesce(p_canal_autre,''))) not between 2 and 80 then raise exception 'Précisez le canal de paiement'; end if;
 if p_preuve_path is null or p_preuve_path !~ ('^' || p_promoteur::text || '/[0-9a-fA-F-]+\.(pdf|jpg|jpeg|png|webp)$') then raise exception 'Chemin de preuve invalide'; end if;
 select * into v_abonnement from public.abonnements_promoteurs where promoteur_id=p_promoteur for update;
 if not found then raise exception 'Abonnement Promoteur introuvable'; end if;
 if exists(select 1 from public.abonnement_promoteur_reglements where promoteur_id=p_promoteur and statut='en_attente') then raise exception 'Un règlement est déjà en attente pour ce Promoteur'; end if;
 insert into public.abonnement_promoteur_reglements(promoteur_id,abonnement_id,montant,canal,canal_autre,reference,paye_le,preuve_path,enregistre_par)
 values(p_promoteur,v_abonnement.id,p_montant,p_canal,nullif(trim(coalesce(p_canal_autre,'')),''),nullif(trim(coalesce(p_reference,'')),''),p_paye_le,p_preuve_path,p_admin) returning id into v_id;
 insert into public.notifications(user_id,type,titre,corps)
 values(p_promoteur,'abonnement_reglement','Règlement à confirmer','Un règlement de votre abonnement a été enregistré par NAXA. Consultez votre espace Promoteur pour suivre sa validation.');
 insert into public.journal_admin(admin_profile_id,action,cible_type,cible_id,motif,detail)
 values(p_admin,'reglement_promoteur_enregistre','promoteur',p_promoteur::text,'Enregistrement d’un paiement manuel à confirmer',jsonb_build_object('reglement_id',v_id,'montant',p_montant,'canal',p_canal,'preuve_path',p_preuve_path));
 return v_id;
end $$;
create or replace function public.admin_confirmer_reglement_promoteur(p_reglement uuid,p_admin uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare r public.abonnement_promoteur_reglements%rowtype; a public.abonnements_promoteurs%rowtype; c public.conventions_promoteurs%rowtype; v_debut date; v_fin date; v_recu text;
begin
 if not exists(select 1 from public.profiles where id=p_admin and role::text='admin' and actif=true) then raise exception 'Accès administrateur actif requis'; end if;
 select * into r from public.abonnement_promoteur_reglements where id=p_reglement for update;
 if not found then raise exception 'Règlement introuvable'; end if;
 if r.statut='confirme' then return jsonb_build_object('id',r.id,'numero_recu',r.numero_recu,'periode_du',r.periode_du,'periode_au',r.periode_au,'deja_confirme',true); end if;
 if r.statut <> 'en_attente' then raise exception 'Ce règlement n’est plus en attente'; end if;
 select * into a from public.abonnements_promoteurs where id=r.abonnement_id and promoteur_id=r.promoteur_id for update;
 if not found then raise exception 'Abonnement incohérent'; end if;
 select * into c from public.conventions_promoteurs where id=a.convention_id and promoteur_id=r.promoteur_id for update;
 if not found then raise exception 'Convention incohérente'; end if;
 if r.montant <> c.montant_mensuel or a.montant_mensuel <> c.montant_mensuel then raise exception 'Le montant enregistré ne correspond pas au tarif conventionné'; end if;
 v_debut := greatest(current_date,a.echeance+1); v_fin := (v_debut+interval '1 month'-interval '1 day')::date;
 v_recu := 'NAXA-AB-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(r.id::text,'-',''),1,10));
 update public.abonnement_promoteur_reglements set statut='confirme',confirme_par=p_admin,confirme_le=now(),periode_du=v_debut,periode_au=v_fin,numero_recu=v_recu,updated_at=now() where id=r.id;
 update public.abonnements_promoteurs set debut=v_debut,echeance=v_fin,statut='actif',bloque_le=null,reactive_le=now(),reactive_par=p_admin where id=a.id;
 update public.conventions_promoteurs set date_paiement=current_date,date_expiration=v_fin,statut='active',updated_at=now() where id=c.id;
 insert into public.abonnement_promoteur_paiements(abonnement_id,periode_du,periode_au,montant,reference,paye_le,enregistre_par) values(a.id,v_debut,v_fin,r.montant,r.reference,coalesce(r.paye_le,now()),p_admin);
 update public.profiles set actif=true where id=r.promoteur_id;
 update public.pharmacies ph set actif=true where exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=r.promoteur_id and pp.pharmacie_id=ph.id);
 update public.profiles pr set actif=true where exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=r.promoteur_id and pp.pharmacie_id=pr.pharmacie_id);
 insert into public.notifications(user_id,type,titre,corps)
 values(r.promoteur_id,'abonnement_reglement_confirme','Paiement confirmé · reçu disponible','Votre paiement manuel a été confirmé. Votre abonnement est réactivé jusqu’au '||to_char(v_fin,'DD/MM/YYYY')||'. Reçu : '||v_recu||'.');
 insert into public.journal_admin(admin_profile_id,action,cible_type,cible_id,motif,detail)
 values(p_admin,'reglement_promoteur_confirme','promoteur',r.promoteur_id::text,'Encaissement vérifié et abonnement réactivé',jsonb_build_object('reglement_id',r.id,'numero_recu',v_recu,'montant',r.montant,'periode_du',v_debut,'periode_au',v_fin));
 return jsonb_build_object('id',r.id,'numero_recu',v_recu,'periode_du',v_debut,'periode_au',v_fin,'deja_confirme',false);
end $$;