-- Vérifie la forme canonique de v_reservations_ca après le replay.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='v_reservations_ca' and column_name='pharmacie_id'
  ) then raise exception 'v_reservations_ca.pharmacie_id absent'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='v_reservations_ca' and column_name='ventes'
  ) then raise exception 'v_reservations_ca.ventes absent'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='v_reservations_ca' and column_name='panier_moyen'
  ) then raise exception 'v_reservations_ca.panier_moyen absent'; end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='v_reservations_ca' and column_name='id'
  ) then raise exception 'v_reservations_ca.id legacy encore présent'; end if;
  if to_regclass('public.v_ventes_journalieres') is null then raise exception 'v_ventes_journalieres absente'; end if;
  if to_regclass('bi.activite_mensuelle') is null then raise exception 'bi.activite_mensuelle absente'; end if;
end
$$;

select '034b_reservations_ca_view_compat PASS' as resultat;
