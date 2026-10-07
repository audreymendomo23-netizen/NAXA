begin;
do $test$
declare n bigint;
begin
 select count(*) into n from pg_tables where schemaname='public' and tablename in ('conventions_promoteurs','abonnements_promoteurs','abonnement_promoteur_paiements');
 if n<>3 then raise exception 'PART3_FAIL_TABLES:%',n; end if;
 if private.naxa_promoteur_valide_canonique(gen_random_uuid()) then raise exception 'PART3_FAIL_UNKNOWN_PROMOTEUR'; end if;
 if exists(select 1 from pg_trigger where tgrelid='public.pharmacies'::regclass and tgname='trg_initialiser_abonnement_pharmacie' and not tgisinternal) then raise exception 'PART3_FAIL_LEGACY_PHARMACY_SUBSCRIPTION_TRIGGER'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public' and indexname='promoteur_pharmacies_one_active_promoteur_per_pharmacie') then raise exception 'PART3_FAIL_UNIQUE_NETWORK_INDEX'; end if;
 begin
   insert into public.abonnements_promoteurs(convention_id,promoteur_id) values(gen_random_uuid(),gen_random_uuid());
   raise exception 'PART3_FAIL_ORPHAN_SUBSCRIPTION_ACCEPTED';
 exception when foreign_key_violation then null;
 end;
end $test$;
rollback;