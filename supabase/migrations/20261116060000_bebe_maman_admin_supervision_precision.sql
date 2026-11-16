-- NAXA — Préciser les indicateurs Admin Bébé & Maman.
-- Les offres suivent l'activation effective du service ; les réservations en cours restent visibles même après retrait d'une référence.
begin;

create or replace function public.admin_bebe_maman_supervision()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Consultation réservée à l’Administrateur actif';
  end if;
  select jsonb_build_object(
    'pharmacies_service_actif',(
      select count(*) from public.pharmacie_services ps
      join public.pharmacies ph on ph.id=ps.pharmacie_id
      where ps.service_slug='bebe-maman' and ps.status='active'
        and ph.actif=true and ph.archivee_le is null
    ),
    'references_publiees',(
      select count(*) from public.pharmacie_bebe_maman_produits bm
      join public.pharmacie_services ps on ps.pharmacie_id=bm.pharmacie_id
        and ps.service_slug='bebe-maman' and ps.status='active'
      join public.pharmacies ph on ph.id=bm.pharmacie_id
        and ph.actif=true and ph.visible_recherche=true
        and ph.est_demo=false and ph.archivee_le is null
      join public.universes u on u.slug='bebe-maman' and u.enabled=true
      join public.feature_flags f on f.flag_key='universe.bebe-maman' and f.enabled=true
      where bm.active=true
    ),
    'offres_disponibles',(
      select count(*) from public.pharmacie_bebe_maman_produits bm
      join public.pharmacie_services ps on ps.pharmacie_id=bm.pharmacie_id
        and ps.service_slug='bebe-maman' and ps.status='active'
      join public.universes u on u.slug='bebe-maman' and u.enabled=true
      join public.feature_flags f on f.flag_key='universe.bebe-maman' and f.enabled=true
      cross join lateral private.marketplace_offre_stock_disponible_guarded(
        bm.pharmacie_id,bm.produit_id
      ) offer
      where bm.active=true and offer.quantite>0
    ),
    'reservations_a_traiter',(
      select count(distinct r.id) from public.reservations r
      join public.reservation_items ri on ri.reservation_id=r.id
      join public.pharmacie_bebe_maman_produits bm
        on bm.pharmacie_id=r.pharmacie_id and bm.produit_id=ri.produit_id
      where r.mode='reservation' and r.statut in ('en_attente','confirmee')
        and r.expires_at>now()
    )
  ) into v_result;
  return v_result;
end;
$function$;
revoke all on function public.admin_bebe_maman_supervision() from public,anon;
grant execute on function public.admin_bebe_maman_supervision() to authenticated;

commit;
