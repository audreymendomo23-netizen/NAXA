-- NAXA Comptable — socle comptable additif, sans données de démonstration.
-- Les écritures sont produites exclusivement par le serveur via les RPC autorisées.
begin;

create table if not exists public.compta_periodes (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  date_debut date not null,
  date_fin date not null,
  statut text not null default 'ouverte' check (statut in ('ouverte','cloturee')),
  cloturee_par uuid references public.profiles(id) on delete restrict,
  cloturee_le timestamptz,
  created_at timestamptz not null default now(),
  check (date_debut <= date_fin),
  check ((statut='ouverte' and cloturee_par is null and cloturee_le is null)
      or (statut='cloturee' and cloturee_par is not null and cloturee_le is not null)),
  unique (pharmacie_id,date_debut,date_fin),
  unique (id,pharmacie_id)
);

-- Paramètres datés, sans taux, seuil ou valeur fiscale par défaut.
create table if not exists public.compta_parametre (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  cle text not null check (length(trim(cle)) between 2 and 120),
  valeur jsonb,
  statut text not null default 'a_renseigner' check (statut in ('a_renseigner','a_valider','valide','inactif')),
  valide_du date,
  valide_jusquau date,
  valide_par uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valide_jusquau is null or valide_du is null or valide_jusquau >= valide_du),
  check (statut <> 'valide' or (valeur is not null and valide_du is not null and valide_par is not null)),
  unique (pharmacie_id,cle,valide_du)
);

-- Plan et mappings restent vides tant qu'ils n'ont pas été renseignés/validés.
create table if not exists public.compta_plan_comptable (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  code text not null check (length(trim(code)) between 1 and 32),
  libelle text not null check (length(trim(libelle)) between 2 and 180),
  classe smallint check (classe between 1 and 9),
  statut text not null default 'a_valider' check (statut in ('a_valider','valide','inactif')),
  source_validation text,
  valide_par uuid references public.profiles(id) on delete restrict,
  valide_le timestamptz,
  created_at timestamptz not null default now(),
  unique (pharmacie_id,code),
  unique (id,pharmacie_id),
  check (statut <> 'valide' or (valide_par is not null and valide_le is not null))
);

create table if not exists public.compta_mapping_compte (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  evenement_type text not null check (length(trim(evenement_type)) between 2 and 100),
  sens text not null check (sens in ('debit','credit')),
  compte_id uuid,
  statut text not null default 'a_valider' check (statut in ('a_valider','valide','inactif')),
  valide_du date,
  valide_jusquau date,
  valide_par uuid references public.profiles(id) on delete restrict,
  valide_le timestamptz,
  created_at timestamptz not null default now(),
  foreign key (compte_id,pharmacie_id)
    references public.compta_plan_comptable(id,pharmacie_id) on delete restrict,
  check (valide_jusquau is null or valide_du is null or valide_jusquau >= valide_du),
  check (statut <> 'valide' or (compte_id is not null and valide_par is not null and valide_le is not null))
);
create index if not exists compta_mapping_lookup_idx
  on public.compta_mapping_compte(pharmacie_id,evenement_type,sens,statut,valide_du);

create table if not exists public.compta_evenement (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  evenement_type text not null check (length(trim(evenement_type)) between 2 and 100),
  source_type text not null check (length(trim(source_type)) between 2 and 80),
  source_id text not null check (length(trim(source_id)) between 1 and 160),
  cle_idempotence text not null check (length(trim(cle_idempotence)) between 8 and 240),
  date_evenement timestamptz not null,
  donnees jsonb not null default '{}'::jsonb,
  statut text not null default 'a_traiter' check (statut in ('a_traiter','traite','erreur')),
  tentatives integer not null default 0 check (tentatives >= 0),
  prochaine_tentative timestamptz,
  code_erreur text,
  traite_le timestamptz,
  created_at timestamptz not null default now(),
  unique (pharmacie_id,cle_idempotence),
  check ((statut='traite' and traite_le is not null) or statut <> 'traite')
);
create index if not exists compta_evenement_queue_idx
  on public.compta_evenement(statut,prochaine_tentative,created_at);
create index if not exists compta_evenement_scope_idx
  on public.compta_evenement(pharmacie_id,date_evenement desc);

