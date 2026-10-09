-- NAXA ERP-003 — POS étape 3 : ticket/reçu et numérotation unique
-- Extension additive du moteur ventes existant. Aucun second moteur de vente.

create sequence if not exists public.vente_numero_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1
  no cycle;

alter table public.ventes
  add column if not exists numero_vente text;

-- Numérotation historique déterministe, sans fenêtre directement dans UPDATE.
-- Les numéros déjà présents sont conservés et servent de borne pour éviter les collisions.
with borne as (
  select coalesce(
    max(substring(numero_vente from '([0-9]+)

alter table public.ventes
  alter column numero_vente set default (
    'V-' || to_char(current_timestamp,'YYYYMMDD') || '-' ||
    lpad(nextval('public.vente_numero_seq')::text,6,'0')
  ),
  alter column numero_vente set not null;

create unique index if not exists ventes_numero_vente_uq
  on public.ventes(numero_vente);

-- Recalage sûr de la séquence, y compris si ventes est vide.
-- Avec is_called=false, une table vide produit 1 au prochain nextval().
with borne as (
  select coalesce(
    max(substring(numero_vente from '([0-9]+)

comment on column public.ventes.numero_vente is
  'Numéro unique et stable du ticket de vente POS, utilisé pour impression et réimpression.';

-- Données du ticket : lecture scoped par la RLS existante du moteur ventes/lignes.
-- La RPC ne modifie rien et ne crée aucun second flux de vente.
create or replace function public.vente_ticket(p_vente uuid)
returns table(
  vente_id uuid,
  numero_vente text,
  pharmacie_id uuid,
  client_id uuid,
  statut public.vente_statut,
  created_at timestamptz,
  paid_at timestamptz,
  total_brut integer,
  remise integer,
  total_net integer,
  mode_paiement public.mode_paiement_caisse,
  paiement_ref text,
  produit_id uuid,
  produit_nom text,
  produit_dosage text,
  quantite integer,
  prix_unitaire integer,
  total_ligne integer
)
language sql
security invoker
set search_path=''
as $ticket$
  select
    v.id,
    v.numero_vente,
    v.pharmacie_id,
    v.client_id,
    v.statut,
    v.created_at,
    v.paid_at,
    v.total_brut,
    v.remise,
    v.total_net,
    v.mode_paiement,
    v.paiement_ref,
    vl.produit_id,
    p.nom,
    p.dosage,
    vl.quantite,
    vl.prix_unitaire,
    vl.total_ligne
  from public.ventes v
  left join public.vente_lignes vl on vl.vente_id=v.id
  left join public.produits p on p.id=vl.produit_id
  where v.id=p_vente
    and (public.is_admin() or public.can_access_pharmacy(v.pharmacie_id))
  order by vl.id;
$ticket$;

revoke all on function public.vente_ticket(uuid) from public,anon;
grant execute on function public.vente_ticket(uuid) to authenticated;
)::bigint)
      filter (where numero_vente ~ '[0-9]+

alter table public.ventes
  alter column numero_vente set default (
    'V-' || to_char(current_timestamp,'YYYYMMDD') || '-' ||
    lpad(nextval('public.vente_numero_seq')::text,6,'0')
  ),
  alter column numero_vente set not null;

create unique index if not exists ventes_numero_vente_uq
  on public.ventes(numero_vente);

-- Recalage de la séquence après les ventes historiques numérotées.
select setval(
  'public.vente_numero_seq',
  greatest(
    (select coalesce(max(regexp_replace(numero_vente,'^.*-','')::bigint),0) from public.ventes),
    0
  )
);

comment on column public.ventes.numero_vente is
  'Numéro unique et stable du ticket de vente POS, utilisé pour impression et réimpression.';

-- Données du ticket : lecture scoped par la RLS existante du moteur ventes/lignes.
-- La RPC ne modifie rien et ne crée aucun second flux de vente.
create or replace function public.vente_ticket(p_vente uuid)
returns table(
  vente_id uuid,
  numero_vente text,
  pharmacie_id uuid,
  client_id uuid,
  statut public.vente_statut,
  created_at timestamptz,
  paid_at timestamptz,
  total_brut integer,
  remise integer,
  total_net integer,
  mode_paiement public.mode_paiement_caisse,
  paiement_ref text,
  produit_id uuid,
  produit_nom text,
  produit_dosage text,
  quantite integer,
  prix_unitaire integer,
  total_ligne integer
)
language sql
security invoker
set search_path=''
as $ticket$
  select
    v.id,
    v.numero_vente,
    v.pharmacie_id,
    v.client_id,
    v.statut,
    v.created_at,
    v.paid_at,
    v.total_brut,
    v.remise,
    v.total_net,
    v.mode_paiement,
    v.paiement_ref,
    vl.produit_id,
    p.nom,
    p.dosage,
    vl.quantite,
    vl.prix_unitaire,
    vl.total_ligne
  from public.ventes v
  left join public.vente_lignes vl on vl.vente_id=v.id
  left join public.produits p on p.id=vl.produit_id
  where v.id=p_vente
    and (public.is_admin() or public.can_access_pharmacy(v.pharmacie_id))
  order by vl.id;
$ticket$;

revoke all on function public.vente_ticket(uuid) from public,anon;
grant execute on function public.vente_ticket(uuid) to authenticated;
),
    0
  ) as max_numero
  from public.ventes
  where numero_vente is not null
),
ventes_a_numeroter as (
  select
    v.id,
    v.created_at,
    row_number() over (order by v.created_at, v.id) + b.max_numero as rang
  from public.ventes v
  cross join borne b
  where v.numero_vente is null
)
update public.ventes v
set numero_vente = 'V-' || to_char(vn.created_at, 'YYYYMMDD') || '-' ||
                   lpad(vn.rang::text, 6, '0')
from ventes_a_numeroter vn
where v.id = vn.id;

alter table public.ventes
  alter column numero_vente set default (
    'V-' || to_char(current_timestamp,'YYYYMMDD') || '-' ||
    lpad(nextval('public.vente_numero_seq')::text,6,'0')
  ),
  alter column numero_vente set not null;

create unique index if not exists ventes_numero_vente_uq
  on public.ventes(numero_vente);

-- Recalage de la séquence après les ventes historiques numérotées.
select setval(
  'public.vente_numero_seq',
  greatest(
    (select coalesce(max(regexp_replace(numero_vente,'^.*-','')::bigint),0) from public.ventes),
    0
  )
);

comment on column public.ventes.numero_vente is
  'Numéro unique et stable du ticket de vente POS, utilisé pour impression et réimpression.';

-- Données du ticket : lecture scoped par la RLS existante du moteur ventes/lignes.
-- La RPC ne modifie rien et ne crée aucun second flux de vente.
create or replace function public.vente_ticket(p_vente uuid)
returns table(
  vente_id uuid,
  numero_vente text,
  pharmacie_id uuid,
  client_id uuid,
  statut public.vente_statut,
  created_at timestamptz,
  paid_at timestamptz,
  total_brut integer,
  remise integer,
  total_net integer,
  mode_paiement public.mode_paiement_caisse,
  paiement_ref text,
  produit_id uuid,
  produit_nom text,
  produit_dosage text,
  quantite integer,
  prix_unitaire integer,
  total_ligne integer
)
language sql
security invoker
set search_path=''
as $ticket$
  select
    v.id,
    v.numero_vente,
    v.pharmacie_id,
    v.client_id,
    v.statut,
    v.created_at,
    v.paid_at,
    v.total_brut,
    v.remise,
    v.total_net,
    v.mode_paiement,
    v.paiement_ref,
    vl.produit_id,
    p.nom,
    p.dosage,
    vl.quantite,
    vl.prix_unitaire,
    vl.total_ligne
  from public.ventes v
  left join public.vente_lignes vl on vl.vente_id=v.id
  left join public.produits p on p.id=vl.produit_id
  where v.id=p_vente
    and (public.is_admin() or public.can_access_pharmacy(v.pharmacie_id))
  order by vl.id;
$ticket$;

revoke all on function public.vente_ticket(uuid) from public,anon;
grant execute on function public.vente_ticket(uuid) to authenticated;
)::bigint)
      filter (where numero_vente ~ '[0-9]+

comment on column public.ventes.numero_vente is
  'Numéro unique et stable du ticket de vente POS, utilisé pour impression et réimpression.';

-- Données du ticket : lecture scoped par la RLS existante du moteur ventes/lignes.
-- La RPC ne modifie rien et ne crée aucun second flux de vente.
create or replace function public.vente_ticket(p_vente uuid)
returns table(
  vente_id uuid,
  numero_vente text,
  pharmacie_id uuid,
  client_id uuid,
  statut public.vente_statut,
  created_at timestamptz,
  paid_at timestamptz,
  total_brut integer,
  remise integer,
  total_net integer,
  mode_paiement public.mode_paiement_caisse,
  paiement_ref text,
  produit_id uuid,
  produit_nom text,
  produit_dosage text,
  quantite integer,
  prix_unitaire integer,
  total_ligne integer
)
language sql
security invoker
set search_path=''
as $ticket$
  select
    v.id,
    v.numero_vente,
    v.pharmacie_id,
    v.client_id,
    v.statut,
    v.created_at,
    v.paid_at,
    v.total_brut,
    v.remise,
    v.total_net,
    v.mode_paiement,
    v.paiement_ref,
    vl.produit_id,
    p.nom,
    p.dosage,
    vl.quantite,
    vl.prix_unitaire,
    vl.total_ligne
  from public.ventes v
  left join public.vente_lignes vl on vl.vente_id=v.id
  left join public.produits p on p.id=vl.produit_id
  where v.id=p_vente
    and (public.is_admin() or public.can_access_pharmacy(v.pharmacie_id))
  order by vl.id;
$ticket$;

revoke all on function public.vente_ticket(uuid) from public,anon;
grant execute on function public.vente_ticket(uuid) to authenticated;
)::bigint)
      filter (where numero_vente ~ '[0-9]+

alter table public.ventes
  alter column numero_vente set default (
    'V-' || to_char(current_timestamp,'YYYYMMDD') || '-' ||
    lpad(nextval('public.vente_numero_seq')::text,6,'0')
  ),
  alter column numero_vente set not null;

create unique index if not exists ventes_numero_vente_uq
  on public.ventes(numero_vente);

-- Recalage de la séquence après les ventes historiques numérotées.
select setval(
  'public.vente_numero_seq',
  greatest(
    (select coalesce(max(regexp_replace(numero_vente,'^.*-','')::bigint),0) from public.ventes),
    0
  )
);

comment on column public.ventes.numero_vente is
  'Numéro unique et stable du ticket de vente POS, utilisé pour impression et réimpression.';

-- Données du ticket : lecture scoped par la RLS existante du moteur ventes/lignes.
-- La RPC ne modifie rien et ne crée aucun second flux de vente.
create or replace function public.vente_ticket(p_vente uuid)
returns table(
  vente_id uuid,
  numero_vente text,
  pharmacie_id uuid,
  client_id uuid,
  statut public.vente_statut,
  created_at timestamptz,
  paid_at timestamptz,
  total_brut integer,
  remise integer,
  total_net integer,
  mode_paiement public.mode_paiement_caisse,
  paiement_ref text,
  produit_id uuid,
  produit_nom text,
  produit_dosage text,
  quantite integer,
  prix_unitaire integer,
  total_ligne integer
)
language sql
security invoker
set search_path=''
as $ticket$
  select
    v.id,
    v.numero_vente,
    v.pharmacie_id,
    v.client_id,
    v.statut,
    v.created_at,
    v.paid_at,
    v.total_brut,
    v.remise,
    v.total_net,
    v.mode_paiement,
    v.paiement_ref,
    vl.produit_id,
    p.nom,
    p.dosage,
    vl.quantite,
    vl.prix_unitaire,
    vl.total_ligne
  from public.ventes v
  left join public.vente_lignes vl on vl.vente_id=v.id
  left join public.produits p on p.id=vl.produit_id
  where v.id=p_vente
    and (public.is_admin() or public.can_access_pharmacy(v.pharmacie_id))
  order by vl.id;
$ticket$;

revoke all on function public.vente_ticket(uuid) from public,anon;
grant execute on function public.vente_ticket(uuid) to authenticated;
),
    0
  ) as max_numero
  from public.ventes
  where numero_vente is not null
),
ventes_a_numeroter as (
  select
    v.id,
    v.created_at,
    row_number() over (order by v.created_at, v.id) + b.max_numero as rang
  from public.ventes v
  cross join borne b
  where v.numero_vente is null
)
update public.ventes v
set numero_vente = 'V-' || to_char(vn.created_at, 'YYYYMMDD') || '-' ||
                   lpad(vn.rang::text, 6, '0')
