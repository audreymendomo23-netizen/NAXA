-- NAXA 248 — Remboursements de crédit rattachés à une session de caisse ouverte.
-- Code versionné uniquement : ne pas appliquer à une base distante sans validation explicite.
begin;

alter table public.client_credit_operations
  add column if not exists caisse_session_id uuid
  references public.caisses_sessions(id) on delete restrict;

create index if not exists client_credit_operations_cash_session_idx
  on public.client_credit_operations(caisse_session_id, created_at desc)
  where caisse_session_id is not null;

create or replace function public.client_credit_rembourser(
  p_credit uuid,
  p_montant integer,
  p_reference text default null,
  p_motif text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_credit public.client_credits%rowtype;
  v_session uuid;
  v_op uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Montant invalide'; end if;

  select * into v_credit
  from public.client_credits
  where id=p_credit
  for update;

  if not found then raise exception 'Crédit introuvable'; end if;
  if not v_credit.actif then raise exception 'Crédit inactif'; end if;
  if p_montant > v_credit.solde then raise exception 'Remboursement supérieur au solde'; end if;
  if not public.can_operate_pharmacy(v_credit.pharmacie_id) and not public.is_admin() then
    raise exception 'Pharmacie hors périmètre';
  end if;

  -- Un remboursement est un encaissement en caisse : il exige la session ouverte
  -- du caissier connecté, dans la pharmacie du crédit.
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
    set solde=solde-p_montant, updated_at=now()
  where id=v_credit.id;

  insert into public.client_credit_operations(
    credit_id,pharmacie_id,client_id,nature,montant,reference,motif,created_by,caisse_session_id
  ) values(
    v_credit.id,v_credit.pharmacie_id,v_credit.client_id,'remboursement',p_montant,
    nullif(trim(p_reference),''),nullif(trim(p_motif),''),auth.uid(),v_session
  ) returning id into v_op;

  return v_op;
end
$$;

revoke all on function public.client_credit_rembourser(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.client_credit_rembourser(uuid,integer,text,text) to authenticated;

comment on column public.client_credit_operations.caisse_session_id is
  'Session de caisse ouverte ayant enregistré le remboursement ; NULL pour les anciennes opérations ou les opérations hors caisse.';

commit;
