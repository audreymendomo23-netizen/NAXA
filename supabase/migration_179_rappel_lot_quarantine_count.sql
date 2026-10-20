-- NAXA ERP-011 / F64 — quarantine count recorded without changing stock value or sales.
begin;
alter table public.rappels_lots
  add column if not exists quantite_trouvee integer,
  add column if not exists quantite_isolee integer,
  add column if not exists compte_par uuid references auth.users(id),
  add column if not exists compte_at timestamptz;
alter table public.rappels_lots drop constraint if exists rappels_lots_quarantaine_quantites_ck;
alter table public.rappels_lots add constraint rappels_lots_quarantaine_quantites_ck check (
  (quantite_trouvee is null or quantite_trouvee>=0)
  and (quantite_isolee is null or quantite_isolee>=0)
  and (quantite_trouvee is null or quantite_isolee is null or quantite_isolee<=quantite_trouvee)
);
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
 if not public.naxa_scope_allows(v_user,v_rappel.pharmacie_id,'PHARMACIE') then raise exception 'Rappel hors périmètre'; end if;
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
comment on function public.lot_quarantaine_compter(uuid,integer,integer) is 'Enregistre le comptage des unités retrouvées et isolées sans modifier le stock ni les prix.';
commit;