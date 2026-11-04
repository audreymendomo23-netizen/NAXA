begin;
do $test$
declare
  v_read text;
  v_insert text;
  v_update text;
  v_delete text;
  v_quarantine text:=pg_get_functiondef('public.lot_quarantaine_compter(uuid,integer,integer)'::regprocedure);
  v_recall text;
  v_treatment text;
begin
  select qual into v_read from pg_policies where schemaname='public' and tablename='stocks_lots' and policyname='stocks_lots_lecture';
  select with_check into v_insert from pg_policies where schemaname='public' and tablename='stocks_lots' and policyname='stocks_lots_manage_insert';
  select qual||' '||with_check into v_update from pg_policies where schemaname='public' and tablename='stocks_lots' and policyname='stocks_lots_manage_update';
  select qual into v_delete from pg_policies where schemaname='public' and tablename='stocks_lots' and policyname='stocks_lots_manage_delete';
  select qual into v_recall from pg_policies where schemaname='public' and tablename='rappels_lots' and policyname='rappels_lots_read_scope';
  select qual into v_treatment from pg_policies where schemaname='public' and tablename='rappels_lots_traitements' and policyname='rappels_lots_traitements_read';

  if position('naxa_can_manage_lots' in coalesce(v_read,''))=0
    or position('naxa_can_manage_lots' in coalesce(v_insert,''))=0
    or position('naxa_can_manage_lots' in coalesce(v_update,''))=0
    or position('naxa_can_manage_lots' in coalesce(v_delete,''))=0
    or position('naxa_can_manage_lots' in coalesce(v_recall,''))=0
    or position('naxa_can_manage_lots' in coalesce(v_treatment,''))=0 then
    raise exception 'Les policies lot doivent utiliser le helper canonique sans accorder MANAGE_LOTS à la Caisse';
  end if;
  if position('role::text' in v_quarantine)=0
    or position('client' in v_quarantine)=0
    or position('naxa_scope_allows' in v_quarantine)=0 then
    raise exception 'Le comptage doit rester reserve a une equipe active et confinee a la pharmacie';
  end if;
  if position('Comptage de quarantaine interdit pour la Caisse' in v_quarantine)>0 then
    raise exception 'La Caisse doit conserver le comptage physique audité sans mutation de stock';
  end if;
end;
$test$;
rollback;
select '278_lots_cashier_scope_guard PASS' as resultat;
