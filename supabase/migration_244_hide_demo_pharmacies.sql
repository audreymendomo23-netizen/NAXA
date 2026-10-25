-- Masque les pharmacies de démonstration historiques sans supprimer de données.
-- Les stocks associés restent en base pour audit, mais ne doivent plus apparaître
-- dans la recherche publique, les offres, les prix ni les pharmacies de garde.
begin;

update public.pharmacies
set actif = false,
    visible_recherche = false,
    de_garde = false,
    archivee_le = coalesce(archivee_le, now())
where id in (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid
)
or lower(coalesce(nom, '')) like '%démo%'
or lower(coalesce(nom, '')) like '%demo%'
or lower(coalesce(nom, '')) like '%test%';

commit;
