do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.admin_valider_dossier_partenaire(uuid)'::regprocedure)
  into v_definition;

  v_definition:=replace(v_definition,$old$    when 'aide' then 'autre'
$old$,'');
  v_definition:=replace(v_definition,$old$  if v_universe<>'aide' and not exists(
$old$,$new$  if not exists(
$new$);

  if position('when ''aide'' then ''autre''' in v_definition)>0
    or position('v_universe<>''aide''' in v_definition)>0 then
    raise exception 'Le garde-fou de périmètre partenaire n’a pas pu être appliqué';
  end if;
  execute v_definition;
end;
$migration$;
