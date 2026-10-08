-- NAXA ERP-003 — complément étape 7/9 : création contrôlée vouchers/promotions
create or replace function public.vente_voucher_creer(p_pharmacie uuid,p_code text,p_montant integer,p_expires_at timestamptz default null)
returns uuid language plpgsql security definer set search_path=''
as $voucher_create$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 if not(public.is_admin() or public.can_operate_pharmacy(p_pharmacie)) then raise exception 'Pharmacie hors périmètre'; end if;
 if p_montant<=0 or length(trim(coalesce(p_code,'')))<3 then raise exception 'Voucher invalide'; end if;
 insert into public.vente_vouchers(pharmacie_id,code,montant_initial,solde,expires_at,created_by)
 values(p_pharmacie,upper(trim(p_code)),p_montant,p_montant,p_expires_at,auth.uid()) returning id into v_id;
 return v_id;
end;
$voucher_create$;
revoke all on function public.vente_voucher_creer(uuid,text,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.vente_voucher_creer(uuid,text,integer,timestamptz) to authenticated;

create or replace function public.pos_promotion_creer(p_pharmacie uuid,p_nom text,p_type text,p_valeur integer,p_plafond integer default null,p_approbation_requise boolean default true,p_date_debut timestamptz default now(),p_date_fin timestamptz default null)
returns uuid language plpgsql security definer set search_path=''
as $promo_create$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 if not(public.is_admin() or public.can_operate_pharmacy(p_pharmacie)) then raise exception 'Pharmacie hors périmètre'; end if;
 if length(trim(coalesce(p_nom,'')))<2 or p_type not in ('pourcentage','montant') or p_valeur<=0 then raise exception 'Promotion invalide'; end if;
 if p_type='pourcentage' and p_valeur>100 then raise exception 'Pourcentage invalide'; end if;
 if p_plafond is not null and p_plafond<=0 then raise exception 'Plafond invalide'; end if;
 insert into public.pos_promotions(pharmacie_id,nom,type,valeur,plafond,approbation_requise,date_debut,date_fin,created_by)
 values(p_pharmacie,trim(p_nom),p_type,p_valeur,p_plafond,p_approbation_requise,p_date_debut,p_date_fin,auth.uid()) returning id into v_id;
 return v_id;
end;
$promo_create$;
revoke all on function public.pos_promotion_creer(uuid,text,text,integer,integer,boolean,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.pos_promotion_creer(uuid,text,text,integer,integer,boolean,timestamptz,timestamptz) to authenticated;
