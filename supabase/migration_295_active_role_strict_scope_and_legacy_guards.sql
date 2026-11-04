-- NAXA 295 — espace actif canonique, isolation stricte par pharmacie et compatibilité des postes autonomes.
begin;

create or replace function public.naxa_business_function(p_profile uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path=''
as $function$
  select coalesce(
    (
      select ar.role_code
      from public.naxa_profile_active_roles ar
      join public.profiles p on p.id=ar.profile_id and p.actif=true
      where ar.profile_id=p_profile
        and (
          (ar.role_code='admin' and p.role::text='admin' and ar.pharmacie_id is null)
          or (ar.role_code='client' and p.role::text='client' and ar.pharmacie_id is null)
          or (ar.role_code='promoteur' and p.role::text='promoteur'
              and ar.pharmacie_id is null and private.naxa_promoteur_valide(p.id))
          or (ar.role_code='pharmacie' and p.role::text='pharmacie'
              and ar.pharmacie_id=p.pharmacie_id
              and exists(select 1 from public.pharmacies ph where ph.id=ar.pharmacie_id and ph.actif))
          or (ar.role_code='caisse' and p.role::text='caisse'
              and ar.pharmacie_id=p.pharmacie_id
              and exists(select 1 from public.pharmacies ph where ph.id=ar.pharmacie_id and ph.actif))
          or exists(
            select 1
            from public.naxa_professional_assignments a
            join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true
            where a.profile_id=p.id
              and a.role_code=ar.role_code
              and a.pharmacie_id=ar.pharmacie_id
              and a.statut='active'
              and a.commence_at<=now()
              and (a.expire_at is null or a.expire_at>now())
          )
        )
      limit 1
    ),
    (
      select case
        when p.role::text='admin' then 'admin'
        when p.role::text='client' then 'client'
        when p.role::text='promoteur' and private.naxa_promoteur_valide(p.id) then 'promoteur'
        when p.role::text='pharmacie'
          and exists(select 1 from public.pharmacies ph where ph.id=p.pharmacie_id and ph.actif)
          then 'pharmacie'
        when p.role::text='caisse'
          and exists(select 1 from public.pharmacies ph where ph.id=p.pharmacie_id and ph.actif)
          then 'caisse'
        else null
      end
      from public.profiles p
      where p.id=p_profile and p.actif=true
    )
  )
$function$;

create or replace function public.naxa_active_role_pharmacy(p_profile uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path=''
as $function$
  select case
    when ar.profile_id is not null
      and ar.role_code=public.naxa_business_function(p.id)
      then ar.pharmacie_id
    when public.naxa_business_function(p.id) in ('pharmacie','caisse')
      then p.pharmacie_id
    else null
  end
  from public.profiles p
  left join public.naxa_profile_active_roles ar on ar.profile_id=p.id
  where p.id=p_profile and p.actif=true
$function$;

revoke all on function public.naxa_business_function(uuid) from public,anon;
grant execute on function public.naxa_business_function(uuid) to authenticated,service_role;
revoke all on function public.naxa_active_role_pharmacy(uuid) from public,anon;
grant execute on function public.naxa_active_role_pharmacy(uuid) to authenticated,service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select public.naxa_business_function(auth.uid())='admin'
$function$;
revoke all on function private.is_admin() from public,anon;
grant execute on function private.is_admin() to authenticated,service_role;

create or replace function private.naxa_scope_allows(
  p_profile uuid,
  p_pharmacie uuid,
  p_scope text default 'PHARMACIE'
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
select case
  when p_profile is null then false
  when p_scope='RESEAU' then
    public.naxa_business_function(p_profile)='promoteur'
    and private.naxa_promoteur_valide(p_profile)
    and exists(
      select 1 from public.promoteur_pharmacies pp
      join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true
      where pp.promoteur_id=p_profile and pp.actif
        and (p_pharmacie is null or pp.pharmacie_id=p_pharmacie)
    )
  when p_scope='PHARMACIE' then
    exists(
      select 1 from public.profiles p
      join public.pharmacies ph on ph.id=p_pharmacie and ph.actif=true
      where p.id=p_profile and p.actif
        and (
          public.naxa_business_function(p.id)='admin'
          or (
            public.naxa_business_function(p.id)='promoteur'
            and private.naxa_promoteur_valide(p.id)
            and exists(select 1 from public.promoteur_pharmacies pp
              where pp.promoteur_id=p.id and pp.pharmacie_id=p_pharmacie and pp.actif)
          )
          or (
            public.naxa_business_function(p.id) not in ('admin','client','promoteur')
            and public.naxa_active_role_pharmacy(p.id)=p_pharmacie
            and (
              (p.role::text in ('pharmacie','caisse')
                and p.role::text=public.naxa_business_function(p.id)
                and p.pharmacie_id=p_pharmacie)
              or exists(
                select 1 from public.naxa_professional_assignments a
                where a.profile_id=p.id
                  and a.role_code=public.naxa_business_function(p.id)
                  and a.pharmacie_id=p_pharmacie
                  and a.statut='active'
                  and a.commence_at<=now()
                  and (a.expire_at is null or a.expire_at>now())
              )
            )
          )
        )
    )
  when p_scope='POSTE_CAISSE' then
    public.naxa_business_function(p_profile)='caisse'
    and public.naxa_active_role_pharmacy(p_profile)=p_pharmacie
    and exists(select 1 from public.pharmacies ph where ph.id=p_pharmacie and ph.actif=true)
    and (
      exists(select 1 from public.profiles p
        where p.id=p_profile and p.actif and p.role::text='caisse'
          and p.pharmacie_id=p_pharmacie)
      or exists(select 1 from public.naxa_professional_assignments a
        where a.profile_id=p_profile and a.pharmacie_id=p_pharmacie
          and a.role_code='caisse' and a.statut='active'
          and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now()))
    )
  else false
end
$function$;
revoke all on function private.naxa_scope_allows(uuid,uuid,text) from public,anon;
grant execute on function private.naxa_scope_allows(uuid,uuid,text) to authenticated,service_role;

create or replace function private.naxa_sync_active_professional_role()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_selected public.naxa_profile_active_roles%rowtype;
  v_next public.naxa_professional_assignments%rowtype;
  v_profile_role text;
  v_profile_pharmacy uuid;
  v_effective_role text;
begin
  if new.statut='active' and new.commence_at<=now()
     and (new.expire_at is null or new.expire_at>now())
     and exists(select 1 from public.profiles p where p.id=new.profile_id and p.actif=true) then
    select ar.* into v_selected
    from public.naxa_profile_active_roles ar
    where ar.profile_id=new.profile_id
    limit 1;

    if found then
      v_effective_role:=public.naxa_business_function(new.profile_id);
      if v_effective_role=v_selected.role_code
         and public.naxa_active_role_pharmacy(new.profile_id) is not distinct from v_selected.pharmacie_id then
        return new;
      end if;
    end if;

    insert into public.naxa_profile_active_roles(profile_id,role_code,pharmacie_id,selected_at,updated_at)
    values(new.profile_id,new.role_code,new.pharmacie_id,now(),now())
    on conflict(profile_id) do update set
      role_code=excluded.role_code,
      pharmacie_id=excluded.pharmacie_id,
      selected_at=now(),
      updated_at=now();

    update public.profiles
    set fonction_interne=new.role_code,pharmacie_id=new.pharmacie_id
    where id=new.profile_id;

  elsif tg_op='UPDATE' and old.statut='active'
     and (new.statut<>'active' or new.commence_at>now() or (new.expire_at is not null and new.expire_at<=now())) then
    if exists(select 1 from public.naxa_profile_active_roles ar
      where ar.profile_id=old.profile_id
        and ar.role_code=old.role_code
        and ar.pharmacie_id=old.pharmacie_id) then

      select a.* into v_next
      from public.naxa_professional_assignments a
      join public.profiles p on p.id=a.profile_id and p.actif=true
      join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true
      where a.profile_id=old.profile_id
        and a.id<>new.id
        and a.statut='active'
        and a.commence_at<=now()
        and (a.expire_at is null or a.expire_at>now())
      order by a.accorde_at desc,a.created_at desc
      limit 1;

      if found then
        update public.naxa_profile_active_roles
        set role_code=v_next.role_code,pharmacie_id=v_next.pharmacie_id,
            selected_at=now(),updated_at=now()
        where profile_id=old.profile_id;
        update public.profiles
        set fonction_interne=v_next.role_code,pharmacie_id=v_next.pharmacie_id
        where id=old.profile_id;
      else
        delete from public.naxa_profile_active_roles where profile_id=old.profile_id;
        select role::text,pharmacie_id into v_profile_role,v_profile_pharmacy
        from public.profiles where id=old.profile_id;
        update public.profiles
        set fonction_interne=null,
            pharmacie_id=case when v_profile_role in ('pharmacie','caisse')
              then v_profile_pharmacy else null end
        where id=old.profile_id;
      end if;
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.naxa_select_active_role(
  p_role_code text,
  p_pharmacie_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_profile public.profiles%rowtype;
  v_role public.naxa_roles%rowtype;
  v_allowed boolean:=false;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_profile from public.profiles where id=v_uid and actif=true for update;
  if not found then raise exception 'Profil actif introuvable'; end if;

  if p_role_code is null then
    delete from public.naxa_profile_active_roles where profile_id=v_uid;
    update public.profiles
      set fonction_interne=null,
          pharmacie_id=case when v_profile.role::text in ('pharmacie','caisse')
            then v_profile.pharmacie_id else null end
    where id=v_uid;
    return true;
  end if;

  select * into v_role from public.naxa_roles
  where code=p_role_code and actif=true;
  if not found then raise exception 'Rôle inconnu ou inactif'; end if;

  if p_role_code in ('admin','client','promoteur') then
    v_allowed:=v_profile.role::text=p_role_code;
    if p_role_code='promoteur' then
      v_allowed:=v_allowed and private.naxa_promoteur_valide(v_uid);
    end if;
    if p_pharmacie_id is not null then v_allowed:=false; end if;
  elsif p_role_code='pharmacie' and v_profile.role::text='pharmacie' then
    v_allowed:=p_pharmacie_id is not null
      and p_pharmacie_id=v_profile.pharmacie_id
      and exists(select 1 from public.pharmacies ph
        where ph.id=p_pharmacie_id and ph.actif=true);
  elsif p_role_code='caisse' and v_profile.role::text='caisse' then
    v_allowed:=p_pharmacie_id is not null
      and p_pharmacie_id=v_profile.pharmacie_id
      and exists(select 1 from public.pharmacies ph
        where ph.id=p_pharmacie_id and ph.actif=true);
  else
    v_allowed:=p_pharmacie_id is not null and exists(
      select 1
      from public.naxa_professional_assignments a
      join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true
      where a.profile_id=v_uid
        and a.role_code=p_role_code
        and a.pharmacie_id=p_pharmacie_id
        and a.statut='active'
        and a.commence_at<=now()
        and (a.expire_at is null or a.expire_at>now())
    );
  end if;

  if not v_allowed then raise exception 'Ce rôle n’est pas attribué à ce compte pour cette pharmacie'; end if;

  insert into public.naxa_profile_active_roles(profile_id,role_code,pharmacie_id,selected_at,updated_at)
  values(v_uid,p_role_code,p_pharmacie_id,now(),now())
  on conflict(profile_id) do update set
    role_code=excluded.role_code,
    pharmacie_id=excluded.pharmacie_id,
    selected_at=now(),
    updated_at=now();

  update public.profiles
  set fonction_interne=case
        when p_role_code in ('admin','client','pharmacie','promoteur') then null
        else p_role_code
      end,
      pharmacie_id=case
        when p_role_code in ('admin','client','promoteur') then null
        when p_role_code in ('pharmacie','caisse') then v_profile.pharmacie_id
        else p_pharmacie_id
      end
  where id=v_uid;
  return true;
end;
$function$;

revoke all on function public.naxa_select_active_role(text,uuid) from public,anon;
grant execute on function public.naxa_select_active_role(text,uuid) to authenticated,service_role;

create or replace function public.naxa_has_active_professional_assignment(
  p_profile uuid,p_pharmacie uuid,p_fonction text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select p_profile is not null
    and p_pharmacie is not null
    and p_fonction is not null
    and (p_profile=(select auth.uid()) or public.is_admin())
    and public.naxa_business_function(p_profile)=p_fonction
    and public.naxa_active_role_pharmacy(p_profile)=p_pharmacie
    and exists(
      select 1 from public.naxa_professional_assignments a
      join public.profiles p on p.id=a.profile_id and p.actif=true
      join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true
      where a.profile_id=p_profile
        and a.pharmacie_id=p_pharmacie
        and a.role_code=p_fonction
        and a.statut='active'
        and a.commence_at<=now()
        and (a.expire_at is null or a.expire_at>now())
    )
$function$;
revoke all on function public.naxa_has_active_professional_assignment(uuid,uuid,text) from public,anon;
grant execute on function public.naxa_has_active_professional_assignment(uuid,uuid,text) to authenticated,service_role;

create or replace function public.my_pharmacie()
returns uuid
language sql
stable
security definer
set search_path=''
as $function$
  select public.naxa_active_role_pharmacy(auth.uid())
  where public.naxa_business_function(auth.uid()) in
    ('pharmacie','caisse','responsable','comptable','pharmacien','gestionnaire_stock','magasinier','livreur')
$function$;
revoke all on function public.my_pharmacie() from public,anon;
grant execute on function public.my_pharmacie() to authenticated,service_role;

create or replace function public.stats_caisse_scope(p_jours integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  uid uuid:=(select auth.uid());
  pid uuid;
  debut timestamptz:=now()-make_interval(days=>greatest(1,least(coalesce(p_jours,7),365)));
begin
  if uid is null or public.naxa_business_function(uid)<>'caisse' then
    raise exception 'Accès Caisse refusé';
  end if;
  pid:=public.naxa_active_role_pharmacy(uid);
  if pid is null or not public.authorize('VIEW_CAISSE_PILOTAGE',pid,'POSTE_CAISSE') then
    raise exception 'Pilotage Caisse non autorisé';
  end if;
  return jsonb_build_object(
    'role','caisse','pharmacie_id',pid,
    'jours',greatest(1,least(coalesce(p_jours,7),365)),
    'evenements_reservation',coalesce((select count(*) from public.reservation_events e
      where e.actor_id=uid and e.occurred_at>=debut),0),
    'paiements',coalesce((select count(*) from public.reservation_events e
      where e.actor_id=uid and e.event_type='status_changed'
        and e.to_statut='payee' and e.occurred_at>=debut),0),
    'retraits',coalesce((select count(*) from public.reservation_events e
      where e.actor_id=uid and e.event_type='status_changed'
        and e.to_statut='retiree' and e.occurred_at>=debut),0),
    'annulations',coalesce((select count(*) from public.reservation_events e
      where e.actor_id=uid and e.event_type='status_changed'
        and e.to_statut='annulee' and e.occurred_at>=debut),0),
    'ca',coalesce((select sum(r.total)::int from public.reservations r
      join public.reservation_events e on e.reservation_id=r.id
      where e.actor_id=uid and e.event_type='status_changed'
        and e.to_statut='payee' and e.occurred_at>=debut),0)
  );
end;
$function$;
revoke all on function public.stats_caisse_scope(integer) from public,anon;
grant execute on function public.stats_caisse_scope(integer) to authenticated,service_role;

-- Les fonctions longues conservent leur logique métier ; seules leurs anciennes
-- gardes d'identité sont remplacées par les gardes du poste sélectionné.
do $patch$
declare
  v_sql text;
  v_old text;
  v_new text;
begin
  v_sql:=pg_get_functiondef('public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)'::regprocedure);
  v_old:=$old$or v_profile.role::text not in ('pharmacie','caisse')
    or (v_profile.role::text='pharmacie' and nullif(btrim(v_profile.fonction_interne),'') is null)$old$;
  v_new:=$new$or not exists(select 1 from public.naxa_roles r
      where r.code=public.naxa_business_function(v_uid) and r.portee='PHARMACIE')
    or public.naxa_active_role_pharmacy(v_uid) is distinct from v_pharmacy$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde offline stock introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  v_sql:=pg_get_functiondef('public.naxa_apply_offline_sale_v1(uuid,uuid,jsonb,bigint)'::regprocedure);
  v_old:=$old$or v_profile.role::text not in ('caisse','pharmacie')
     or (v_profile.role::text='pharmacie' and nullif(btrim(v_profile.fonction_interne),'') is null)$old$;
  v_new:=$new$or public.naxa_business_function(v_uid)<>'caisse'
     or public.naxa_active_role_pharmacy(v_uid) is distinct from v_pharmacy$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde offline POS introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  v_sql:=pg_get_functiondef('public.naxa_device_permissions_v1(uuid)'::regprocedure);
  v_old:=$old$or v_profile.role::text not in ('pharmacie','caisse')
    or (v_profile.role::text='pharmacie' and nullif(btrim(v_profile.fonction_interne),'') is null)$old$;
  v_new:=$new$or not exists(select 1 from public.naxa_roles r
      where r.code=public.naxa_business_function(v_device.utilisateur_id) and r.portee='PHARMACIE')
    or public.naxa_active_role_pharmacy(v_device.utilisateur_id) is distinct from v_device.pharmacie_id$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde permissions appareil introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  v_sql:=pg_get_functiondef('public.caisse_cloturer(uuid,integer,text)'::regprocedure);
  v_old:=$old$and (coalesce(p.role::text,'')='caisse' or coalesce(p.fonction_interne,'')='caisse')$old$;
  v_new:=$new$and public.naxa_business_function(p.id)='caisse'
    and public.naxa_active_role_pharmacy(p.id)=v_pharmacie$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde clôture Caisse introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  v_sql:=pg_get_functiondef('public.caisse_decaisser(uuid,integer,text,text,text,uuid)'::regprocedure);
  v_old:=$old$and (coalesce(p.role::text,'')='caisse' or coalesce(p.fonction_interne,'')='caisse')$old$;
  v_new:=$new$and public.naxa_business_function(p.id)='caisse'
    and public.naxa_active_role_pharmacy(p.id)=v_pharmacie$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde décaissement Caisse introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  v_sql:=pg_get_functiondef('public.vente_encaisser_finaliser(uuid,integer)'::regprocedure);
  v_old:=$old$and (p.role::text='caisse' or p.fonction_interne='caisse')$old$;
  v_new:=$new$and public.naxa_business_function(p.id)='caisse'
      and public.naxa_active_role_pharmacy(p.id)=v_vente.pharmacie_id$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde encaissement POS introuvable'; end if;
  execute replace(v_sql,v_old,v_new);
end;
$patch$;

-- Un compte client peut recevoir des droits de poste Caisse sans être converti
-- en rôle Auth/niveau permanent ; le niveau 3 est déduit de l'affectation.
do $patch$
declare
  v_sql text;
  v_old text;
  v_new text;
begin
  v_sql:=pg_get_functiondef('public.naxa_grant_privilege(uuid,text,uuid,text)'::regprocedure);
  v_old:=$old$ select niveau_interne into v_level
 from public.profiles
 where id=p_target and actif;$old$;
  v_new:=$new$ select case
   when p_scope='POSTE_CAISSE'
     and exists(select 1 from public.naxa_professional_assignments a
       where a.profile_id=p_target and a.pharmacie_id=p_pharmacie
         and a.role_code='caisse' and a.statut='active'
         and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now()))
     then 3::smallint
   else niveau_interne
 end into v_level
 from public.profiles where id=p_target and actif;$new$;
  if position(v_old in v_sql)=0 then raise exception 'Résolution du niveau cible privilege introuvable'; end if;
  execute replace(v_sql,v_old,v_new);
end;
$patch$;

-- Les compteurs de quota Caisse sont sérialisés par pharmacie, y compris lors
-- d'une réactivation, afin d'éviter deux créations concurrentes au-delà du quota.
do $patch$
declare
  v_sql text;
  v_old text;
  v_new text;
begin
  v_sql:=pg_get_functiondef('public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text)'::regprocedure);
  v_old:=$old$  if p_fonction='caisse' and v_max_caisses is not null then$old$;
  v_new:=$new$  if p_fonction='caisse' and v_max_caisses is not null then
    perform pg_advisory_xact_lock(hashtextextended('naxa-caisse-quota:'||p_pharmacie::text,0));$new$;
  if position(v_old in v_sql)=0 then raise exception 'Bloc quota provisionnement Caisse introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  v_sql:=pg_get_functiondef('public.naxa_set_professional_assignment_status(uuid,uuid,boolean)'::regprocedure);
  v_old:=$old$    if v_max is not null then$old$;
  v_new:=$new$    if v_max is not null then
      perform pg_advisory_xact_lock(hashtextextended('naxa-caisse-quota:'||p_pharmacie::text,0));$new$;
  if position(v_old in v_sql)=0 then raise exception 'Bloc quota réactivation Caisse introuvable'; end if;
  execute replace(v_sql,v_old,v_new);
end;
$patch$;

comment on function public.naxa_active_role_pharmacy(uuid) is
  'Pharmacie du seul poste actif sélectionné ; ne renvoie jamais les autres pharmacies affectées à la personne.';
comment on function private.is_admin() is
  'Vrai uniquement lorsque l’espace Admin est celui actuellement sélectionné par le profil.';

commit;
