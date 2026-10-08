-- NAXA 020c — fermeture des privilèges incompatibles par architecture
delete from public.naxa_architecture_privileges
where role_key='promoteur'
  and architecture_code in ('ORPHELIN','PARENTS_ENFANTS')
  and privilege_code in ('CREATE_RESPONSABLE','MANAGE_RESPONSABLES','SUSPEND_RESPONSABLE','REACTIVATE_RESPONSABLE','VIEW_RESPONSABLE_PILOTAGE','VIEW_RESPONSABLE_REPORT','VIEW_CA_BY_RESPONSABLE');

-- En A3/A4, la capacité Responsable devient disponible seulement si l'architecture l'autorise.
insert into public.naxa_architecture_privileges(architecture_code,role_key,privilege_code)
select a.architecture_code,'promoteur',p.code
from (values ('PARENTS_AINES_CADETS'),('HYBRIDE')) a(architecture_code)
join public.naxa_role_privileges rp on rp.role_key='promoteur'
join public.naxa_privileges p on p.code=rp.privilege_code
where p.code in ('CREATE_RESPONSABLE','MANAGE_RESPONSABLES','SUSPEND_RESPONSABLE','REACTIVATE_RESPONSABLE','VIEW_RESPONSABLE_PILOTAGE','VIEW_RESPONSABLE_REPORT','VIEW_CA_BY_RESPONSABLE')
on conflict do nothing;
