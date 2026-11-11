-- NAXA Examens — récupérer à nouveau un lien seulement si l'invitation est active.
-- La table reste inaccessible directement; la RPC exige la capacité staff_manage du centre.
begin;

create or replace function private.exam_get_staff_invite_token_impl(p_center_id uuid,p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_token uuid;
begin
  if auth.uid() is null or not private.exam_has_capability(p_center_id,'staff_manage') then
    raise exception 'Gestion du personnel du centre requise' using errcode='42501';
  end if;

  select i.token into v_token
  from public.exam_staff_invites i
  where i.id=p_invite_id
    and i.center_id=p_center_id
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at>now();

  if v_token is null then
    raise exception 'Invitation introuvable, expirée, révoquée ou déjà utilisée' using errcode='P0002';
  end if;

  return v_token;
end;
$function$;

create or replace function public.exam_get_staff_invite_token(p_center_id uuid,p_invite_id uuid)
returns uuid
language sql
security invoker
set search_path=''
as $function$
  select private.exam_get_staff_invite_token_impl(p_center_id,p_invite_id);
$function$;

revoke all on function private.exam_get_staff_invite_token_impl(uuid,uuid) from public,anon;
grant execute on function private.exam_get_staff_invite_token_impl(uuid,uuid) to authenticated;
revoke all on function public.exam_get_staff_invite_token(uuid,uuid) from public,anon;
grant execute on function public.exam_get_staff_invite_token(uuid,uuid) to authenticated;

commit;