create table if not exists public.compta_ecriture (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  periode_id uuid not null,
  journal_code text not null check (length(trim(journal_code)) between 1 and 20),
  date_ecriture date not null,
  reference_source text,
  source_type text not null,
  source_id text not null,
  cle_idempotence text not null,
  libelle text not null check (length(trim(libelle)) between 2 and 240),
  contrepassation_de uuid,
  cree_par uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (periode_id,pharmacie_id)
    references public.compta_periodes(id,pharmacie_id) on delete restrict,
  foreign key (contrepassation_de,pharmacie_id)
    references public.compta_ecriture(id,pharmacie_id) on delete restrict,
  unique (pharmacie_id,cle_idempotence),
  unique (id,pharmacie_id)
);
create index if not exists compta_ecriture_date_idx
  on public.compta_ecriture(pharmacie_id,date_ecriture desc);
create index if not exists compta_ecriture_source_idx
  on public.compta_ecriture(pharmacie_id,source_type,source_id);

create table if not exists public.compta_ligne (
  id uuid primary key default gen_random_uuid(),
  ecriture_id uuid not null,
  pharmacie_id uuid not null,
  compte_id uuid not null,
  libelle text not null check (length(trim(libelle)) between 2 and 240),
  debit_fcfa bigint not null default 0 check (debit_fcfa >= 0),
  credit_fcfa bigint not null default 0 check (credit_fcfa >= 0),
  created_at timestamptz not null default now(),
  foreign key (ecriture_id,pharmacie_id)
    references public.compta_ecriture(id,pharmacie_id) on delete restrict,
  foreign key (compte_id,pharmacie_id)
    references public.compta_plan_comptable(id,pharmacie_id) on delete restrict,
  check ((debit_fcfa > 0 and credit_fcfa = 0) or (credit_fcfa > 0 and debit_fcfa = 0))
);
create index if not exists compta_ligne_ecriture_idx on public.compta_ligne(ecriture_id);
create index if not exists compta_ligne_compte_idx on public.compta_ligne(pharmacie_id,compte_id);

