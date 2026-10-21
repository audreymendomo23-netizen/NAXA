-- NAXA Comptable — étape 3 (socle outbox métier).
-- Additif uniquement. À appliquer/tester sur une base de test avant toute base active.
begin;

alter table public.compta_evenement
  add column if not exists claim_token uuid,
  add column if not exists verrouille_jusqua timestamptz;

alter table public.compta_evenement
  drop constraint if exists compta_evenement_statut_check;
alter table public.compta_evenement
  add constraint compta_evenement_statut_check
  check (statut in ('a_traiter','en_cours','traite','erreur'));

create index if not exists compta_evenement_claim_idx
  on public.compta_evenement(statut,prochaine_tentative,verrouille_jusqua,created_at);

-- Émet seulement des événements métier validés. Aucun nom, patient_id, ligne de vente,
-- prescription ou autre donnée clinique/personnelle n'est placé dans l'outbox.
create or replace function public.compta_emettre_evenement_metier()
returns trigger
language plpgsql
security definer
set search_path=''
as $outbox$
declare
  v_type text;
  v_source text;
  v_date timestamptz;
  v_date_comptable date;
  v_montant bigint;
  v_ref text;
begin
  if tg_table_name='ventes' then
    if new.statut::text <> 'payee' or old.statut::text = 'payee' then
      return new;
    end if;
    v_type := 'vente_encaissee';
    v_source := 'vente';
    v_date := coalesce(new.paid_at,new.created_at,clock_timestamp());
    v_date_comptable := (timezone('Africa/Douala',coalesce(new.paid_at,new.created_at,clock_timestamp())))::date;
    v_montant := new.total_net::bigint;
    v_ref := new.id::text;
  elsif tg_table_name='depenses' then
    if new.statut::text <> 'validee' or old.statut::text = 'validee' then
      return new;
    end if;
    v_type := 'depense_validee';
    v_source := 'depense';
    v_date := coalesce(new.validated_at,new.created_at,clock_timestamp());
    v_date_comptable := new.date_depense;
    v_montant := new.montant::bigint;
    v_ref := coalesce(nullif(trim(new.reference),''),new.id::text);
  else
    raise exception 'Source d''événement comptable non prise en charge';
  end if;

  -- Les montants nuls ne créent pas d'écriture comptable. Les sources restent intactes.
  if v_montant is null or v_montant <= 0 then
    return new;
  end if;

  insert into public.compta_evenement(
    pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,
    date_evenement,donnees
  )
  values(
    new.pharmacie_id,v_type,v_source,new.id::text,
    v_source || ':' || new.id::text || ':' || v_type,
    v_date,
    jsonb_build_object(
      'montant_fcfa',v_montant::text,
      'date_comptable',v_date_comptable::text,
      'reference_source',v_ref
    )
  )
  on conflict (pharmacie_id,cle_idempotence) do nothing;

  return new;
end;
$outbox$;

revoke all on function public.compta_emettre_evenement_metier() from public,anon,authenticated;

drop trigger if exists compta_outbox_vente_encaissee on public.ventes;
create trigger compta_outbox_vente_encaissee
after update of statut on public.ventes
for each row
when (old.statut::text is distinct from new.statut::text)
execute function public.compta_emettre_evenement_metier();

drop trigger if exists compta_outbox_depense_validee on public.depenses;
create trigger compta_outbox_depense_validee
after update of statut on public.depenses
for each row
when (old.statut::text is distinct from new.statut::text)
execute function public.compta_emettre_evenement_metier();

-- Réclamation avec verrouillage à bail et SKIP LOCKED : deux workers ne prennent pas
-- le même événement simultanément. Le jeton protège la finalisation contre un worker périmé.
create or replace function public.compta_evenements_reclamer(p_limite integer default 50)
returns table(
  event_id uuid,
  pharmacie_id uuid,
  evenement_type text,
  source_type text,
  source_id text,
  cle_idempotence text,
  date_evenement timestamptz,
  donnees jsonb,
  tentatives integer,
  claim_token uuid
)
language plpgsql
security definer
set search_path=''
as $claim$
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Worker comptable réservé au service role';
  end if;

  return query
  with candidats as (
    select e.id
    from public.compta_evenement e
    where (
      (e.statut='a_traiter' and (e.prochaine_tentative is null or e.prochaine_tentative<=now()))
      or (e.statut='en_cours' and e.verrouille_jusqua<=now())
    )
    order by e.created_at,e.id
    for update skip locked
    limit greatest(1,least(coalesce(p_limite,50),100))
  )
  update public.compta_evenement e
    set statut='en_cours',
        tentatives=e.tentatives+1,
        claim_token=gen_random_uuid(),
        verrouille_jusqua=now()+interval '5 minutes',
        code_erreur=null
  from candidats c
  where e.id=c.id
  returning e.id,e.pharmacie_id,e.evenement_type,e.source_type,e.source_id,
    e.cle_idempotence,e.date_evenement,e.donnees,e.tentatives,e.claim_token;
end;
$claim$;

create or replace function public.compta_evenement_terminer(
  p_evenement uuid,
  p_claim_token uuid,
  p_succes boolean,
  p_code_erreur text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $finish$
declare
  v_count integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Worker comptable réservé au service role';
  end if;
  if p_evenement is null or p_claim_token is null or p_succes is null then
    raise exception 'Résultat de traitement incomplet';
  end if;
  if p_succes and not exists (
    select 1
    from public.compta_evenement ev
    join public.compta_ecriture ce
      on ce.pharmacie_id=ev.pharmacie_id
     and ce.source_type=ev.source_type
     and ce.source_id=ev.source_id
     and ce.cle_idempotence=ev.cle_idempotence
    where ev.id=p_evenement
  ) then
    raise exception 'Impossible de marquer traité sans écriture comptable correspondante';
  end if;

  update public.compta_evenement e
  set statut=case
        when p_succes then 'traite'
        when e.tentatives>=8 then 'erreur'
        else 'a_traiter'
      end,
      traite_le=case when p_succes then now() else null end,
      prochaine_tentative=case
        when p_succes or e.tentatives>=8 then null
        else now()+interval '15 minutes'
      end,
      code_erreur=case when p_succes then null else
        left(regexp_replace(coalesce(nullif(trim(p_code_erreur),''),'traitement_echoue'),
          '[^A-Za-z0-9_.:-]','_','g'),80) end,
      claim_token=null,
      verrouille_jusqua=null
  where e.id=p_evenement and e.claim_token=p_claim_token and e.statut='en_cours';
  get diagnostics v_count = row_count;
  if v_count=0 then
    raise exception 'Événement absent, déjà finalisé ou jeton de réclamation expiré';
  end if;
end;
$finish$;

revoke all on function public.compta_evenements_reclamer(integer) from public,anon,authenticated;
revoke all on function public.compta_evenement_terminer(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.compta_evenements_reclamer(integer) to service_role;
grant execute on function public.compta_evenement_terminer(uuid,uuid,boolean,text) to service_role;

commit;
