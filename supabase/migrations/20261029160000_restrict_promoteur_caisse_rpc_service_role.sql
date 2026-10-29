-- NAXA — partie 4 Promoteur : réduire les ACL service_role des RPC de gestion Caisse.
-- Les appels applicatifs recensés utilisent supabaseServer() avec l'identité utilisateur.
-- Les actions administratives de service_role sont distinctes; aucune utilisation serveur
-- légitime de ces RPC de délégation/statut n'a été trouvée dans les appels applicatifs.
-- Additif et non destructif : aucune donnée métier n'est modifiée.
revoke execute on function public.naxa_provision_caisse(uuid,uuid) from service_role;
revoke execute on function public.naxa_set_caisse_status(uuid,boolean) from service_role;
revoke execute on function public.naxa_grant_privilege(uuid,text,uuid,text) from service_role;
revoke execute on function public.naxa_revoke_privilege(uuid,text,uuid,text) from service_role;

-- Le replay de test peut ne pas contenir les helpers privés de délégation.
-- En Production, les signatures existent et leurs droits sont révoqués explicitement.
do $acl$
begin
  if to_regprocedure('private.naxa_grant_privilege(uuid,text,uuid,text)') is not null then
    execute 'revoke execute on function private.naxa_grant_privilege(uuid,text,uuid,text) from service_role';
  end if;
  if to_regprocedure('private.naxa_revoke_privilege(uuid,text,uuid,text)') is not null then
    execute 'revoke execute on function private.naxa_revoke_privilege(uuid,text,uuid,text) from service_role';
  end if;
end
$acl$;
