-- Lot 16 — calendrier haute surveillance par pharmacie.
begin;
create table if not exists public.naxa_security_high_surveillance_policies (
 id uuid primary key default gen_random_uuid(),
 pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
 scope_key text not null default 'pharmacy' check(scope_key='pharmacy'),
 enabled boolean not null default false,
 timezone text not null default 'Africa/Douala',
 schedule_windows jsonb not null default '[]'::jsonb,
 exceptions jsonb not null default '{}'::jsonb,
 policy_version bigint not null default 1 check(policy_version>0),
 expires_at timestamptz not null,
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default pg_catalog.now(),
 updated_at timestamptz not null default pg_catalog.now(),
 constraint naxa_high_surveillance_windows_check check(pg_catalog.jsonb_typeof(schedule_windows)='array' and pg_catalog.jsonb_array_length(schedule_windows)<=32),
 constraint naxa_high_surveillance_exceptions_check check(pg_catalog.jsonb_typeof(exceptions)='object' and pg_catalog.pg_column_size(exceptions)<=8192),
 constraint naxa_high_surveillance_timezone_check check(pg_catalog.length(timezone) between 1 and 80),
 constraint naxa_high_surveillance_scope_unique unique(pharmacie_id,scope_key)
);
create index if not exists naxa_high_surveillance_pharmacy_expiry_idx on public.naxa_security_high_surveillance_policies(pharmacie_id,expires_at desc);
alter table public.naxa_security_high_surveillance_policies enable row level security;
alter table public.naxa_security_high_surveillance_policies force row level security;
revoke all on public.naxa_security_high_surveillance_policies from public,anon,authenticated;
grant select,insert,update,delete on public.naxa_security_high_surveillance_policies to service_role;

create or replace function public.naxa_security_save_high_surveillance_policy(
 p_pharmacie_id uuid,p_actor_id uuid,p_enabled boolean,p_timezone text,
 p_schedule_windows jsonb,p_exceptions jsonb,p_expires_at timestamptz
) returns table(policy_id uuid,policy_version bigint,expires_at timestamptz)
language plpgsql security invoker set search_path=''
as $function$
declare v_saved public.naxa_security_high_surveillance_policies%rowtype;
begin
 if p_pharmacie_id is null or p_actor_id is null or p_enabled is null
  or p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone)
  or p_schedule_windows is null or pg_catalog.jsonb_typeof(p_schedule_windows)<>'array'
  or pg_catalog.jsonb_array_length(p_schedule_windows)>32
  or p_exceptions is null or pg_catalog.jsonb_typeof(p_exceptions)<>'object'
  or pg_catalog.pg_column_size(p_exceptions)>8192
  or p_expires_at is null or p_expires_at<=pg_catalog.now()
  or p_expires_at>pg_catalog.now()+interval '7 days'
 then raise exception using errcode='22023',message='Invalid high surveillance policy'; end if;
 insert into public.naxa_security_high_surveillance_policies(
  pharmacie_id,scope_key,enabled,timezone,schedule_windows,exceptions,policy_version,
  expires_at,created_by,updated_by,updated_at
 ) values(p_pharmacie_id,'pharmacy',p_enabled,p_timezone,p_schedule_windows,p_exceptions,
  1,p_expires_at,p_actor_id,p_actor_id,pg_catalog.now())
 on conflict(pharmacie_id,scope_key) do update set
  enabled=excluded.enabled,timezone=excluded.timezone,schedule_windows=excluded.schedule_windows,
  exceptions=excluded.exceptions,policy_version=public.naxa_security_high_surveillance_policies.policy_version+1,
  expires_at=excluded.expires_at,updated_by=excluded.updated_by,updated_at=pg_catalog.now()
 returning * into v_saved;
 insert into public.naxa_security_access_audit(
  pharmacie_id,actor_id,actor_role,action,resource_type,resource_id,justification,audit_metadata
 ) values(p_pharmacie_id,p_actor_id,'promoteur','recording_policy_update','recording_policy',v_saved.id,
  'Modification du calendrier de haute surveillance',
  pg_catalog.jsonb_build_object('policy_version',v_saved.policy_version,'enabled',v_saved.enabled,
   'timezone',v_saved.timezone,'window_count',pg_catalog.jsonb_array_length(v_saved.schedule_windows),
   'exceptions_bytes',pg_catalog.pg_column_size(v_saved.exceptions),'expires_at',v_saved.expires_at));
 return query select v_saved.id,v_saved.policy_version,v_saved.expires_at;
