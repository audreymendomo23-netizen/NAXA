-- NAXA — verified thin wrappers remain INVOKER and preserve guarded delegation.
do $test$
declare
  v_sig regprocedure;
  v_error text;
begin
  foreach v_sig in array array[
    'public.assurance_configurer_convention(uuid,uuid,text,date,date,numeric,bigint,bigint)'::regprocedure,
    'public.naxa_select_active_role(text,uuid)'::regprocedure,
    'public.can_access_pharmacy(uuid)'::regprocedure,
    'public.stats_pilotage_scope(integer)'::regprocedure
  ]
  loop
    if (select prosecdef from pg_proc where oid=v_sig) then
      raise exception 'Public wrapper % must be SECURITY INVOKER',v_sig;
    end if;
    if not has_function_privilege('authenticated',v_sig,'EXECUTE') then
      raise exception 'Authenticated caller cannot execute wrapper %',v_sig;
    end if;
    if has_function_privilege('anon',v_sig,'EXECUTE') then
      raise exception 'Anonymous caller can execute authenticated wrapper %',v_sig;
    end if;
  end loop;

  if not has_function_privilege('authenticated',
       'private.stats_pilotage_scope(integer)'::regprocedure,'EXECUTE') then
    raise exception 'Authenticated wrapper cannot delegate to the private pilotage guard';
  end if;
  if has_function_privilege('anon',
       'private.stats_pilotage_scope(integer)'::regprocedure,'EXECUTE') then
    raise exception 'Anonymous role can execute private pilotage guard';
  end if;

  -- With no JWT identity, the internal guards must continue to reject access.
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims','{"role":"authenticated"}',true);

  if public.can_access_pharmacy('00000000-0000-0000-0000-000000000001'::uuid) is distinct from false then
    raise exception 'Pharmacy access helper must deny an anonymous identity';
  end if;

  begin
    perform public.naxa_select_active_role('admin',null);
    raise exception 'Active-role wrapper accepted a missing identity';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error='Active-role wrapper accepted a missing identity' then raise; end if;
    if v_error not ilike '%Connexion requise%' then
      raise exception 'Unexpected active-role denial: %',v_error;
    end if;
  end;

  begin
    perform public.stats_pilotage_scope(7);
    raise exception 'Pilotage wrapper accepted a missing identity';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error='Pilotage wrapper accepted a missing identity' then raise; end if;
    if v_error not ilike '%Connexion requise%' then
      raise exception 'Unexpected pilotage denial: %',v_error;
    end if;
  end;

  begin
    perform public.assurance_configurer_convention(
      '00000000-0000-0000-0000-000000000001'::uuid,
      '00000000-0000-0000-0000-000000000002'::uuid,
      'TEST-SECURITY-INVOKER',
      current_date,null,80,100000,0
    );
    raise exception 'Assurance wrapper accepted a missing identity';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error='Assurance wrapper accepted a missing identity' then raise; end if;
    if v_error not ilike '%Données ou poste non autorisés%' then
      raise exception 'Unexpected assurance denial: %',v_error;
    end if;
  end;
end
$test$;

select 'SECURITY_INVOKER_WRAPPERS PASS' as result;
