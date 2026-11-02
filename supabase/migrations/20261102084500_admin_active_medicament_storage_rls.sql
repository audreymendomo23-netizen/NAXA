-- NAXA — Audit 360 Admin : protéger les mutations Storage du bucket medicaments par le garde Admin actif.
-- Les anciennes politiques vérifiaient seulement profiles.role='admin'.
-- La lecture publique du bucket reste inchangée; seuls INSERT/UPDATE/DELETE sont alignés.
-- Les autres buckets Admin utilisent déjà public.is_admin()/private.is_admin().

drop policy if exists medicaments_admin_insert on storage.objects;
create policy medicaments_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'medicaments'
  and (select public.is_admin())
);

drop policy if exists medicaments_admin_update on storage.objects;
create policy medicaments_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'medicaments'
  and (select public.is_admin())
)
with check (
  bucket_id = 'medicaments'
  and (select public.is_admin())
);

drop policy if exists medicaments_admin_delete on storage.objects;
create policy medicaments_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'medicaments'
  and (select public.is_admin())
);