end;
$function$;
revoke all on function public.naxa_security_save_high_surveillance_policy(uuid,uuid,boolean,text,jsonb,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.naxa_security_save_high_surveillance_policy(uuid,uuid,boolean,text,jsonb,jsonb,timestamptz) to service_role;

create or replace function public.naxa_security_is_high_surveillance(p_pharmacie_id uuid,p_at timestamptz)
returns boolean language plpgsql stable security invoker set search_path=''
as $function$
declare
 v_policy public.naxa_security_high_surveillance_policies%rowtype;
 v_local timestamp without time zone; v_date text; v_day integer; v_prev integer; v_minute integer;
 v_exception text; v_window jsonb; v_start integer; v_end integer; v_days jsonb; v_match boolean; v_prev_match boolean; v_time text;
begin
 if p_pharmacie_id is null or p_at is null then return false; end if;
 select * into v_policy from public.naxa_security_high_surveillance_policies where pharmacie_id=p_pharmacie_id and scope_key='pharmacy' limit 1;
 if not found or not v_policy.enabled or v_policy.expires_at<=pg_catalog.now() then return false; end if;
 v_local:=p_at at time zone v_policy.timezone;
 v_date:=pg_catalog.to_char(v_local::date,'YYYY-MM-DD');
 v_day:=extract(dow from v_local)::integer; v_prev:=(v_day+6)%7;
 v_minute:=extract(hour from v_local)::integer*60+extract(minute from v_local)::integer;
 v_exception:=v_policy.exceptions->>v_date;
 if v_exception='armed' then return true; end if;
 if v_exception='disarmed' then return false; end if;
 for v_window in select value from pg_catalog.jsonb_array_elements(v_policy.schedule_windows) loop
  v_days:=v_window->'days';
  v_time:=v_window->>'start'; v_start:=split_part(v_time,':',1)::integer*60+split_part(v_time,':',2)::integer;
  v_time:=v_window->>'end'; v_end:=split_part(v_time,':',1)::integer*60+split_part(v_time,':',2)::integer;
  select exists(select 1 from pg_catalog.jsonb_array_elements_text(v_days) d(value) where d.value ~ '^[0-6]$' and d.value::integer=v_day) into v_match;
  if v_start<v_end then
   if v_match and v_minute>=v_start and v_minute<v_end then return true; end if;
  else
   select exists(select 1 from pg_catalog.jsonb_array_elements_text(v_days) d(value) where d.value ~ '^[0-6]$' and d.value::integer=v_prev) into v_prev_match;
   if (v_match and v_minute>=v_start) or (v_prev_match and v_minute<v_end) then return true; end if;
  end if;
 end loop;
 return false;
exception when others then return false;
end;
$function$;
revoke all on function public.naxa_security_is_high_surveillance(uuid,timestamptz) from public,anon,authenticated;

create or replace function public.naxa_security_apply_high_surveillance_priority()
returns trigger language plpgsql security invoker set search_path=''
as $function$
begin
 if new.event_type in ('motion','intrusion','line_crossing','after_hours_presence')
  and public.naxa_security_is_high_surveillance(new.pharmacie_id,new.detected_at) then new.severity:='high'; end if;
 return new;
end;
$function$;
revoke all on function public.naxa_security_apply_high_surveillance_priority() from public,anon,authenticated;
drop trigger if exists naxa_security_high_surveillance_event_priority on public.naxa_security_events;
create trigger naxa_security_high_surveillance_event_priority before insert on public.naxa_security_events
for each row execute function public.naxa_security_apply_high_surveillance_priority();
commit;