from ventes_a_numeroter vn
where v.id = vn.id;

alter table public.ventes
  alter column numero_vente set default (
    'V-' || to_char(current_timestamp,'YYYYMMDD') || '-' ||
    lpad(nextval('public.vente_numero_seq')::text,6,'0')
  ),
  alter column numero_vente set not null;

create unique index if not exists ventes_numero_vente_uq
  on public.ventes(numero_vente);

-- Recalage de la séquence après les ventes historiques numérotées.
select setval(
  'public.vente_numero_seq',
  greatest(
    (select coalesce(max(regexp_replace(numero_vente,'^.*-','')::bigint),0) from public.ventes),
    0
  )
);

comment on column public.ventes.numero_vente is
  'Numéro unique et stable du ticket de vente POS, utilisé pour impression et réimpression.';

-- Données du ticket : lecture scoped par la RLS existante du moteur ventes/lignes.
-- La RPC ne modifie rien et ne crée aucun second flux de vente.
create or replace function public.vente_ticket(p_vente uuid)
returns table(
  vente_id uuid,
  numero_vente text,
  pharmacie_id uuid,
  client_id uuid,
  statut public.vente_statut,
  created_at timestamptz,
  paid_at timestamptz,
  total_brut integer,
  remise integer,
  total_net integer,
  mode_paiement public.mode_paiement_caisse,
  paiement_ref text,
  produit_id uuid,
  produit_nom text,
  produit_dosage text,
  quantite integer,
  prix_unitaire integer,
  total_ligne integer
)
language sql
security invoker
set search_path=''
as $ticket$
  select
    v.id,
    v.numero_vente,
    v.pharmacie_id,
    v.client_id,
    v.statut,
    v.created_at,
    v.paid_at,
    v.total_brut,
    v.remise,
    v.total_net,
    v.mode_paiement,
    v.paiement_ref,
    vl.produit_id,
    p.nom,
    p.dosage,
    vl.quantite,
    vl.prix_unitaire,
    vl.total_ligne
  from public.ventes v
  left join public.vente_lignes vl on vl.vente_id=v.id
  left join public.produits p on p.id=vl.produit_id
  where v.id=p_vente
    and (public.is_admin() or public.can_access_pharmacy(v.pharmacie_id))
  order by vl.id;
