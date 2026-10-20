-- NAXA 187 — tests structurels de portée assurance et annulation caisse.
do $$
declare
  v_definition text;
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='couvertures_assurance'
      and policyname='couvertures_assurance_pharmacie_dossier_read'
      and cmd='SELECT'
  ) then
    raise exception 'Lecture des couvertures via dossier pharmacie absente';
  end if;

  if not has_function_privilege('authenticated','public.vente_annulation_demander(uuid,text)','EXECUTE') then
    raise exception 'La fonction de demande d''annulation doit être accessible aux comptes authentifiés';
  end if;
  if has_function_privilege('anon','public.vente_annulation_demander(uuid,text)','EXECUTE') then
    raise exception 'Les comptes anon ne doivent pas demander une annulation';
  end if;

  select pg_get_functiondef('public.vente_annulation_demander(uuid,text)'::regprocedure)
    into v_definition;
  if position('created_by' in v_definition)=0
     or position('ne peut demander l''annulation que de ses propres ventes' in v_definition)=0 then
    raise exception 'Le contrôle serveur des ventes propres à la caisse est absent';
  end if;
end $$;

select '187_caisse_parcours_scope_assurances PASS' as resultat;
