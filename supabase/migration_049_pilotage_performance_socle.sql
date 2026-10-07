-- NAXA — Partie 2 Pilotage 360° : socle Performance
begin;

drop view if exists public.v_reservations_ca;

create view public.v_reservations_ca as
select r.id reservation_id,r.pharmacie_id,r.client_id,r.total ca_xaf,r.statut,r.created_at
from public.reservations r where r.statut in ('payee','retiree');

alter view public.v_reservations_ca set (security_invoker = true);
revoke all on public.v_reservations_ca from anon;
grant select on public.v_reservations_ca to authenticated;

create index if not exists reservations_pilotage_statut_created_idx on public.reservations(statut,created_at,pharmacie_id);
create index if not exists stocks_pilotage_pharmacie_updated_idx on public.stocks(pharmacie_id,updated_at);


create or replace function public.stats_pilotage_scope(p_jours integer default 7)
returns jsonb language plpgsql stable security definer set search_path=''
as $body$
declare uid uuid := (select auth.uid()); role_name text; pharmacy_id uuid; from_ts timestamptz;
v_pharmacies bigint:=0; v_ca bigint:=0; v_sales bigint:=0; v_reservations bigint:=0; v_paid bigint:=0; v_picked bigint:=0;
v_stock_lines bigint:=0; v_stock_units bigint:=0; v_out_of_stock bigint:=0; v_stock_coverage numeric:=0; v_avg_basket numeric:=0;
begin
 if uid is null then raise exception 'Connexion requise'; end if;
 if p_jours<1 or p_jours>366 then raise exception 'Période invalide'; end if;
 select public.naxa_business_function(uid),p.pharmacie_id into role_name,pharmacy_id from public.profiles p where p.id=uid and p.actif;
 if role_name is null then raise exception 'Profil inactif ou inexistant'; end if;
 if role_name='admin' then null;
 elsif role_name='promoteur' then
   if not public.naxa_has_privilege('VIEW_NETWORK_PILOTAGE',null,'RESEAU') then raise exception 'Pilotage réseau non autorisé'; end if;
 elsif role_name in ('responsable','caisse') then
   if not public.naxa_has_privilege('VIEW_PERFORMANCE_PILOTAGE',pharmacy_id,'PHARMACIE') then raise exception 'Pilotage performance non autorisé'; end if;
 else raise exception 'Pilotage non autorisé pour ce profil'; end if;
 from_ts:=now()-make_interval(days=>p_jours);
 with scope as (
   select ph.id from public.pharmacies ph where ph.actif and (
     role_name='admin'
     or (role_name='promoteur' and exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=uid and pp.pharmacie_id=ph.id and pp.actif))
     or (role_name in ('responsable','caisse') and ph.id=pharmacy_id)
   )
 )
 select count(*),
 coalesce((select sum(v.ca_xaf) from public.v_reservations_ca v join scope s on s.id=v.pharmacie_id where v.created_at>=from_ts),0),
 coalesce((select count(*) from public.v_reservations_ca v join scope s on s.id=v.pharmacie_id where v.created_at>=from_ts),0),
 coalesce((select count(*) from public.reservations r join scope s on s.id=r.pharmacie_id where r.created_at>=from_ts),0),
 coalesce((select count(*) from public.reservations r join scope s on s.id=r.pharmacie_id where r.created_at>=from_ts and r.statut='payee'),0),
 coalesce((select count(*) from public.reservations r join scope s on s.id=r.pharmacie_id where r.created_at>=from_ts and r.statut='retiree'),0),
 coalesce((select count(*) from public.stocks st join scope s on s.id=st.pharmacie_id),0),
 coalesce((select sum(st.quantite) from public.stocks st join scope s on s.id=st.pharmacie_id),0),
 coalesce((select count(*) from public.stocks st join scope s on s.id=st.pharmacie_id and st.quantite=0),0)
 into v_pharmacies,v_ca,v_sales,v_reservations,v_paid,v_picked,v_stock_lines,v_stock_units,v_out_of_stock;
 if v_stock_lines>0 then v_stock_coverage:=round(((v_stock_lines-v_out_of_stock)::numeric/v_stock_lines::numeric)*100,2); end if;
 if v_sales>0 then v_avg_basket:=round(v_ca::numeric/v_sales::numeric,2); end if;
 return jsonb_build_object('role',role_name,'jours',p_jours,
 'pharmacies',jsonb_build_object('total',v_pharmacies),
 'commercial',jsonb_build_object('ca_xaf',v_ca,'ventes',v_sales,'panier_moyen_xaf',v_avg_basket,'reservations',v_reservations,'payees',v_paid,'retirees',v_picked),
 'performance',jsonb_build_object('lignes_stock',v_stock_lines,'unites_stock',v_stock_units,'ruptures_lignes',v_out_of_stock,'couverture_stock_pct',v_stock_coverage),
 'unsupported_until_erp',jsonb_build_array('marge','benefice','performance_par_caisse','retention_client'));
end;
$body$;

revoke all on function public.stats_pilotage_scope(integer) from public,anon;
grant execute on function public.stats_pilotage_scope(integer) to authenticated;

commit;
