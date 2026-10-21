-- NAXA Comptable — étape 8 : contrôles de clôture et clôture atomique.
-- Les domaines absents du schéma métier doivent être attestés explicitement ou bloquent la clôture.
begin;

create table if not exists public.compta_controles_cloture (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  periode_id uuid not null,
  controle_code text not null check (controle_code in (
    'dotations','paie','tva','stock','rapprochements','regularisations','a_nouveaux'
  )),
  statut text not null default 'a_controler' check (statut in ('a_controler','valide','non_applicable')),
  reference_preuve text,
  motif text,
  controle_par uuid references public.profiles(id) on delete restrict,
  controle_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (periode_id, pharmacie_id)
    references public.compta_periodes(id, pharmacie_id) on delete restrict,
  unique (pharmacie_id, periode_id, controle_code),
  check (
    (statut = 'a_controler' and controle_par is null and controle_le is null)
    or (statut = 'valide' and controle_par is not null and controle_le is not null
        and nullif(trim(reference_preuve), '') is not null)
    or (statut = 'non_applicable' and controle_par is not null and controle_le is not null
        and nullif(trim(motif), '') is not null)
  )
);

create index if not exists compta_controles_cloture_lookup_idx
  on public.compta_controles_cloture(pharmacie_id, periode_id, controle_code, statut);

alter table public.compta_controles_cloture enable row level security;
revoke all on public.compta_controles_cloture from anon, authenticated;
grant select on public.compta_controles_cloture to authenticated;
grant select, insert, update, delete on public.compta_controles_cloture to service_role;
drop policy if exists compta_controles_cloture_read on public.compta_controles_cloture;
create policy compta_controles_cloture_read
  on public.compta_controles_cloture for select to authenticated
  using (public.compta_scope_autorise(pharmacie_id));

create or replace function public.compta_cloturer_periode(
  p_pharmacie uuid,
  p_periode uuid,
  p_acteur uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $compta_cloture$
declare
  v_periode public.compta_periodes%rowtype;
  v_required text[];
  v_missing text[];
  v_pending bigint;
  v_unbalanced bigint;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Clôture comptable réservée au service serveur' using errcode = '42501';
  end if;
  if p_pharmacie is null or p_periode is null or p_acteur is null then
    raise exception 'Pharmacie, période et acteur obligatoires';
  end if;

  select * into v_periode
  from public.compta_periodes
  where id = p_periode and pharmacie_id = p_pharmacie
  for update;

  if not found then
    raise exception 'Période comptable introuvable dans cette pharmacie';
  end if;
  if v_periode.statut <> 'ouverte' then
    raise exception 'La période est déjà clôturée';
  end if;

  v_required := array['dotations','paie','tva','stock','rapprochements'];
  if v_periode.date_fin = (date_trunc('year', v_periode.date_fin::timestamp) + interval '1 year - 1 day')::date then
    v_required := v_required || array['regularisations','a_nouveaux'];
  end if;

  select array_agg(required.code order by required.code) into v_missing
  from unnest(v_required) as required(code)
  left join public.compta_controles_cloture c
    on c.pharmacie_id = p_pharmacie
   and c.periode_id = p_periode
   and c.controle_code = required.code
  where c.id is null
     or c.statut = 'a_controler'
     or (c.statut = 'valide' and nullif(trim(c.reference_preuve), '') is null)
     or (c.statut = 'non_applicable' and nullif(trim(c.motif), '') is null);

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'Clôture refusée : contrôles manquants ou non documentés : %', array_to_string(v_missing, ', ');
  end if;

  select count(*) into v_pending
  from public.compta_evenement e
  where e.pharmacie_id = p_pharmacie
    and e.date_evenement >= v_periode.date_debut::timestamptz
    and e.date_evenement < (v_periode.date_fin + 1)::timestamptz
    and e.statut <> 'traite';

  if v_pending > 0 then
    raise exception 'Clôture refusée : % événement(s) comptable(s) restent à traiter ou en erreur', v_pending;
  end if;

  select count(*) into v_unbalanced
  from (
    select e.id
    from public.compta_ecriture e
    left join public.compta_ligne l on l.ecriture_id = e.id and l.pharmacie_id = e.pharmacie_id
    where e.pharmacie_id = p_pharmacie
      and e.date_ecriture between v_periode.date_debut and v_periode.date_fin
    group by e.id
    having count(l.id) < 2
       or coalesce(sum(l.debit_fcfa), 0) <= 0
       or coalesce(sum(l.debit_fcfa), 0) <> coalesce(sum(l.credit_fcfa), 0)
  ) invalid_entries;

  if v_unbalanced > 0 then
    raise exception 'Clôture refusée : % écriture(s) déséquilibrée(s)', v_unbalanced;
  end if;

  if not public.compta_verifier_audit(p_pharmacie) then
    raise exception 'Clôture refusée : chaîne du journal d’audit invalide';
  end if;

  update public.compta_periodes
  set statut = 'cloturee', cloturee_par = p_acteur, cloturee_le = clock_timestamp()
  where id = p_periode and pharmacie_id = p_pharmacie and statut = 'ouverte';

  if not found then
    raise exception 'La période a changé pendant la clôture';
  end if;

  perform public.compta_auditer(
    p_pharmacie, p_acteur, 'periode_comptable_cloturee',
    'periode', p_periode::text, 'succes',
    'controles=' || array_to_string(v_required, ',')
  );

  return jsonb_build_object(
    'periode_id', p_periode,
    'statut', 'cloturee',
    'cloturee_le', (select p.cloturee_le from public.compta_periodes p where p.id = p_periode),
    'controles_verifies', to_jsonb(v_required),
    'cloture_annuelle', v_periode.date_fin = (date_trunc('year', v_periode.date_fin::timestamp) + interval '1 year - 1 day')::date
  );
end;
$compta_cloture$;

revoke all on function public.compta_cloturer_periode(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.compta_cloturer_periode(uuid, uuid, uuid) to service_role;

commit;
