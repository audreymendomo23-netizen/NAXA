-- Preserve partner/self read scopes while removing overlapping Admin ALL SELECT.
-- Admin retains visibility of all rows; all partner mutations remain Admin-only.
drop policy if exists partner_members_admin_all on public.partner_members;
alter policy partner_members_self_read
  on public.partner_members
  using (
    user_id = (select auth.uid())
    or (select is_admin())
  );

create policy partner_members_admin_insert
  on public.partner_members
  as permissive for insert to authenticated
  with check ((select is_admin()));
create policy partner_members_admin_update
  on public.partner_members
  as permissive for update to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));
create policy partner_members_admin_delete
  on public.partner_members
  as permissive for delete to authenticated
  using ((select is_admin()));

drop policy if exists partner_universes_admin_all on public.partner_universes;
alter policy partner_universes_member_read
  on public.partner_universes
  using (
    (select is_admin())
    or exists (
      select 1
      from public.partner_members pm
      join public.partners pa on pa.id = pm.partner_id
      where pm.partner_id = partner_universes.partner_id
        and pm.user_id = (select auth.uid())
        and pa.status = 'active'
    )
  );

create policy partner_universes_admin_insert
  on public.partner_universes
  as permissive for insert to authenticated
  with check ((select is_admin()));
create policy partner_universes_admin_update
  on public.partner_universes
  as permissive for update to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));
create policy partner_universes_admin_delete
  on public.partner_universes
  as permissive for delete to authenticated
  using ((select is_admin()));

drop policy if exists partners_admin_all on public.partners;
alter policy partners_member_read
  on public.partners
  using (
    (select is_admin())
    or (
      exists (
        select 1
        from public.partner_members pm
        where pm.partner_id = partners.id
          and pm.user_id = (select auth.uid())
      )
      and status = 'active'
    )
  );

create policy partners_admin_insert
  on public.partners
  as permissive for insert to authenticated
  with check ((select is_admin()));
create policy partners_admin_update
  on public.partners
  as permissive for update to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));
create policy partners_admin_delete
  on public.partners
  as permissive for delete to authenticated
  using ((select is_admin()));