$ticket$;

revoke all on function public.vente_ticket(uuid) from public,anon;
grant execute on function public.vente_ticket(uuid) to authenticated;
),
    0
  ) as max_numero
  from public.ventes
)
select setval(
  'public.vente_numero_seq',
  greatest(max_numero, 1),
  max_numero > 0
)
from borne;

comment on column public.ventes.numero_vente is
  'Numéro unique et stable du ticket de vente POS, utilisé pour impression et réimpression.';

-- Données du ticket : lecture scoped par la RLS existante du moteur ventes/lignes.
-- La RPC ne modifie rien et ne crée aucun second flux de vente.
create or replace function public.vente_ticket(p_vente uuid)
returns table(
  vente_id uuid,
  numero_vente text,
  pharmacie_id uuid,
  client_id uuid,
  statut public.vente_statut,
  created_at timestamptz,
  paid_at timestamptz,
  total_brut integer,
  remise integer,
  total_net integer,
  mode_paiement public.mode_paiement_caisse,
  paiement_ref text,
  produit_id uuid,
  produit_nom text,
  produit_dosage text,
  quantite integer,
  prix_unitaire integer,
  total_ligne integer
)
language sql
security invoker
set search_path=''
as $ticket$
  select
    v.id,
    v.numero_vente,
    v.pharmacie_id,
    v.client_id,
    v.statut,
    v.created_at,
    v.paid_at,
    v.total_brut,
    v.remise,
    v.total_net,
    v.mode_paiement,
    v.paiement_ref,
    vl.produit_id,
    p.nom,
    p.dosage,
    vl.quantite,
    vl.prix_unitaire,
    vl.total_ligne
  from public.ventes v
  left join public.vente_lignes vl on vl.vente_id=v.id
  left join public.produits p on p.id=vl.produit_id
  where v.id=p_vente
    and (public.is_admin() or public.can_access_pharmacy(v.pharmacie_id))
  order by vl.id;
