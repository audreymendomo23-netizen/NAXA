-- NAXA 248 — Contrôles structurels du rattachement des remboursements à la caisse.
-- Test de contrat : aucune demande, aucun crédit ni remboursement métier n’est créé.
begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='client_credit_operations'
      and column_name='caisse_session_id' and is_nullable='YES'
  ) then
    raise exception 'FAIL: client_credit_operations.caisse_session_id absente ou non nullable';
  end if;

  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_attribute a on a.attrelid=t.oid and a.attnum=any(c.conkey)
    where t.relnamespace='public'::regnamespace
      and t.relname='client_credit_operations'
      and c.contype='f' and a.attname='caisse_session_id'
  ) then
    raise exception 'FAIL: caisse_session_id sans clé étrangère';
  end if;

  if to_regprocedure('public.client_credit_rembourser(uuid,integer,text,text)') is null then
    raise exception 'FAIL: RPC de remboursement absente';
  end if;

  if not exists (
    select 1 from pg_proc p
    where p.oid='public.client_credit_rembourser(uuid,integer,text,text)'::regprocedure
      and pg_get_functiondef(p.oid) ilike '%Ouvrez votre session de caisse%'
      and pg_get_functiondef(p.oid) ilike '%caisse_session_id%'
      and pg_get_functiondef(p.oid) ilike '%s.ouvert_par=auth.uid()%'
  ) then
    raise exception 'FAIL: le remboursement ne vérifie pas la session personnelle ouverte';
  end if;

  raise notice 'PASS: contrat de remboursement lié à une session de caisse vérifié';
end $$;

rollback;
