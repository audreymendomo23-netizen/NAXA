-- Remove a duplicate permissive SELECT policy without changing access semantics.
-- The canonical policy is retained under the table's actual French name.
begin;

drop policy if exists naxa_architecture_levels_read
  on public.naxa_architecture_niveaux;

commit;
