-- NAXA 271 — Storage medicaments : mutations réservées à un Admin actif.
-- Test structurel sur Replay : le bucket medicaments peut ne pas exister dans les fixtures du Replay.
begin;

do $storage$
declare
  v_insert text;
  v_update text;
  v_update_check text;
  v_delete text;
  v_public_read text;
begin
  if not (select relrowsecurity from pg_class where oid='storage.objects'::regclass) then
    raise exception '271.1 : RLS désactivée sur storage.objects';
  end if;

  select with_check into v_insert from pg_policies
  where schemaname='storage' and tablename='objects' and policyname='medicaments_admin_insert'
    and cmd='INSERT' and roles @> array['authenticated']::name[];
  if v_insert is null or v_insert not ilike '%medicaments%' or v_insert not ilike '%is_admin%'
     or v_insert ilike '%role_type%' then
    raise exception '271.2 : INSERT medicaments ne requiert pas un Admin actif';
  end if;

  select qual,with_check into v_update,v_update_check from pg_policies
  where schemaname='storage' and tablename='objects' and policyname='medicaments_admin_update'
    and cmd='UPDATE' and roles @> array['authenticated']::name[];
  if v_update is null or v_update not ilike '%medicaments%' or v_update not ilike '%is_admin%'
     or v_update ilike '%role_type%' or v_update_check is null
     or v_update_check not ilike '%medicaments%' or v_update_check not ilike '%is_admin%'
     or v_update_check ilike '%role_type%' then
    raise exception '271.3 : UPDATE medicaments ne requiert pas un Admin actif dans USING et WITH CHECK';
  end if;

  select qual into v_delete from pg_policies
  where schemaname='storage' and tablename='objects' and policyname='medicaments_admin_delete'
    and cmd='DELETE' and roles @> array['authenticated']::name[];
  if v_delete is null or v_delete not ilike '%medicaments%' or v_delete not ilike '%is_admin%'
     or v_delete ilike '%role_type%' then
    raise exception '271.4 : DELETE medicaments ne requiert pas un Admin actif';
  end if;

  select qual into v_public_read from pg_policies
  where schemaname='storage' and tablename='objects' and policyname='medicaments_public_read'
    and cmd='SELECT';
  -- Le Replay peut ne pas embarquer le bucket medicaments ni sa policy publique.
  -- Si elle existe, sa portée publique bucket_id doit rester inchangée.
  if v_public_read is not null and (
       v_public_read not ilike '%bucket_id%'
       or v_public_read ilike '%is_admin%'
     ) then
    raise exception '271.5 : la politique de lecture publique existante a été modifiée';
  end if;
end
$storage$;

select 'PASS — 271 : Storage medicaments INSERT/UPDATE/DELETE Admin actif, lecture publique inchangée' as result;
rollback;
