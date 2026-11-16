begin;

drop policy if exists naxa_session_audit_read_scope on public.naxa_session_audit;

create policy naxa_session_audit_read_scope
on public.naxa_session_audit
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
  or (
    public.naxa_business_function() = 'promoteur'
    and public.naxa_promoteur_valide(auth.uid())
    and exists (
      select 1
      from public.promoteur_pharmacies pp
      where pp.promoteur_id = auth.uid()
        and pp.pharmacie_id = naxa_session_audit.pharmacie_id
        and pp.actif = true
    )
  )
);

commit;
