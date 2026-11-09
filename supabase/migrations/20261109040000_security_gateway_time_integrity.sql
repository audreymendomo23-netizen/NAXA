-- NAXA Security — lot 14 : mesures d'intégrité temporelle des passerelles.
begin;
create table if not exists public.naxa_security_gateway_time_samples (
 id uuid primary key default gen_random_uuid(),
 pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
 gateway_id uuid not null references public.naxa_security_gateways(id) on delete cascade,
 ntp_server text not null,
 ntp_stratum smallint not null,
 offset_ms bigint not null,
 round_trip_ms integer not null,
 clock_status text not null,
 measured_at timestamptz not null,
 received_at timestamptz not null default pg_catalog.now(),
 constraint naxa_security_gateway_time_samples_server_check check (ntp_server ~ '^[A-Za-z0-9.-]{1,253}$'),
 constraint naxa_security_gateway_time_samples_stratum_check check (ntp_stratum between 1 and 15),
 constraint naxa_security_gateway_time_samples_offset_check check (offset_ms between -86400000 and 86400000),
 constraint naxa_security_gateway_time_samples_round_trip_check check (round_trip_ms between 0 and 10000),
 constraint naxa_security_gateway_time_samples_status_check check (clock_status in ('synchronized','warning'))
);
create index if not exists naxa_security_gateway_time_samples_latest_idx on public.naxa_security_gateway_time_samples(gateway_id,measured_at desc);
alter table public.naxa_security_gateway_time_samples enable row level security;
alter table public.naxa_security_gateway_time_samples force row level security;
revoke all on public.naxa_security_gateway_time_samples from public,anon,authenticated;
grant select,insert,update,delete on public.naxa_security_gateway_time_samples to service_role;

create or replace function public.naxa_security_record_gateway_time_sample(
 p_gateway_id uuid,p_pharmacie_id uuid,p_ntp_server text,p_ntp_stratum smallint,
 p_offset_ms bigint,p_round_trip_ms integer,p_clock_status text,p_measured_at timestamptz
) returns uuid language plpgsql security invoker set search_path=''
as $function$
declare v_gateway public.naxa_security_gateways%rowtype; v_id uuid:=gen_random_uuid();
begin
 if p_gateway_id is null or p_pharmacie_id is null or p_ntp_server is null
   or p_ntp_server !~ '^[A-Za-z0-9.-]{1,253}$' or p_ntp_stratum not between 1 and 15
   or p_offset_ms not between -86400000 and 86400000 or p_round_trip_ms not between 0 and 10000
   or p_clock_status not in ('synchronized','warning') or p_measured_at is null then
   raise exception using errcode='22023',message='Invalid gateway time sample';
 end if;
 select * into v_gateway from public.naxa_security_gateways where id=p_gateway_id for update;
 if not found or v_gateway.pharmacie_id<>p_pharmacie_id then
   raise exception using errcode='23503',message='Gateway pharmacy mismatch';
 end if;
 insert into public.naxa_security_gateway_time_samples(id,pharmacie_id,gateway_id,ntp_server,ntp_stratum,offset_ms,round_trip_ms,clock_status,measured_at)
 values(v_id,p_pharmacie_id,p_gateway_id,p_ntp_server,p_ntp_stratum,p_offset_ms,p_round_trip_ms,p_clock_status,p_measured_at);
 insert into public.naxa_security_access_audit(pharmacie_id,actor_id,actor_role,action,resource_type,resource_id,justification,audit_metadata)
 values(p_pharmacie_id,null,'system','device_update','gateway',p_gateway_id,'Mesure NTP de la passerelle',
  pg_catalog.jsonb_build_object('time_sample_id',v_id,'ntp_server',p_ntp_server,'ntp_stratum',p_ntp_stratum,
  'offset_ms',p_offset_ms,'round_trip_ms',p_round_trip_ms,'clock_status',p_clock_status,'measured_at',p_measured_at));
 return v_id;
end;
$function$;
revoke all on function public.naxa_security_record_gateway_time_sample(uuid,uuid,text,smallint,bigint,integer,text,timestamptz) from public,anon,authenticated;
grant execute on function public.naxa_security_record_gateway_time_sample(uuid,uuid,text,smallint,bigint,integer,text,timestamptz) to service_role;
comment on table public.naxa_security_gateway_time_samples is 'Historique privé SNTP passerelle ; ne certifie pas l''horloge caméra/NVR.';
commit;
