-- NAXA 158 — retrait contrôlé d'un produit du panier Caisse.
-- Restaure le stock agrégé et le lot d'origine avant suppression des lignes.
begin;

create or replace function public.naxa_guard_pos_line_write()
returns trigger
language plpgsql
security definer
set search_path=''
as $guard$
declare
  v_vente public.ventes%rowtype;
  v_vente_id uuid;
begin
  if auth.uid() is null or public.is_admin() then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;

  v_vente_id:=case when tg_op='DELETE' then old.vente_id else new.vente_id end;
  select * into v_vente from public.ventes where id=v_vente_id;
  if not found or v_vente.statut<>'brouillon'
     or v_vente.created_by is distinct from auth.uid()
     or not public.naxa_caisse_actor_for_pharmacy(v_vente.pharmacie_id)
     or not exists (
       select 1 from public.caisses_sessions cs
       where cs.id=v_vente.caisse_session_id
         and cs.statut='ouverte'
         and cs.ouvert_par=auth.uid()
     ) then
    raise exception 'Modification de ligne réservée au créateur Caisse dans une session ouverte qui lui appartient';
  end if;

  if tg_op='DELETE' then
    if coalesce(current_setting('naxa.pos_internal_mutation',true),'')<>'remove_line' then
      raise exception 'Suppression de ligne réservée à la RPC de retrait contrôlé';
    end if;
    return old;
  end if;

  if tg_op<>'INSERT' then
    raise exception 'Modification directe des lignes POS interdite';
  end if;
  return new;
end;
$guard$;

revoke all on function public.naxa_guard_pos_line_write() from public,anon,authenticated;

create or replace function public.vente_produit_retirer(
  p_vente uuid,
  p_produit uuid
)
returns integer
language plpgsql
security definer
set search_path=''
as $retirer$
declare
  v_vente public.ventes%rowtype;
  v_session public.caisses_sessions%rowtype;
  v_ligne record;
  v_retirer integer;
  v_pharmacie public.pharmacies%rowtype;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_vente is null or p_produit is null then raise exception 'Vente et produit requis'; end if;

  select * into v_vente
  from public.ventes
  where id=p_vente
  for update;
  if not found or v_vente.statut<>'brouillon' then
    raise exception 'Vente introuvable ou déjà finalisée';
  end if;
  if v_vente.created_by is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Seul le créateur du panier peut retirer un produit';
  end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Vente hors périmètre';
  end if;

  select * into v_pharmacie from public.pharmacies
  where id=v_vente.pharmacie_id and actif=true and visible_recherche=true;
  if not found then raise exception 'Pharmacie inactive ou non publiée'; end if;

  select * into v_session from public.caisses_sessions
  where id=v_vente.caisse_session_id
  for update;
  if not found or v_session.statut<>'ouverte' then
    raise exception 'Session de caisse fermée ou introuvable';
  end if;
  if not public.is_admin() then
    if v_session.ouvert_par is distinct from auth.uid() then
      raise exception 'Seul le titulaire de la session peut modifier le panier';
    end if;
    select * into v_profile from public.profiles
    where id=auth.uid() and actif=true;
    if not found or v_profile.pharmacie_id is distinct from v_vente.pharmacie_id
       or (coalesce(v_profile.role::text,'')<>'caisse'
           and coalesce(v_profile.fonction_interne,'')<>'caisse') then
      raise exception 'Retrait réservé à un compte Caisse actif de cette pharmacie';
    end if;
  end if;

  select coalesce(sum(quantite),0)::integer into v_retirer
  from public.vente_lignes
  where vente_id=p_vente and produit_id=p_produit;
  if v_retirer<=0 then raise exception 'Produit absent du panier'; end if;

  for v_ligne in
    select id,lot_id,quantite
    from public.vente_lignes
    where vente_id=p_vente and produit_id=p_produit
    order by id
    for update
  loop
    if v_ligne.lot_id is not null then
      update public.stocks_lots
      set quantite=quantite+v_ligne.quantite
      where id=v_ligne.lot_id
        and pharmacie_id=v_vente.pharmacie_id
        and produit_id=p_produit;
      if not found then raise exception 'Lot d’origine introuvable ; retrait annulé'; end if;
    end if;

    update public.stocks
    set quantite=quantite+v_ligne.quantite,
        updated_at=now()
    where pharmacie_id=v_vente.pharmacie_id
      and produit_id=p_produit;
    if not found then raise exception 'Stock agrégé introuvable ; retrait annulé'; end if;
  end loop;

  perform set_config('naxa.pos_internal_mutation','remove_line',true);
  delete from public.vente_lignes
  where vente_id=p_vente and produit_id=p_produit;
  perform set_config('naxa.pos_internal_mutation','',true);

  perform public.vente_recalculer_totaux(p_vente);
  return v_retirer;
end;
$retirer$;

revoke all on function public.vente_produit_retirer(uuid,uuid) from public,anon,authenticated;
grant execute on function public.vente_produit_retirer(uuid,uuid) to authenticated;

commit;