$ticket$;

revoke all on function public.vente_ticket(uuid) from public,anon;
grant execute on function public.vente_ticket(uuid) to authenticated;
)::bigint)
      filter (where numero_vente ~ '[0-9]+

alter table public.ventes
  alter column numero_vente set default (
    'V-' || to_char(current_timestamp,'YYYYMMDD') || '-' ||
    lpad(nextval('public.vente_numero_seq')::text,6,'0')
  ),
  alter column numero_vente set not null;

create unique index if not exists ventes_numero_vente_uq
  on public.ventes(numero_vente);

-- Recalage de la séquence après les ventes historiques numérotées.
select setval(
  'public.vente_numero_seq',
  greatest(
    (select coalesce(max(regexp_replace(numero_vente,'^.*-','')::bigint),0) from public.ventes),
    0
  )
);

comment on column public.ventes.numero_vente is
  'Numéro unique et stable du ticket de vente POS, utilisé pour impression et réimpression.';

-- Données du ticket : lecture scoped par la RLS existante du moteur ventes/lignes.
-- La RPC ne modifie rien et ne crée aucun second flux de vente.
create or replace function public.vente_ticket(p_vente uuid)
returns table(
  vente_id uuid,
  numero_vente text,
  pharmacie_id uuid,
  client_id uuid,
  statut public.vente_statut,
  created_at timestamptz,
  paid_at timestamptz,
  total_brut integer,
  remise integer,
  total_net integer,
  mode_paiement public.mode_paiement_caisse,
  paiement_ref text,
  produit_id uuid,
  produit_nom text,
  produit_dosage text,
  quantite integer,
  prix_unitaire integer,
  total_ligne integer
)
language sql
security invoker
set search_path=''
as $ticket$
  select
    v.id,
    v.numero_vente,
    v.pharmacie_id,
    v.client_id,
    v.statut,
    v.created_at,
    v.paid_at,
    v.total_brut,
    v.remise,
    v.total_net,
    v.mode_paiement,
    v.paiement_ref,
    vl.produit_id,
    p.nom,
    p.dosage,
    vl.quantite,
    vl.prix_unitaire,
    vl.total_ligne
  from public.ventes v
  left join public.vente_lignes vl on vl.vente_id=v.id
  left join public.produits p on p.id=vl.produit_id
  where v.id=p_vente
    and (public.is_admin() or public.can_access_pharmacy(v.pharmacie_id))
  order by vl.id;
$ticket$;

revoke all on function public.vente_ticket(uuid) from public,anon;
grant execute on function public.vente_ticket(uuid) to authenticated;
),
    0
  ) as max_numero
  from public.ventes
  where numero_vente is not null
),
ventes_a_numeroter as (
  select
    v.id,
    v.created_at,
    row_number() over (order by v.created_at, v.id) + b.max_numero as rang
  from public.ventes v
  cross join borne b
  where v.numero_vente is null
)
update public.ventes v
set numero_vente = 'V-' || to_char(vn.created_at, 'YYYYMMDD') || '-' ||
                   lpad(vn.rang::text, 6, '0')
