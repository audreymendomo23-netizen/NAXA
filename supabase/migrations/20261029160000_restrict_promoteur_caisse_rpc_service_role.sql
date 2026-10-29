-- NAXA — partie 4 Promoteur : réduire les ACL service_role des RPC de gestion Caisse.
-- Les appels applicatifs recensés utilisent supabaseServer() avec l'identité utilisateur.
-- Les actions administratives de service_role sont distinctes; aucune utilisation serveur
-- légitime de ces RPC de délégation/statut n'a été trouvée dans les appels applicatifs.
-- Additif et non destructif : aucune donnée métier n'est modifiée.
revoke execute on function public.naxa_provision_caisse(uuid,uuid) from service_role;
revoke execute on function public.naxa_set_caisse_status(uuid,boolean) from service_role;
revoke execute on function public.naxa_grant_privilege(uuid,text,uuid,text) from service_role;
revoke execute on function public.naxa_revoke_privilege(uuid,text,uuid,text) from service_role;

-- Les façades grant/revoke sont invoker et appellent directement ces implémentations privées.
revoke execute on function private.naxa_grant_privilege(uuid,text,uuid,text) from service_role;
revoke execute on function private.naxa_revoke_privilege(uuid,text,uuid,text) from service_role;
