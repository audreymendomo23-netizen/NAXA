-- NAXA 125 — verrouillage serveur de l’univers Dispositifs médicaux en phase 1.
-- Additif : aucun schéma métier n’est supprimé. L’univers reste visible comme espace « à venir »,
-- mais aucune activation, association partenaire active ou publication produit n’est autorisée.
begin;

create or replace function public.guard_medical_devices_phase1()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  row_json jsonb := to_jsonb(NEW);
  slug_value text;
  enabled_value boolean;
  status_value text;
  flag_value text;
begin
  if TG_TABLE_NAME = 'universes' then
    slug_value := row_json->>'slug';
    enabled_value := coalesce((row_json->>'enabled')::boolean, false);
    if slug_value = 'suivi' and enabled_value then
      raise exception 'Dispositifs médicaux reste désactivé en phase 1' using errcode = '42501';
    end if;
  elsif TG_TABLE_NAME = 'feature_flags' then
    flag_value := row_json->>'flag_key';
    enabled_value := coalesce((row_json->>'enabled')::boolean, false);
    if flag_value = 'universe.suivi' and enabled_value then
      raise exception 'Dispositifs médicaux reste désactivé en phase 1' using errcode = '42501';
    end if;
  elsif TG_TABLE_NAME = 'partner_universes' then
    slug_value := row_json->>'universe_slug';
    enabled_value := coalesce((row_json->>'enabled')::boolean, false);
    if slug_value = 'suivi' and enabled_value then
      raise exception 'Association partenaire Dispositifs médicaux interdite en phase 1' using errcode = '42501';
    end if;
  elsif TG_TABLE_NAME = 'partner_products' then
    slug_value := row_json->>'universe_slug';
    status_value := row_json->>'status';
    if slug_value = 'suivi' and status_value = 'active' then
      raise exception 'Publication de dispositifs médicaux interdite en phase 1' using errcode = '42501';
    end if;
  end if;
  return NEW;
end;
$function$;

revoke all on function public.guard_medical_devices_phase1() from public, anon, authenticated;

drop trigger if exists guard_medical_devices_universe_phase1 on public.universes;
create trigger guard_medical_devices_universe_phase1
before insert or update on public.universes
for each row execute function public.guard_medical_devices_phase1();

drop trigger if exists guard_medical_devices_flag_phase1 on public.feature_flags;
create trigger guard_medical_devices_flag_phase1
before insert or update on public.feature_flags
for each row execute function public.guard_medical_devices_phase1();

drop trigger if exists guard_medical_devices_partner_universe_phase1 on public.partner_universes;
create trigger guard_medical_devices_partner_universe_phase1
before insert or update on public.partner_universes
for each row execute function public.guard_medical_devices_phase1();

drop trigger if exists guard_medical_devices_product_phase1 on public.partner_products;
create trigger guard_medical_devices_product_phase1
before insert or update on public.partner_products
for each row execute function public.guard_medical_devices_phase1();

-- État canonique verrouillé : espace et indicateur désactivés, associations partenaires désactivées.
update public.universes
set name = 'Dispositifs médicaux', enabled = false, updated_at = now()
where slug = 'suivi';

update public.feature_flags
set enabled = false,
    description = 'Dispositifs médicaux : désactivé en phase 1, aucune mesure de santé collectée',
    updated_at = now()
where flag_key = 'universe.suivi';

update public.partner_universes
set enabled = false
where universe_slug = 'suivi' and enabled = true;

commit;
