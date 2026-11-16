-- NAXA — Empêcher toute réactivation du vieux catalogue partenaire Bébé & Maman.
-- Les demandes et offres B&M doivent désormais passer exclusivement par l'ERP Pharmacie.
begin;

create or replace function private.naxa_block_legacy_bebe_maman_partner_products()
returns trigger
language plpgsql
set search_path=''
as $function$
begin
  if tg_op='INSERT' and new.universe_slug='bebe-maman' then
    raise exception 'Bébé & Maman utilise désormais les fiches et stocks de l’ERP Pharmacie';
  end if;
  if tg_op='UPDATE' then
    if new.universe_slug='bebe-maman' and old.universe_slug is distinct from new.universe_slug then
      raise exception 'Le catalogue partenaire ne peut plus recevoir de produits Bébé & Maman';
    end if;
    if old.universe_slug='bebe-maman' then
      if new.universe_slug is distinct from old.universe_slug or new.status is distinct from 'archived' then
        raise exception 'Les anciennes fiches partenaires Bébé & Maman sont en lecture seule et peuvent uniquement être archivées';
      end if;
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function private.naxa_block_legacy_bebe_maman_partner_products() from public,anon,authenticated;

drop trigger if exists naxa_block_legacy_bebe_maman_partner_products on public.partner_products;
create trigger naxa_block_legacy_bebe_maman_partner_products
before insert or update of universe_slug,status on public.partner_products
for each row execute function private.naxa_block_legacy_bebe_maman_partner_products();

create or replace function private.naxa_block_legacy_bebe_maman_reservations()
returns trigger
language plpgsql
set search_path=''
as $function$
begin
  if tg_op='INSERT' and new.universe_slug='bebe-maman' then
    raise exception 'Les réservations Bébé & Maman doivent utiliser le circuit ERP Pharmacie';
  end if;
  if tg_op='UPDATE' and (
    old.universe_slug='bebe-maman' or new.universe_slug='bebe-maman'
  ) and old.universe_slug is distinct from new.universe_slug then
    raise exception 'Le rattachement historique Bébé & Maman ne peut pas être modifié';
  end if;
  return new;
end;
$function$;
revoke all on function private.naxa_block_legacy_bebe_maman_reservations() from public,anon,authenticated;

drop trigger if exists naxa_block_legacy_bebe_maman_reservations on public.universe_reservations;
create trigger naxa_block_legacy_bebe_maman_reservations
before insert or update of universe_slug on public.universe_reservations
for each row execute function private.naxa_block_legacy_bebe_maman_reservations();

comment on table public.pharmacie_bebe_maman_produits is
  'Classification Bébé & Maman des fiches catalogue Pharmacie. Le stock, les prix, lots et réservations restent dans les tables ERP Pharmacie.';
comment on table public.partner_products is
  'Catalogue des partenaires, utilisé pour Parapharmacie et autres univers partenaires. Bébé & Maman est exclu et géré via pharmacie_bebe_maman_produits.';
comment on table public.universe_reservations is
  'Réservations des univers partenaires. Bébé & Maman est exclu et utilise public.reservations + public.reservation_items.';

commit;
