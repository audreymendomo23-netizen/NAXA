-- NAXA ERP-003 — Caisse : modes de paiement opérateurs distincts
alter type public.mode_paiement_caisse add value if not exists 'orange_money';
alter type public.mode_paiement_caisse add value if not exists 'mtn_momo';

create index if not exists vente_paiements_mode_date_idx on public.vente_paiements(mode, created_at desc);

create or replace function public.vente_encaisser(
  p_vente uuid,p_mode public.mode_paiement_caisse,p_montant_percu integer,p_reference text default null
)
returns table(paiement_id uuid,montant_a_payer integer,monnaie_rendue integer)
language plpgsql security definer set search_path=''
as $encaisse$
declare v public.ventes%rowtype; v_id uuid; v_change integer;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 if p_montant_percu is null or p_montant_percu<=0 then raise exception 'Montant perçu invalide'; end if;
 select * into v from public.ventes where id=p_vente for update;
 if not found or v.statut<>'brouillon' then raise exception 'Vente invalide'; end if;
 if not(public.is_admin() or public.can_operate_pharmacy(v.pharmacie_id)) then raise exception 'Vente hors périmètre'; end if;
 if not exists(select 1 from public.vente_lignes where vente_id=p_vente) then raise exception 'Vente vide'; end if;
 if p_mode in ('orange_money','mtn_momo','mobile_money') then
   if p_montant_percu<>v.total_net then raise exception 'Le paiement électronique doit correspondre exactement au total'; end if;
   if nullif(trim(coalesce(p_reference,'')),'') is null then raise exception 'Référence opérateur obligatoire'; end if;
 end if;
 if p_mode='especes' and p_montant_percu<v.total_net then raise exception 'Montant espèces insuffisant'; end if;
 v_change:=case when p_mode='especes' then greatest(p_montant_percu-v.total_net,0) else 0 end;
 insert into public.vente_paiements(vente_id,mode,montant,reference,created_by,montant_percu,monnaie_rendue)
 values(p_vente,p_mode,v.total_net,nullif(trim(p_reference),''),auth.uid(),p_montant_percu,v_change)
 returning id into v_id;
 return query select v_id,v.total_net,v_change;
end;$encaisse$;
revoke all on function public.vente_encaisser(uuid,public.mode_paiement_caisse,integer,text) from public,anon,authenticated;
grant execute on function public.vente_encaisser(uuid,public.mode_paiement_caisse,integer,text) to authenticated;
comment on type public.mode_paiement_caisse is 'Modes POS : espèces, Orange Money, MTN MoMo, mobile_money historique et autres modes historiques.';