from ventes_a_numeroter vn
where v.id = vn.id;

alter table public.ventes
  alter column numero_vente set default (
    'V-' || to_char(current_timestamp,'YYYYMMDD') || '-' ||
    lpad(nextval('public.vente_numero_seq')::text,6,'0')
  ),
  alter column numero_vente set not null;

create unique index if not exists ventes_numero_vente_uq
  on public.ventes(numero_vente);

-- Recalage de la séquence après les ventes historiques numérotées.
select setval(
  'public.vente_numero_seq',
  greatest(
    (select coalesce(max(regexp_replace(numero_vente,'^.*-','')::bigint),0) from public.ventes),
    0
  )
);

comment on column public.ventes.numero_vente is
  'Numéro unique et stable du ticket de vente POS, utilisé pour impression et réimpression.';

-- Données du ticket : lecture scoped par la RLS existante du moteur ventes/lignes.
-- La RPC ne modifie rien et ne crée aucun second flux de vente.
create or replace function public.vente_ticket(p_vente uuid)
returns table(
  vente_id uuid,
  numero_vente text,
  pharmacie_id uuid,
  client_id uuid,
  statut public.vente_statut,
  created_at timestamptz,
  paid_at timestamptz,
  total_brut integer,
  remise integer,
  total_net integer,
  mode_paiement public.mode_paiement_caisse,
  paiement_ref text,
  produit_id uuid,
  produit_nom text,
  produit_dosage text,
  quantite integer,
  prix_unitaire integer,
  total_ligne integer
)
language sql
security invoker
set search_path=''
as $ticket$
  select
    v.id,
    v.numero_vente,
    v.pharmacie_id,
    v.client_id,
    v.statut,
    v.created_at,
    v.paid_at,
    v.total_brut,
    v.remise,
    v.total_net,
    v.mode_paiement,
    v.paiement_ref,
    vl.produit_id,
    p.nom,
    p.dosage,
    vl.quantite,
    vl.prix_unitaire,
    vl.total_ligne
  from public.ventes v
  left join public.vente_lignes vl on vl.vente_id=v.id
  left join public.produits p on p.id=vl.produit_id
  where v.id=p_vente
    and (public.is_admin() or public.can_access_pharmacy(v.pharmacie_id))
  order by vl.id;
$ticket$;

revoke all on function public.vente_ticket(uuid) from public,anon;
grant execute on function public.vente_ticket(uuid) to authenticated;
