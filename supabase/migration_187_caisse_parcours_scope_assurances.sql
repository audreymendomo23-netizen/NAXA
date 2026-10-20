-- NAXA 187 — lecture pharmacie des couvertures utilisées et périmètre des demandes d'annulation caisse.
-- Migration additive : aucune donnée existante n'est modifiée.
begin;

drop policy if exists couvertures_assurance_pharmacie_dossier_read on public.couvertures_assurance;
create policy couvertures_assurance_pharmacie_dossier_read
on public.couvertures_assurance
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.dossiers_assurance d
    where d.couverture_id = couvertures_assurance.id
      and public.naxa_scope_allows((select auth.uid()),d.pharmacie_id,'PHARMACIE')
  )
);

create or replace function public.vente_annulation_demander(p_vente uuid,p_motif text)
returns uuid
language plpgsql
security definer
set search_path=''
as $annul_demande$
declare
  v_vente public.ventes%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if length(trim(coalesce(p_motif,''))) < 3 then
    raise exception 'Motif d''annulation obligatoire';
  end if;

  select * into v_vente
  from public.ventes
  where id=p_vente
  for update;

  if not found then raise exception 'Vente introuvable'; end if;
  if v_vente.statut <> 'payee' then
    raise exception 'Seule une vente payée peut être annulée';
  end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Vente hors périmètre';
  end if;

  -- Contrôle serveur du périmètre propre à la caissière, même si elle connaît un autre UUID.
  if exists (
    select 1 from public.profiles p
    where p.id=auth.uid()
      and p.actif=true
      and (coalesce(p.role::text,'')='caisse' or coalesce(p.fonction_interne,'')='caisse')
  ) and v_vente.created_by is distinct from auth.uid() then
    raise exception 'La caisse ne peut demander l''annulation que de ses propres ventes';
  end if;

  insert into public.vente_annulation_demandes(vente_id,pharmacie_id,motif,demandee_par)
  values(p_vente,v_vente.pharmacie_id,trim(p_motif),auth.uid())
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Une demande d''annulation est déjà en attente pour cette vente';
end;
$annul_demande$;

revoke all on function public.vente_annulation_demander(uuid,text) from public,anon,authenticated;
grant execute on function public.vente_annulation_demander(uuid,text) to authenticated;

commit;
