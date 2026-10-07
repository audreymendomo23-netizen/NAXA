-- NAXA — Partie 4 : désactivation définitive du provisioning automatique legacy
-- Le réseau Promoteur/pharmacie ne doit jamais attribuer automatiquement la matrice de privilèges.
-- L'attribution effective passe exclusivement par naxa_grant_privilege().
begin;
drop trigger if exists trg_naxa_provision_promoteur on public.promoteur_pharmacies;
revoke execute on function public.naxa_provision_promoteur_pharmacie(uuid,uuid) from anon, authenticated, public;
commit;
