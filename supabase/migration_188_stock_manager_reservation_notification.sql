-- NAXA 188 — Notification groupée des réservations au poste stock.
-- Additif : conserve reservations/reservation_items comme source de vérité.
-- Cette migration n'est pas appliquée à Supabase Production par ce commit.
begin;

-- Emplacements facultatifs : on n'invente jamais une localisation absente.
alter table public.stocks
  add column if not exists emplacement text
  check (emplacement is null or char_length(emplacement) <= 160);

alter table public.stocks_lots
  add column if not exists emplacement text
  check (emplacement is null or char_length(emplacement) <= 160);

-- Relie la notification à son dossier complet, pas à une ligne de médicament.
alter table public.notifications
  add column if not exists reservation_id uuid
  references public.reservations(id) on delete cascade;

create unique index if not exists notifications_reservation_initiale_uq
  on public.notifications(reservation_id, type)
  where reservation_id is not null and type = 'reservation';

create index if not exists notifications_reservation_id_idx
  on public.notifications(reservation_id)
  where reservation_id is not null;

create or replace function private.notifier_reservation_gestion_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_corps text;
begin
  if coalesce(new.mode::text, 'reservation') <> 'reservation' then
    return new;
  end if;

  -- Le trigger différé s'exécute à la fin de la transaction : les lignes
  -- reservation_items créées dans la même transaction sont alors disponibles.
  select string_agg(
    format(
      '%s × %s%s — stock agrégé : %s ; lots utilisables : %s ; emplacement : %s',
      ri.quantite,
      coalesce(nullif(trim(p.nom), ''), 'Produit sans nom'),
      case when nullif(trim(coalesce(p.dosage, '')), '') is null
        then '' else ' ' || trim(p.dosage) end,
      coalesce(s.quantite, 0),
      coalesce(lots.quantite_utilisable, 0),
      coalesce(nullif(lots.emplacements, ''), nullif(s.emplacement, ''), 'Emplacement non renseigné')
    ),
    E'\n' order by p.nom, p.dosage
  )
  into v_corps
  from public.reservation_items ri
  join public.produits p on p.id = ri.produit_id
  left join public.stocks s
    on s.pharmacie_id = new.pharmacie_id and s.produit_id = ri.produit_id
  left join lateral (
    select
      sum(sl.quantite) filter (
        where sl.date_peremption >= current_date and not sl.bloque
      )::integer as quantite_utilisable,
      string_agg(
        distinct coalesce(nullif(trim(sl.emplacement), ''), 'Emplacement non renseigné')
        || ' (lot ' || sl.numero_lot || ', péremption ' || sl.date_peremption::text || ')',
        ', ' order by coalesce(nullif(trim(sl.emplacement), ''), 'Emplacement non renseigné')
        || ' (lot ' || sl.numero_lot || ', péremption ' || sl.date_peremption::text || ')'
      ) filter (
        where sl.date_peremption >= current_date and not sl.bloque and sl.quantite > 0
      ) as emplacements
    from public.stocks_lots sl
    where sl.pharmacie_id = new.pharmacie_id
      and sl.produit_id = ri.produit_id
  ) lots on true
  where ri.reservation_id = new.id;

  if v_corps is null then
    v_corps := 'Aucune ligne de produit lisible. Ouvrez la réservation et vérifiez son contenu.';
  end if;

  insert into public.notifications(
    pharmacie_id, type, titre, corps, reservation_id
  )
  values (
    new.pharmacie_id,
    'reservation',
    'Nouvelle réservation Marketplace à préparer',
    left(
      'Réservation #' || upper(left(replace(new.id::text, '-', ''), 8))
      || E'\nExpiration : ' || coalesce(new.expires_at::text, 'Non renseignée')
      || E'\n' || v_corps,
      1000
    ),
    new.id
  )
  on conflict (reservation_id, type)
    where reservation_id is not null and type = 'reservation'
    do nothing;

  return new;
end;
$function$;

revoke all on function private.notifier_reservation_gestion_stock() from public, anon, authenticated;

drop trigger if exists trg_notifier_reservation_gestion_stock on public.reservations;
create constraint trigger trg_notifier_reservation_gestion_stock
after insert on public.reservations
deferrable initially deferred
for each row execute function private.notifier_reservation_gestion_stock();

comment on column public.stocks.emplacement is
  'Emplacement physique facultatif du stock agrégé ; null signifie que la localisation n''est pas renseignée.';
comment on column public.stocks_lots.emplacement is
  'Emplacement physique facultatif du lot ; null signifie que la localisation n''est pas renseignée.';
comment on column public.notifications.reservation_id is
  'Lien vers le dossier de réservation complet pour regrouper notification et lignes de produits.';

commit;
