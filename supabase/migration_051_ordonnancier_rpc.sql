-- NAXA ERP-007 — RPC d'inscription sécurisée
create or replace function public.ordonnancier_enregistrer(p_vente uuid,p_prescription uuid,p_prescription_item uuid default null,p_designation text default null,p_quantite integer default null,p_reference text default null,p_note text default null,p_substance_controlee boolean default false,p_reference_registre text default null,p_observation text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_vente public.ventes%rowtype;v_prescription public.prescriptions%rowtype;v_item public.prescription_items%rowtype;v_user uuid:=(select auth.uid());v_designation text;v_id uuid;
begin
if v_user is null then raise exception 'Connexion requise';end if;
if p_quantite is null or p_quantite<=0 then raise exception 'Quantité dispensée invalide';end if;
select * into v_vente from public.ventes where id=p_vente for update;
if not found then raise exception 'Vente introuvable';end if;
select * into v_prescription from public.prescriptions where id=p_prescription for update;
if not found then raise exception 'Ordonnance introuvable';end if;
if v_vente.pharmacie_id<>v_prescription.pharmacie_id or v_vente.prescription_id<>p_prescription then raise exception 'Vente et ordonnance incohérentes';end if;
if v_prescription.statut<>'validee' then raise exception 'Ordonnance non validée';end if;
if v_prescription.expires_at is not null and v_prescription.expires_at<now() then raise exception 'Ordonnance expirée';end if;
if v_vente.statut<>'payee' then raise exception 'La vente doit être payée avant inscription';end if;
if not exists(select 1 from public.profiles p where p.id=v_user and p.actif and p.pharmacie_id=v_prescription.pharmacie_id and (p.role='promoteur' or p.fonction_interne='pharmacien_assistant')) then raise exception 'Inscription ordonnancier non autorisée';end if;
if p_prescription_item is not null then
 select * into v_item from public.prescription_items where id=p_prescription_item and prescription_id=p_prescription;
 if not found then raise exception 'Ligne de prescription introuvable';end if;
 v_designation:=coalesce(nullif(trim(p_designation),''),v_item.designation_prescrite);
else v_designation:=nullif(trim(coalesce(p_designation,'')),'');end if;
if v_designation is null then raise exception 'Désignation obligatoire';end if;
insert into public.ordonnancier(pharmacie_id,prescription_id,vente_id,prescription_item_id,dispensateur_id,designation,quantite_dispensee,reference_interne,note_interne)
values(v_prescription.pharmacie_id,p_prescription,p_vente,p_prescription_item,v_user,v_designation,p_quantite,nullif(trim(p_reference),''),nullif(trim(p_note),'')) returning id into v_id;
if p_substance_controlee then
 if nullif(trim(coalesce(p_reference_registre,'')),'') is null then raise exception 'Référence du registre requise';end if;
 insert into public.registre_substances_controlees(ordonnancier_id,pharmacie_id,designation,quantite,reference_registre,observation,enregistre_par)
 values(v_id,v_prescription.pharmacie_id,v_designation,p_quantite,trim(p_reference_registre),nullif(trim(p_observation),''),v_user);
end if;
return v_id;
end;
$$;
revoke execute on function public.ordonnancier_enregistrer(uuid,uuid,uuid,text,integer,text,text,boolean,text,text) from public,anon;
grant execute on function public.ordonnancier_enregistrer(uuid,uuid,uuid,text,integer,text,text,boolean,text,text) to authenticated;