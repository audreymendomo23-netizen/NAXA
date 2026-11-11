-- NAXA Examens — compatibilité des synchronisations partenaire avec l'index partiel des affectations.
-- L'historique des affectations révoquées est conservé; ON CONFLICT sans cible couvre l'index partiel.
begin;

create or replace function private.exam_sync_partner_directors()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  insert into public.exam_staff_assignments(center_id,user_id,role_key,is_active,active_role,assigned_by)
  select new.id,pm.user_id,'directeur',true,
    not exists(
      select 1 from public.exam_staff_assignments x
      where x.center_id=new.id and x.user_id=pm.user_id
        and x.is_active and x.active_role and x.revoked_at is null
    ),pm.user_id
  from public.partner_members pm
  join public.profiles p on p.id=pm.user_id and p.actif is true
  where pm.partner_id=new.partner_id
    and pm.member_role in ('owner','manager')
  on conflict do nothing;
  return new;
end;
$function$;

create or replace function private.exam_sync_new_partner_director()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if tg_op='DELETE' then
    update public.exam_staff_assignments
       set is_active=false,active_role=false,revoked_at=now(),updated_at=now()
     where role_key='directeur' and user_id=old.user_id
       and center_id in (select id from public.exam_centers where partner_id=old.partner_id)
       and is_active;
    return old;
  end if;

  if new.member_role in ('owner','manager') then
    insert into public.exam_staff_assignments(center_id,user_id,role_key,is_active,active_role,assigned_by)
    select c.id,new.user_id,'directeur',true,
      not exists(
        select 1 from public.exam_staff_assignments x
        where x.center_id=c.id and x.user_id=new.user_id
          and x.is_active and x.active_role and x.revoked_at is null
      ),new.user_id
    from public.exam_centers c
    join public.profiles p on p.id=new.user_id and p.actif is true
    where c.partner_id=new.partner_id
    on conflict do nothing;
  else
    update public.exam_staff_assignments
       set is_active=false,active_role=false,revoked_at=now(),updated_at=now()
     where role_key='directeur' and user_id=new.user_id
       and center_id in (select id from public.exam_centers where partner_id=new.partner_id)
       and is_active;
  end if;
  return new;
end;
$function$;

commit;