create table if not exists public.compta_audit_tete (
  pharmacie_id uuid primary key references public.pharmacies(id) on delete restrict,
  derniere_sequence bigint not null default 0 check (derniere_sequence >= 0),
  dernier_hash text not null default repeat('0',64) check (dernier_hash ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now()
);
create table if not exists public.compta_audit (
  id bigint generated always as identity primary key,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  sequence_no bigint not null check (sequence_no > 0),
  acteur_id uuid references public.profiles(id) on delete restrict,
  action text not null,
  objet_type text not null,
  objet_id text,
  resultat text not null check (resultat in ('succes','refus','erreur')),
  motif text,
  horodatage timestamptz not null default now(),
  previous_hash text not null check (previous_hash ~ '^[0-9a-f]{64}$'),
  hash_payload jsonb not null,
  event_hash text not null check (event_hash ~ '^[0-9a-f]{64}$'),
  unique (pharmacie_id,sequence_no)
);
create index if not exists compta_audit_scope_idx
  on public.compta_audit(pharmacie_id,horodatage desc);

-- Le périmètre est vérifié à nouveau côté serveur/RLS ; le code de privilège
-- MANAGE_ACCOUNTING ne confère jamais les droits de vente, de caisse ou d'approbation.
create or replace function public.compta_scope_autorise(p_pharmacie uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null
    and public.naxa_business_function(auth.uid())='comptable'
    and public.naxa_scope_allows(auth.uid(),p_pharmacie,'PHARMACIE')
    and public.naxa_can('MANAGE_ACCOUNTING',p_pharmacie,null)
$$;
revoke all on function public.compta_scope_autorise(uuid) from public,anon;
grant execute on function public.compta_scope_autorise(uuid) to authenticated;

create or replace function public.compta_refuser_modification_ecriture()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  raise exception 'Écriture comptable immuable : créer une contre-passation';
end;
$$;

drop trigger if exists compta_ecriture_immutable on public.compta_ecriture;
create trigger compta_ecriture_immutable before update or delete on public.compta_ecriture
for each row execute function public.compta_refuser_modification_ecriture();
drop trigger if exists compta_ligne_immutable on public.compta_ligne;
create trigger compta_ligne_immutable before update or delete on public.compta_ligne
for each row execute function public.compta_refuser_modification_ecriture();

create or replace function public.compta_verifier_periode_ouverte()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if not exists (
    select 1 from public.compta_periodes p
    where p.id=new.periode_id and p.pharmacie_id=new.pharmacie_id
      and p.statut='ouverte' and new.date_ecriture between p.date_debut and p.date_fin
  ) then
    raise exception 'Période comptable absente, clôturée ou hors dates';
  end if;
  return new;
end;
$$;
drop trigger if exists compta_ecriture_periode_ouverte on public.compta_ecriture;
create trigger compta_ecriture_periode_ouverte before insert on public.compta_ecriture
for each row execute function public.compta_verifier_periode_ouverte();

create or replace function public.compta_verifier_partie_double()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_ecriture uuid;
  v_debit numeric;
  v_credit numeric;
  v_lignes bigint;
begin
  v_ecriture := case when tg_table_name='compta_ecriture' then new.id else coalesce(new.ecriture_id,old.ecriture_id) end;
  select count(*),coalesce(sum(l.debit_fcfa),0),coalesce(sum(l.credit_fcfa),0)
    into v_lignes,v_debit,v_credit
  from public.compta_ligne l where l.ecriture_id=v_ecriture;
  if v_lignes < 2 or v_debit <= 0 or v_debit <> v_credit then
    raise exception 'Écriture déséquilibrée : débits %, crédits %, lignes %',v_debit,v_credit,v_lignes;
  end if;
  return null;
end;
$$;
drop trigger if exists compta_ecriture_balance_deferred on public.compta_ecriture;
create constraint trigger compta_ecriture_balance_deferred
after insert on public.compta_ecriture deferrable initially deferred
for each row execute function public.compta_verifier_partie_double();
drop trigger if exists compta_ligne_balance_deferred on public.compta_ligne;
create constraint trigger compta_ligne_balance_deferred
after insert on public.compta_ligne deferrable initially deferred
for each row execute function public.compta_verifier_partie_double();

create or replace function public.compta_auditer(
  p_pharmacie uuid,p_acteur uuid,p_action text,p_objet_type text,
  p_objet_id text,p_resultat text,p_motif text default null
) returns bigint
language plpgsql security definer set search_path=''
as $$
declare
  v_seq bigint;
  v_prev text;
  v_id bigint;
  v_payload jsonb;
  v_hash text;
begin
  if p_pharmacie is null or p_action is null or p_objet_type is null
     or p_resultat not in ('succes','refus','erreur') then
    raise exception 'Événement d’audit incomplet';
  end if;
  insert into public.compta_audit_tete(pharmacie_id) values(p_pharmacie)
    on conflict (pharmacie_id) do nothing;
  select derniere_sequence,dernier_hash into v_seq,v_prev
    from public.compta_audit_tete where pharmacie_id=p_pharmacie for update;
  v_seq := v_seq + 1;
  v_payload := jsonb_build_object(
    'pharmacie_id',p_pharmacie,'sequence_no',v_seq,'acteur_id',p_acteur,
    'action',p_action,'objet_type',p_objet_type,'objet_id',p_objet_id,
    'resultat',p_resultat,'motif',p_motif,'horodatage',clock_timestamp()
  );
  v_hash := encode(extensions.digest(convert_to(v_prev || v_payload::text,'UTF8'),'sha256'),'hex');
  insert into public.compta_audit(
    pharmacie_id,sequence_no,acteur_id,action,objet_type,objet_id,resultat,motif,
    previous_hash,hash_payload,event_hash
  ) values (
    p_pharmacie,v_seq,p_acteur,p_action,p_objet_type,p_objet_id,p_resultat,p_motif,
    v_prev,v_payload,v_hash
  ) returning id into v_id;
  update public.compta_audit_tete
    set derniere_sequence=v_seq,dernier_hash=v_hash,updated_at=now()
    where pharmacie_id=p_pharmacie;
  return v_id;
end;
$$;
revoke all on function public.compta_auditer(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.compta_auditer(uuid,uuid,text,text,text,text,text) to service_role;

create or replace function public.compta_verifier_audit(p_pharmacie uuid)
returns boolean
language plpgsql stable security definer set search_path=''
as $$
declare
  v_bad boolean;
  v_count bigint;
  v_max bigint;
  v_head public.compta_audit_tete%rowtype;
begin
  if auth.uid() is not null and not public.compta_scope_autorise(p_pharmacie) then
    raise exception 'Accès au journal d’audit refusé';
  end if;
  select count(*),coalesce(max(sequence_no),0) into v_count,v_max
    from public.compta_audit where pharmacie_id=p_pharmacie;
  select * into v_head from public.compta_audit_tete where pharmacie_id=p_pharmacie;
  if v_count=0 then
    return not found or (v_head.derniere_sequence=0 and v_head.dernier_hash=repeat('0',64));
  end if;
  if not found or v_head.derniere_sequence<>v_max or v_count<>v_max then return false; end if;
  select exists (
    select 1 from (
      select a.*,
        lag(a.event_hash) over(order by a.sequence_no) as prev_hash,
        row_number() over(order by a.sequence_no) as expected_seq,
        encode(extensions.digest(convert_to(a.previous_hash || a.hash_payload::text,'UTF8'),'sha256'),'hex') as recomputed
      from public.compta_audit a where a.pharmacie_id=p_pharmacie
    ) c
    where c.sequence_no<>c.expected_seq
       or c.previous_hash<>coalesce(c.prev_hash,repeat('0',64))
       or c.event_hash<>c.recomputed
  ) into v_bad;
  if v_bad then return false; end if;
  return v_head.dernier_hash = (
    select a.event_hash from public.compta_audit a
    where a.pharmacie_id=p_pharmacie order by a.sequence_no desc limit 1
  );
end;
$$;
revoke all on function public.compta_verifier_audit(uuid) from public,anon;
grant execute on function public.compta_verifier_audit(uuid) to authenticated,service_role;

-- Pas d'accès direct en écriture depuis le client. Les RPC de production seront
-- appelées côté serveur avec le rôle service_role, jamais avec la clé côté navigateur.
do $rls$
declare t text;
begin
  foreach t in array array[
    'compta_periodes','compta_parametre','compta_plan_comptable',
    'compta_mapping_compte','compta_evenement','compta_ecriture',
    'compta_ligne','compta_audit_tete','compta_audit'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
  end loop;
end;
$rls$;

drop policy if exists compta_periodes_read on public.compta_periodes;
create policy compta_periodes_read on public.compta_periodes for select to authenticated
using (public.compta_scope_autorise(pharmacie_id));
drop policy if exists compta_parametre_read on public.compta_parametre;
create policy compta_parametre_read on public.compta_parametre for select to authenticated
using (public.compta_scope_autorise(pharmacie_id));
drop policy if exists compta_plan_read on public.compta_plan_comptable;
create policy compta_plan_read on public.compta_plan_comptable for select to authenticated
using (public.compta_scope_autorise(pharmacie_id));
drop policy if exists compta_mapping_read on public.compta_mapping_compte;
create policy compta_mapping_read on public.compta_mapping_compte for select to authenticated
using (public.compta_scope_autorise(pharmacie_id));
drop policy if exists compta_evenement_read on public.compta_evenement;
create policy compta_evenement_read on public.compta_evenement for select to authenticated
using (public.compta_scope_autorise(pharmacie_id));
drop policy if exists compta_ecriture_read on public.compta_ecriture;
create policy compta_ecriture_read on public.compta_ecriture for select to authenticated
using (public.compta_scope_autorise(pharmacie_id));
drop policy if exists compta_ligne_read on public.compta_ligne;
create policy compta_ligne_read on public.compta_ligne for select to authenticated
using (public.compta_scope_autorise(pharmacie_id));
drop policy if exists compta_audit_read on public.compta_audit;
create policy compta_audit_read on public.compta_audit for select to authenticated
using (public.compta_scope_autorise(pharmacie_id));
-- La tête de chaîne n'est jamais directement lisible depuis le client.
revoke all on public.compta_audit_tete from anon,authenticated;

grant select on public.compta_periodes,public.compta_parametre,
  public.compta_plan_comptable,public.compta_mapping_compte,
  public.compta_evenement,public.compta_ecriture,public.compta_ligne,
  public.compta_audit to authenticated;

-- Accès serveur pour le worker outbox et les RPC backend uniquement.
grant select,insert,update,delete on public.compta_periodes,public.compta_parametre,
  public.compta_plan_comptable,public.compta_mapping_compte,
  public.compta_evenement,public.compta_ecriture,public.compta_ligne,
  public.compta_audit_tete,public.compta_audit to service_role;
grant usage,select on sequence public.compta_audit_id_seq to service_role;


-- Les écritures ne peuvent être créées que par le serveur avec le rôle service_role.
-- La clé service_role ne doit jamais être exposée au navigateur.
create or replace function public.compta_poster_ecriture(
  p_pharmacie uuid,
  p_periode uuid,
  p_date date,
  p_journal text,
  p_source_type text,
  p_source_id text,
  p_cle_idempotence text,
  p_libelle text,
  p_lignes jsonb,
  p_acteur uuid default null
) returns uuid
language plpgsql security definer set search_path=''
as $
declare
  v_existing uuid;
  v_ecriture uuid := gen_random_uuid();
  v_ligne jsonb;
  v_compte uuid;
  v_debit bigint;
  v_credit bigint;
  v_libelle_ligne text;
  v_count integer := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' then
    raise exception 'Écriture comptable réservée au service serveur';
  end if;
  if p_pharmacie is null or p_periode is null or p_date is null
     or p_journal is null or length(trim(p_journal))=0
     or p_source_type is null or p_source_id is null
     or p_cle_idempotence is null or length(trim(p_cle_idempotence))<8
     or p_libelle is null or length(trim(p_libelle))<2
     or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes)<2 then
    raise exception 'Paramètres de comptabilisation incomplets';
  end if;

  select e.id into v_existing from public.compta_ecriture e
  where e.pharmacie_id=p_pharmacie and e.cle_idempotence=p_cle_idempotence;
  if found then return v_existing; end if;

  insert into public.compta_ecriture(
    id,pharmacie_id,periode_id,journal_code,date_ecriture,
    source_type,source_id,cle_idempotence,libelle,cree_par
  ) values (
    v_ecriture,p_pharmacie,p_periode,trim(p_journal),p_date,
    trim(p_source_type),trim(p_source_id),trim(p_cle_idempotence),trim(p_libelle),p_acteur
  );

  for v_ligne in select value from jsonb_array_elements(p_lignes)
  loop
    begin
      v_compte := (v_ligne->>'compte_id')::uuid;
      v_debit := coalesce((v_ligne->>'debit_fcfa')::bigint,0);
      v_credit := coalesce((v_ligne->>'credit_fcfa')::bigint,0);
      v_libelle_ligne := trim(coalesce(v_ligne->>'libelle',''));
    exception when others then
      raise exception 'Ligne comptable invalide';
    end;
    if v_compte is null or v_libelle_ligne='' or v_debit<0 or v_credit<0
       or not ((v_debit>0 and v_credit=0) or (v_credit>0 and v_debit=0)) then
      raise exception 'Ligne comptable invalide';
    end if;
    if not exists (
      select 1 from public.compta_plan_comptable c
      where c.id=v_compte and c.pharmacie_id=p_pharmacie and c.statut='valide'
    ) then raise exception 'Compte absent ou non validé'; end if;
    insert into public.compta_ligne(
      ecriture_id,pharmacie_id,compte_id,libelle,debit_fcfa,credit_fcfa
    ) values(v_ecriture,p_pharmacie,v_compte,v_libelle_ligne,v_debit,v_credit);
    v_count := v_count + 1;
  end loop;
  if v_count<2 then raise exception 'Une écriture doit contenir au moins deux lignes'; end if;
  perform public.compta_auditer(
    p_pharmacie,p_acteur,'ecriture_comptable_passee','ecriture',v_ecriture::text,'succes',null
  );
  return v_ecriture;
end;
$;
revoke all on function public.compta_poster_ecriture(uuid,uuid,date,text,text,text,text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.compta_poster_ecriture(uuid,uuid,date,text,text,text,text,text,jsonb,uuid) to service_role;

-- Le journal d'audit est append-only ; l'intégrité de chaque ligne est vérifiable.
create or replace function public.compta_refuser_modification_audit()
returns trigger language plpgsql security definer set search_path=''
as $
begin
  raise exception 'Journal comptable append-only';
end;
$;
drop trigger if exists compta_audit_immutable on public.compta_audit;
create trigger compta_audit_immutable before update or delete on public.compta_audit
for each row execute function public.compta_refuser_modification_audit();

commit;
