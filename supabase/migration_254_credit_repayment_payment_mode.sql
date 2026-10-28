-- NAXA 254 — typer le moyen d'encaissement des remboursements de crédit.
-- Les remboursements électroniques restent désactivés tant qu'aucune confirmation opérateur officielle n'est intégrée.
-- Migration versionnée uniquement : ne pas appliquer à une base distante sans validation explicite.
begin;

alter table public.client_credit_operations
  add column if not exists mode_paiement public.mode_paiement_caisse;

comment on column public.client_credit_operations.mode_paiement is
  'Moyen d’encaissement structuré du remboursement. NULL signifie historique ou mode non établi; seuls les remboursements espèces alimentent le tiroir de caisse.';

-- Aucun backfill historique depuis motif : ce champ libre ne prouve pas le moyen de paiement.
-- Les remboursements historiques restent NULL jusqu’à réconciliation sur une preuve fiable.

create index if not exists client_credit_repayment_mode_session_idx
  on public.client_credit_operations(caisse_session_id,mode_paiement,created_at desc)
  where nature='remboursement' and caisse_session_id is not null;

-- Signature explicite : les nouveaux appels doivent déclarer le moyen d’encaissement.
create or replace function public.client_credit_rembourser(
  p_credit uuid,
  p_montant integer,
  p_mode public.mode_paiement_caisse,
  p_reference text default null,
  p_motif text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $refund$
declare
  v_credit public.client_credits%rowtype;
  v_session uuid;
  v_op uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_montant is null or p_montant<=0 then raise exception 'Montant invalide'; end if;
  if p_mode is distinct from 'especes'::public.mode_paiement_caisse then
    raise exception 'Seuls les remboursements en espèces sont disponibles; les paiements électroniques ne sont pas confirmés par un opérateur';
  end if;

  select * into v_credit
  from public.client_credits
  where id=p_credit
  for update;
  if not found then raise exception 'Crédit introuvable'; end if;
  if not v_credit.actif then raise exception 'Crédit inactif'; end if;
  if p_montant>v_credit.solde then raise exception 'Remboursement supérieur au solde'; end if;
  if not public.can_operate_pharmacy(v_credit.pharmacie_id) and not public.is_admin() then
    raise exception 'Pharmacie hors périmètre';
  end if;

  select s.id into v_session
  from public.caisses_sessions s
  join public.caisses c on c.id=s.caisse_id
  where c.pharmacie_id=v_credit.pharmacie_id
    and c.actif
    and s.statut='ouverte'
    and s.cloture_at is null
    and s.ouvert_par=auth.uid()
  order by s.ouvert_at desc
  limit 1
  for update of s;
  if v_session is null then
    raise exception 'Ouvrez votre session de caisse dans cette pharmacie avant d’enregistrer un remboursement';
  end if;

  update public.client_credits
  set solde=solde-p_montant,updated_at=now()
  where id=v_credit.id;

  insert into public.client_credit_operations(
    credit_id,pharmacie_id,client_id,nature,montant,reference,motif,created_by,caisse_session_id,mode_paiement
  ) values(
    v_credit.id,v_credit.pharmacie_id,v_credit.client_id,'remboursement',p_montant,
    nullif(trim(p_reference),''),nullif(trim(p_motif),''),auth.uid(),v_session,p_mode
  ) returning id into v_op;

  return v_op;
end;
$refund$;

revoke all on function public.client_credit_rembourser(uuid,integer,public.mode_paiement_caisse,text,text) from public,anon,authenticated;
grant execute on function public.client_credit_rembourser(uuid,integer,public.mode_paiement_caisse,text,text) to authenticated;

-- Compatibilité des appels historiques : ils sont explicitement traités comme espèces,
-- puisque l’ancienne signature ne permettait pas de transmettre un moyen distinct.
create or replace function public.client_credit_rembourser(
  p_credit uuid,
  p_montant integer,
  p_reference text default null,
  p_motif text default null
)
returns uuid
language sql
security definer
set search_path=''
as $legacy$
  select public.client_credit_rembourser(
    p_credit,p_montant,'especes'::public.mode_paiement_caisse,p_reference,p_motif
  );
$legacy$;

revoke all on function public.client_credit_rembourser(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.client_credit_rembourser(uuid,integer,text,text) to authenticated;

-- Le tiroir physique ne reçoit que les remboursements structurés en espèces.
create or replace function public.caisse_cloturer(p_session uuid,p_total_compte integer,p_ecart_justification text)
returns table(total_theorique integer,total_compte integer,ecart integer)
language plpgsql security definer set search_path=''
as $cloturer$
declare
 v_session public.caisses_sessions%rowtype;
 v_pharmacie uuid;
 v_theorique integer;
 v_cash integer;
 v_decaissements integer;
 v_credit_remboursements integer;
 v_ecart integer;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 if p_total_compte is null or p_total_compte<0 then raise exception 'Comptage invalide'; end if;
 if p_ecart_justification is not null and length(trim(p_ecart_justification)) not between 5 and 500 then raise exception 'La justification doit contenir entre 5 et 500 caractères'; end if;
 select cs.* into v_session from public.caisses_sessions cs join public.caisses c on c.id=cs.caisse_id
 where cs.id=p_session and (public.is_admin() or public.can_operate_pharmacy(c.pharmacie_id)) for update of cs;
 if not found then raise exception 'Session caisse introuvable ou hors périmètre'; end if;
 select c.pharmacie_id into v_pharmacie from public.caisses c where c.id=v_session.caisse_id;
 if not public.is_admin() then
  if v_session.ouvert_par is distinct from auth.uid() or not exists(
   select 1 from public.profiles p where p.id=auth.uid() and p.actif=true and p.pharmacie_id=v_pharmacie
    and (coalesce(p.role::text,'')='caisse' or coalesce(p.fonction_interne,'')='caisse')
  ) then raise exception 'Clôture réservée au titulaire actif de la session Caisse'; end if;
 end if;
 if v_session.statut<>'ouverte' then raise exception 'Session déjà clôturée'; end if;
 if exists(select 1 from public.ventes v where v.caisse_session_id=p_session and v.statut='brouillon') then raise exception 'Impossible de clôturer : vente brouillon encore ouverte'; end if;
 select coalesce(sum(case when vp.nb>0 then vp.montant when vp.nb=0 and v.mode_paiement='especes' then v.total_net else 0 end),0)
 into v_cash from public.ventes v left join lateral(
  select coalesce(sum(vp2.montant) filter(where vp2.mode='especes'),0) montant,count(*) nb
  from public.vente_paiements vp2 where vp2.vente_id=v.id
 ) vp on true where v.caisse_session_id=p_session and v.statut='payee';
 select coalesce(sum(d.montant),0)::integer into v_decaissements
 from public.caisse_decaissements d where d.caisse_session_id=p_session;
 select coalesce(sum(o.montant),0)::integer into v_credit_remboursements
 from public.client_credit_operations o
 where o.caisse_session_id=p_session and o.nature='remboursement'
   and o.mode_paiement='especes';
 v_theorique:=v_session.fond_initial+coalesce(v_cash,0)
   +coalesce(v_credit_remboursements,0)-coalesce(v_decaissements,0);
 if v_theorique<0 then raise exception 'Solde théorique négatif : vérifier les décaissements enregistrés'; end if;
 v_ecart:=p_total_compte-v_theorique;
 if v_ecart<>0 and (p_ecart_justification is null or length(trim(p_ecart_justification))<5) then
  raise exception 'Écart de % FCFA : une justification de 5 à 500 caractères est obligatoire avant la clôture',v_ecart;
 end if;
 update public.caisses_sessions set statut='cloturee',cloture_at=now(),cloture_par=auth.uid(),
  total_theorique=v_theorique,total_compte=p_total_compte,ecart=v_ecart,
  ecart_justification=nullif(trim(p_ecart_justification), ''),
  ecart_statut=case when v_ecart=0 then 'conforme' else 'a_verifier' end
 where id=p_session;
 return query select v_theorique,p_total_compte,v_ecart;
end;
$cloturer$;
revoke all on function public.caisse_cloturer(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.caisse_cloturer(uuid,integer,text) to authenticated;

create or replace function public.naxa_guard_caisse_session_write()
returns trigger
language plpgsql
security definer
set search_path=''
as $guard$
declare
 v_pharmacie uuid;
 v_cash integer;
 v_decaissements integer;
 v_credit_remboursements integer;
 v_theorique integer;
begin
 if auth.uid() is null or public.is_admin() then return new; end if;
 select c.pharmacie_id into v_pharmacie from public.caisses c where c.id=new.caisse_id;
 if not public.naxa_caisse_actor_for_pharmacy(v_pharmacie) then
  raise exception 'Session réservée à une Caisse active de cette pharmacie';
 end if;
 if tg_op='INSERT' then
  if new.ouvert_par is distinct from auth.uid()
     or not exists(select 1 from public.caisses c where c.id=new.caisse_id and c.actif=true) then
   raise exception 'Ouverture réservée à la Caisse active qui la demande';
  end if;
 elsif tg_op='UPDATE' then
  if new.caisse_id is distinct from old.caisse_id
     or new.ouvert_par is distinct from old.ouvert_par
     or new.fond_initial is distinct from old.fond_initial
     or new.ouvert_at is distinct from old.ouvert_at then
   raise exception 'Les paramètres d’ouverture de session sont immuables';
  end if;
  if old.statut<>'ouverte' or new.statut<>'cloturee' then
   raise exception 'Une session ouverte ne peut être modifiée que par une clôture contrôlée';
  end if;
  if old.ouvert_par is distinct from auth.uid()
     or new.cloture_par is distinct from auth.uid()
     or new.cloture_at is null or new.total_compte is null then
   raise exception 'Seul l’ouvreur de la session peut enregistrer la clôture';
  end if;
  select coalesce(sum(case when pay.nb>0 then pay.cash
    when pay.nb=0 and v.mode_paiement='especes' then v.total_net else 0 end),0)::integer
   into v_cash
  from public.ventes v
  left join lateral (
   select coalesce(sum(vp.montant) filter(where vp.mode='especes'),0)::integer as cash,
          count(*) as nb
   from public.vente_paiements vp where vp.vente_id=v.id
  ) pay on true
  where v.caisse_session_id=old.id and v.statut='payee';
  select coalesce(sum(d.montant),0)::integer into v_decaissements
  from public.caisse_decaissements d where d.caisse_session_id=old.id;
  select coalesce(sum(o.montant),0)::integer into v_credit_remboursements
  from public.client_credit_operations o
  where o.caisse_session_id=old.id and o.nature='remboursement'
    and o.mode_paiement='especes';
  v_theorique:=old.fond_initial+coalesce(v_cash,0)
    +coalesce(v_credit_remboursements,0)-coalesce(v_decaissements,0);
  if new.total_theorique is distinct from v_theorique
     or new.ecart is distinct from (new.total_compte-v_theorique) then
   raise exception 'Le rapprochement de clôture ne correspond pas aux paiements, remboursements espèces et décaissements enregistrés';
  end if;
 end if;
 return new;
end;
$guard$;

commit;
