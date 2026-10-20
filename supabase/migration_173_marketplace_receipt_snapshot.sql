-- NAXA 173 — conserver sur la réservation les champs du reçu POS payé.
-- Aucun paiement externe : ces valeurs proviennent exclusivement de la transaction de caisse.
begin;

alter table public.reservations
  add column if not exists paiement_montant_percu integer,
  add column if not exists paiement_monnaie_rendue integer,
  add column if not exists paiement_valide_at timestamptz,
  add column if not exists paiement_ticket_numero text;

alter table public.reservations
  drop constraint if exists reservations_paiement_montants_ck;
alter table public.reservations
  add constraint reservations_paiement_montants_ck check (
    (paiement_montant_percu is null or paiement_montant_percu >= 0)
    and (paiement_monnaie_rendue is null or paiement_monnaie_rendue >= 0)
    and (paiement_montant_percu is null or paiement_monnaie_rendue is null
      or paiement_montant_percu >= paiement_monnaie_rendue)
  );

create or replace function public.naxa_reservation_receipt_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket text;
  v_canal text;
  v_percu integer;
  v_monnaie integer;
  v_date timestamptz;
begin
  if new.statut = 'payee' and old.statut is distinct from 'payee' then
    select v.numero_vente, p.mode::text, p.montant_percu, p.monnaie_rendue,
           coalesce(v.paid_at, p.created_at, now())
      into v_ticket, v_canal, v_percu, v_monnaie, v_date
    from public.ventes v
    join public.vente_paiements p on p.vente_id = v.id
    where v.reservation_id = new.id
      and v.statut = 'payee'
    order by p.created_at desc
    limit 1;

    if v_ticket is null or v_canal is null or v_percu is null or v_monnaie is null then
      raise exception 'Reçu POS incomplet : le paiement de la réservation doit être enregistré avant son passage à payée';
    end if;

    new.paiement_ticket_numero := v_ticket;
    new.paiement_montant_percu := v_percu;
    new.paiement_monnaie_rendue := v_monnaie;
    new.paiement_valide_at := v_date;
    new.paiement_mode := case when v_canal = 'especes' then 'especes_retrait' else v_canal end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_naxa_reservation_receipt_snapshot on public.reservations;
create trigger trg_naxa_reservation_receipt_snapshot
before update of statut on public.reservations
for each row
execute function public.naxa_reservation_receipt_snapshot();

comment on column public.reservations.paiement_montant_percu is 'Montant réellement reçu par la pharmacie, copié du paiement POS lors de la validation Marketplace.';
comment on column public.reservations.paiement_monnaie_rendue is 'Monnaie rendue par la pharmacie, copié du paiement POS; zéro pour les canaux non espèces.';
comment on column public.reservations.paiement_valide_at is 'Date et heure du paiement constaté et validé par la pharmacie.';
comment on column public.reservations.paiement_ticket_numero is 'Numéro du ticket POS lié au reçu Marketplace payé.';

commit;