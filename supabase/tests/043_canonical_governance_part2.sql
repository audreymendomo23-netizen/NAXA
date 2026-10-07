begin;
do $$
declare n bigint;
begin
 select count(*) into n from public.profiles where role='client' and (niveau_hierarchique<>4 or pharmacie_id is not null or fonction_interne is not null or parent_profile_id is not null or architecture_code is not null or custom_role_code is not null);
 if n<>0 then raise exception 'PART2_FAIL_CLIENT:%',n; end if;
 select count(*) into n from public.profiles where niveau_hierarchique is not null and niveau_hierarchique not between 0 and 4;
 if n<>0 then raise exception 'PART2_FAIL_LEVEL:%',n; end if;
 select count(*) into n from public.profiles where parent_profile_id=id;
 if n<>0 then raise exception 'PART2_FAIL_SELF_PARENT:%',n; end if;
end $$;
do $$
begin
 begin
  update public.profiles set niveau_hierarchique=3 where role='client';
  raise exception 'PART2_FAIL_INVALID_CLIENT_LEVEL_ACCEPTED';
 exception when check_violation then null;
 end;
end $$;
rollback;