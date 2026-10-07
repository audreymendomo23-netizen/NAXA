-- NAXA — Partie 4 : désactivation définitive du provisioning automatique legacy
-- L'attribution effective passe exclusivement par naxa_grant_privilege().
-- Aucun trigger de réseau ou d'architecture ne doit provisionner automatiquement la matrice.
begin;
drop trigger if exists trg_naxa_provision_promoteur on public.promoteur_pharmacies;
drop trigger if exists trg_naxa_provision_on_architecture on public.pharmacie_architectures;
revoke execute on function public.naxa_provision_promoteur_pharmacie(uuid,uuid) from anon, authenticated, public;
commit;
