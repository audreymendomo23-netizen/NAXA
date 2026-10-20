-- NAXA ERP-011 / F64-ADM — require an active administrator for network notices.
drop policy if exists avis_rappels_lots_reseau_read on public.avis_rappels_lots_reseau;
create policy avis_rappels_lots_reseau_read on public.avis_rappels_lots_reseau for select to authenticated
using (
 (public.is_admin() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text='admin' and p.actif=true))
 or exists (
  select 1 from public.avis_rappels_lots_destinataires d
  join public.promoteur_pharmacies pp on pp.pharmacie_id=d.pharmacie_id and pp.actif=true
  join public.profiles p on p.id=auth.uid() and p.role::text='promoteur' and p.actif=true
  where d.avis_id=avis_rappels_lots_reseau.id and pp.promoteur_id=auth.uid()
 )
);
drop policy if exists avis_rappels_lots_destinataires_read on public.avis_rappels_lots_destinataires;
create policy avis_rappels_lots_destinataires_read on public.avis_rappels_lots_destinataires for select to authenticated
using (
 (public.is_admin() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text='admin' and p.actif=true))
 or exists (
  select 1 from public.promoteur_pharmacies pp
  join public.profiles p on p.id=auth.uid() and p.role::text='promoteur' and p.actif=true
  where pp.promoteur_id=auth.uid() and pp.pharmacie_id=avis_rappels_lots_destinataires.pharmacie_id and pp.actif=true
 )
);
create or replace function public.admin_avis_rappel_lot_diffuser(p_produit_nom text,p_numero_lot text,p_reference_avis text,p_motif text,p_consigne text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_count integer;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text='admin' and p.actif=true) then
  raise exception 'Diffusion réservée à l’administration NAXA active';
 end if;
 if length(trim(coalesce(p_produit_nom,''))) not between 2 and 180 then raise exception 'Produit requis'; end if;
 if length(trim(coalesce(p_numero_lot,''))) not between 1 and 120 then raise exception 'Numéro de lot requis'; end if;
 if p_reference_avis is not null and length(trim(p_reference_avis))>120 then raise exception 'Référence trop longue'; end if;
 if length(trim(coalesce(p_motif,''))) not between 5 and 500 or length(trim(coalesce(p_consigne,''))) not between 5 and 500 then raise exception 'Motif et consigne doivent contenir entre 5 et 500 caractères'; end if;
 insert into public.avis_rappels_lots_reseau(produit_nom,numero_lot,reference_avis,motif,consigne,created_by)
 values(trim(p_produit_nom),trim(p_numero_lot),nullif(trim(p_reference_avis),''),trim(p_motif),trim(p_consigne),auth.uid()) returning id into v_id;
 insert into public.avis_rappels_lots_destinataires(avis_id,pharmacie_id) select v_id,ph.id from public.pharmacies ph where ph.actif=true;
 get diagnostics v_count=row_count;
 if v_count=0 then raise exception 'Aucune pharmacie active à notifier'; end if;
 return v_id;
end; $$;
revoke all on function public.admin_avis_rappel_lot_diffuser(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_avis_rappel_lot_diffuser(text,text,text,text,text) to authenticated;
