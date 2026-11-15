do $test$
declare
  v_policy text;
begin
  select qual into v_policy
  from pg_policies
  where schemaname='public'
    and tablename='produits'
    and policyname='produits_authenticated_live_offer_read';

  if v_policy is null then
    raise exception 'Policy SELECT authentifiée absente';
  end if;

  if position('marketplace_produit_visible' in v_policy)=0
     or position('is_admin' in v_policy)=0 then
    raise exception 'Les offres Marketplace publiques et la lecture technique Admin doivent rester possibles';
  end if;

  if position('created_by_pharmacie_id is not null' in lower(v_policy))=0
     or position('naxa_scope_allows' in v_policy)=0
     or position('created_by_pharmacie_id is null' in lower(v_policy))=0 then
    raise exception 'Les fiches propriétaires doivent être limitées au scope du propriétaire, les fiches historiques partagées conservées';
  end if;

  if position('my_pharmacie()' in v_policy)=0
     or position('naxa_promoteur_valide' in v_policy)=0 then
    raise exception 'La lecture des anciennes fiches partagées doit garder les règles de rôle existantes';
  end if;
end
$test$;

select 'Private owned product fiche SELECT is owner-scoped; public offers, Admin read-only and legacy shared catalogue retained: PASS' as result;
