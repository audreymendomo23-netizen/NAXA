-- NAXA 235 — permettre le comptage de quarantaine aux personnes Stock affectées à la pharmacie.
-- Ne donne aucun droit de déclencher/lever un rappel ou de traiter sa sortie réglementaire.
begin;
create or replace function public.lot_quarantaine_compter(
  p_rappel uuid,
  p_quantite_trouvee integer,
  p_quantite_isolee integer
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_rappel public.rappels_lots%rowtype; v_profile public.profiles%rowtype; v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_quantite_trouvee is null or p_quantite_trouvee<0 or p_quantite_isolee is null or p_quantite_isolee<0 or p_quantite_isolee>p_quantite_trouvee then
  raise exception 'Comptage invalide : unités isolées entre 0 et unités retrouvées';
 end if;
 select * into v_rappel from public.rappels_lots where id=p_rappel and statut='actif' for update;
 if not found then raise exception 'Rappel actif introuvable'; end if;
 if not public.naxa_scope_allows(v_user,v_rappel.pharmacie_id,'PHARMACIE')
   and not public.naxa_has_active_professional_assignment(v_user,v_rappel.pharmacie_id,'gestionnaire_stock')
   and not public.naxa_has_active_professional_assignment(v_user,v_rappel.pharmacie_id,'magasinier') then raise exception 'Rappel hors périmètre'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found then raise exception 'Compte inactif'; end if;
 if coalesce(v_profile.role::text,'')='client' then raise exception 'Comptage réservé à l’équipe pharmacie'; end if;
 update public.rappels_lots
 set quantite_trouvee=p_quantite_trouvee,quantite_isolee=p_quantite_isolee,compte_par=v_user,compte_at=now()
 where id=p_rappel and statut='actif';
end;
$$;
revoke all on function public.lot_quarantaine_compter(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.lot_quarantaine_compter(uuid,integer,integer) to authenticated;
commit;
