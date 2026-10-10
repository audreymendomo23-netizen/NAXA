-- NAXA 039 — Réconciliation finale Promoteur : validité commerciale transversale
create or replace function private.naxa_promoteur_valide(p_promoteur uuid default auth.uid())
returns boolean language sql stable security definer set search_path=''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id=p_promoteur and p.actif and p.role::text='promoteur'
      and exists (select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=p_promoteur and pp.actif)
      and not exists (
        select 1
        from public.promoteur_pharmacies pp
        left join public.pharmacies ph on ph.id=pp.pharmacie_id
        left join public.abonnements a on a.pharmacie_id=pp.pharmacie_id
        where pp.promoteur_id=p_promoteur and pp.actif
          and (ph.id is null or ph.actif is not true or a.id is null or a.statut<>'actif' or a.echeance is null or a.echeance<current_date)
      )
  )
$$;
revoke all on function private.naxa_promoteur_valide(uuid) from public,anon,authenticated;
grant execute on function private.naxa_promoteur_valide(uuid) to authenticated;

create or replace function public.naxa_promoteur_valide(p_promoteur uuid default auth.uid())
returns boolean language sql stable set search_path=''
as $$ select private.naxa_promoteur_valide($1) $$;
revoke all on function public.naxa_promoteur_valide(uuid) from public,anon,authenticated;
grant execute on function public.naxa_promoteur_valide(uuid) to authenticated;

-- Le moteur canonique de privilèges doit appliquer la validité commerciale
-- avant tout privilège Promoteur.
create or replace function private.naxa_has_privilege(p_privilege text,p_pharmacie uuid default null,p_scope text default 'PHARMACIE')
returns boolean language plpgsql stable security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid()); fn text; v_role_key text; arch text; target_pharmacy uuid:=p_pharmacie;
begin
 if uid is null or p_privilege is null then return false; end if;
 if not exists(select 1 from public.naxa_privileges n where n.code=p_privilege and n.active) then return false; end if;
 select public.naxa_business_function(uid) into fn;
 if fn is null then return false; end if;
 if fn='admin' then return true; end if;
 if fn='promoteur' and not private.naxa_promoteur_valide(uid) then return false; end if;
 if p_scope not in ('RESEAU','PHARMACIE','POSTE_CAISSE') then return false; end if;
 if target_pharmacy is null then select pharmacie_id into target_pharmacy from public.profiles where id=uid; end if;
 if p_scope='RESEAU' then
   if fn<>'promoteur' then return false; end if;
   return exists(select 1 from public.naxa_profile_privileges pp where pp.profile_id=uid and pp.privilege_code=p_privilege and pp.scope_type='RESEAU' and pp.pharmacie_id is null and pp.active);
 end if;
 if target_pharmacy is null then return false; end if;
 if not public.naxa_scope_allows(uid,target_pharmacy,p_scope) then return false; end if;
 select pa.architecture_code into arch from public.pharmacie_architectures pa where pa.pharmacie_id=target_pharmacy and pa.active;
 if arch is null then return false; end if;
 v_role_key:=case when fn in ('promoteur','responsable','caisse') then fn else null end;
 if v_role_key is not null then
   if not exists(select 1 from public.naxa_architecture_privileges ap where ap.architecture_code=arch and ap.role_key=v_role_key and ap.privilege_code=p_privilege) then return false; end if;
 else
   if not exists(select 1 from public.profiles p join public.naxa_custom_roles cr on cr.pharmacie_id=target_pharmacy and cr.code=p.custom_role_code and cr.actif join public.naxa_custom_role_privileges cp on cp.custom_role_id=cr.id where p.id=uid and cp.privilege_code=p_privilege) then return false; end if;
 end if;
 return exists(select 1 from public.naxa_profile_privileges pp where pp.profile_id=uid and pp.privilege_code=p_privilege and pp.pharmacie_id=target_pharmacy and pp.scope_type=p_scope and pp.active);
end
$$;

create or replace function private.naxa_scope_allows(p_profile uuid,p_pharmacie uuid,p_scope text default 'PHARMACIE')
returns boolean language sql stable security definer set search_path=''
as $$
select case
 when p_profile is null then false
 when p_scope='RESEAU' then private.naxa_promoteur_valide(p_profile)
   and exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.role::text='promoteur')
   and exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=p_profile and pp.actif and (p_pharmacie is null or pp.pharmacie_id=p_pharmacie))
 when p_scope='PHARMACIE' then
   exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.role::text='admin')
   or (private.naxa_promoteur_valide(p_profile) and exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.role::text='promoteur') and exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=p_profile and pp.pharmacie_id=p_pharmacie and pp.actif))
   or exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.role::text<>'promoteur' and p.pharmacie_id=p_pharmacie)
 when p_scope='POSTE_CAISSE' then exists(select 1 from public.profiles p where p.id=p_profile and p.actif and (p.role::text='admin' or p.role::text='caisse') and (p.role::text='admin' or p.pharmacie_id=p_pharmacie))
 else false end
$$;