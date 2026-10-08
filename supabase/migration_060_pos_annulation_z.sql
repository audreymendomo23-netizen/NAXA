-- NAXA ERP-003 — POS étapes 4/5/6 : annulation contrôlée, approbation sensible, clôture Z
-- Extension additive du moteur POS existant. Aucun second moteur de vente/caisse.

alter table public.caisses_sessions
  drop constraint if exists caisses_sessions_caisse_id_key;

create unique index if not exists caisses_sessions_caisse_ouverte_uq
  on public.caisses_sessions(caisse_id)
  where statut='ouverte';

create table if not exists public.vente_annulation_demandes (
  id uuid primary key default gen_random_uuid(),
  vente_id uuid not null references public.ventes(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  motif text not null check (length(trim(motif)) >= 3),
  statut text not null default 'en_attente'
    check (statut in ('en_attente','approuvee','rejetee')),
  demandee_par uuid not null references auth.users(id) on delete restrict,
  decidee_par uuid references auth.users(id) on delete set null,
  decidee_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists vente_annulation_demandes_active_uq
  on public.vente_annulation_demandes(vente_id)
  where statut='en_attente';

create index if not exists vente_annulation_demandes_scope_idx
  on public.vente_annulation_demandes(pharmacie_id, statut, created_at desc);

alter table public.vente_annulation_demandes enable row level security;

drop policy if exists vente_annulation_demandes_read on public.vente_annulation_demandes;
create policy vente_annulation_demandes_read
  on public.vente_annulation_demandes
  for select to authenticated
  using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

revoke all on public.vente_annulation_demandes from anon, authenticated;
grant select on public.vente_annulation_demandes to authenticated;

create or replace function public.vente_annulation_demander(p_vente uuid,p_motif text)
returns uuid
language plpgsql
security definer
set search_path=''
as $annul_demande$
declare v_vente public.ventes%rowtype; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if length(trim(coalesce(p_motif,''))) < 3 then raise exception 'Motif d''annulation obligatoire'; end if;
  select * into v_vente from public.ventes where id=p_vente for update;
  if not found then raise exception 'Vente introuvable'; end if;
  if v_vente.statut <> 'payee' then raise exception 'Seule une vente payée peut être annulée'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then raise exception 'Vente hors périmètre'; end if;
  insert into public.vente_annulation_demandes(vente_id,pharmacie_id,motif,demandee_par)
  values(p_vente,v_vente.pharmacie_id,trim(p_motif),auth.uid())
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Une demande d''annulation est déjà en attente pour cette vente';
end;
$annul_demande$;

create or replace function public.vente_annulation_decider(p_demande uuid,p_approuver boolean)
returns void
language plpgsql
security definer
set search_path=''
as $annul_decide$
declare v_demande public.vente_annulation_demandes%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into v_demande from public.vente_annulation_demandes where id=p_demande for update;
  if not found or v_demande.statut <> 'en_attente' then raise exception 'Demande introuvable ou déjà traitée'; end if;
  if not public.is_admin() and v_demande.demandee_par=auth.uid() then
    raise exception 'Le demandeur ne peut pas approuver sa propre annulation';
  end if;
  if not public.is_admin() and not exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.actif and p.role::text='promoteur' and p.niveau_interne=1
  ) then raise exception 'Décision réservée au Promoteur ou à NAXA'; end if;
  if not public.is_admin() and not public.can_access_pharmacy(v_demande.pharmacie_id) then raise exception 'Demande hors périmètre'; end if;
  update public.vente_annulation_demandes
  set statut=case when p_approuver then 'approuvee' else 'rejetee' end,
      decidee_par=auth.uid(), decidee_at=now()
  where id=v_demande.id;
end;
$annul_decide$;

create or replace function public.vente_annuler(p_vente uuid)
returns void
language plpgsql
security definer
set search_path=''
as $annul_exec$
declare
  v_vente public.ventes%rowtype;
  v_demande public.vente_annulation_demandes%rowtype;
  v_ligne record;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into v_vente from public.ventes where id=p_vente for update;
  if not found then raise exception 'Vente introuvable'; end if;
  if v_vente.statut <> 'payee' then raise exception 'Vente non annulable'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then raise exception 'Vente hors périmètre'; end if;
  select * into v_demande
  from public.vente_annulation_demandes
  where vente_id=p_vente and statut='approuvee'
  order by decidee_at desc limit 1 for update;
  if not found then raise exception 'Approbation d''annulation requise'; end if;

  for v_ligne in
    select id,produit_id,lot_id,quantite from public.vente_lignes where vente_id=p_vente for update
  loop
    if v_ligne.lot_id is not null then
      update public.stocks_lots
      set quantite=quantite+v_ligne.quantite
      where id=v_ligne.lot_id and pharmacie_id=v_vente.pharmacie_id and produit_id=v_ligne.produit_id;
      if not found then raise exception 'Lot de restitution introuvable'; end if;
    end if;
    update public.stocks
    set quantite=quantite+v_ligne.quantite
    where pharmacie_id=v_vente.pharmacie_id and produit_id=v_ligne.produit_id;
    if not found then raise exception 'Stock agrégé de restitution introuvable'; end if;
  end loop;

  update public.ventes set statut='annulee' where id=p_vente;
end;
$annul_exec$;

revoke all on function public.vente_annulation_demander(uuid,text) from public,anon,authenticated;
revoke all on function public.vente_annulation_decider(uuid,boolean) from public,anon,authenticated;
revoke all on function public.vente_annuler(uuid) from public,anon,authenticated;
grant execute on function public.vente_annulation_demander(uuid,text) to authenticated;
grant execute on function public.vente_annulation_decider(uuid,boolean) to authenticated;
grant execute on function public.vente_annuler(uuid) to authenticated;

create or replace function public.caisse_cloturer(p_session uuid,p_total_compte integer)
returns table(total_theorique integer,total_compte integer,ecart integer)
language plpgsql
security definer
set search_path=''
as $cloture$
declare
  v_session public.caisses_sessions%rowtype;
  v_theorique integer;
  v_cash integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_total_compte is null or p_total_compte < 0 then raise exception 'Comptage invalide'; end if;

  select cs.* into v_session
  from public.caisses_sessions cs
  join public.caisses c on c.id=cs.caisse_id
  where cs.id=p_session and (public.is_admin() or public.can_operate_pharmacy(c.pharmacie_id))
  for update;

  if not found then raise exception 'Session caisse introuvable ou hors périmètre'; end if;
  if v_session.statut <> 'ouverte' then raise exception 'Session déjà clôturée'; end if;
  if exists(select 1 from public.ventes v where v.caisse_session_id=p_session and v.statut='brouillon') then
    raise exception 'Impossible de clôturer : vente brouillon encore ouverte';
  end if;

  select coalesce(sum(
    case
      when vp.nb > 0 then vp.montant
      when vp.nb = 0 and v.mode_paiement='especes' then v.total_net
      else 0
    end
  ),0)
  into v_cash
  from public.ventes v
  left join lateral (
    select coalesce(sum(vp2.montant) filter (where vp2.mode='especes'),0) as montant,
           count(*) as nb
    from public.vente_paiements vp2
    where vp2.vente_id=v.id
  ) vp on true
  where v.caisse_session_id=p_session and v.statut='payee';

  v_theorique := v_session.fond_initial + coalesce(v_cash,0);

  update public.caisses_sessions
  set statut='cloturee',cloture_at=now(),cloture_par=auth.uid(),
      total_theorique=v_theorique,total_compte=p_total_compte,ecart=p_total_compte-v_theorique
  where id=p_session;

  return query select v_theorique,p_total_compte,p_total_compte-v_theorique;
end;
$cloture$;

revoke all on function public.caisse_cloturer(uuid,integer) from public,anon,authenticated;
grant execute on function public.caisse_cloturer(uuid,integer) to authenticated;

comment on table public.vente_annulation_demandes is
  'Workflow de contrôle des annulations POS : demande, décision Promoteur/NAXA, puis restitution atomique.';
comment on function public.caisse_cloturer(uuid,integer) is
  'Clôture Z : fond initial + encaissements espèces, comptage réel et écart.';
