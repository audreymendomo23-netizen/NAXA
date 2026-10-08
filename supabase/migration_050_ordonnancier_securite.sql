-- NAXA ERP-007 — RLS / exposition minimale
alter table public.ordonnancier enable row level security;
alter table public.registre_substances_controlees enable row level security;
revoke all on public.ordonnancier,public.registre_substances_controlees from anon,authenticated;
grant select on public.ordonnancier,public.registre_substances_controlees to authenticated;
create policy ordonnancier_staff_read on public.ordonnancier for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.actif and p.pharmacie_id=ordonnancier.pharmacie_id and (p.role='promoteur' or p.fonction_interne='pharmacien_assistant'))
);
create policy registre_substances_staff_read on public.registre_substances_controlees for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.actif and p.pharmacie_id=registre_substances_controlees.pharmacie_id and (p.role='promoteur' or p.fonction_interne='pharmacien_assistant'))
);