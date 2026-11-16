-- NAXA — Séparer le personnel Caisse des caisses physiques.
-- max_caisses est une capacité de ressources physiques, jamais un quota de collaborateurs.
-- Plusieurs Caissiers peuvent partager la même caisse physique ; ses lignes restent plafonnées.

begin;

-- Retirer le plafond max_caisses du RPC central d'affectation des personnes.
do $migration$
declare
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef(
    'public.naxa_grant_professional_assignment(uuid,uuid,text,timestamp with time zone,timestamp with time zone,text)'::regprocedure
  ) into v_definition;
  v_updated:=regexp_replace(
    v_definition,
    E'\n  if p_fonction=''caisse'' and v_max_caisses is not null then.*?\n  end if;\n',
    E'\n',
    's'
  );
  if v_updated=v_definition or position('Quota Caisses atteint' in v_updated)>0 then
    raise exception 'Le quota de personnel Caisse n''a pas été retiré de la RPC centrale';
  end if;
  execute v_updated;
end
$migration$;

-- La suspension/réactivation d'un compte Caisse ne doit plus compter des employés
-- comme des ressources physiques.
do $migration$
declare
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef(
    'public.naxa_set_caisse_status(uuid,boolean)'::regprocedure
  ) into v_definition;
  v_updated:=regexp_replace(
    v_definition,
    E'\n    select count\\(\\*\\) into cnt.*?raise exception ''Quota Caisses atteint'';\n    end if;\n',
    E'\n',
    's'
  );
  if v_updated=v_definition or position('Quota Caisses atteint' in v_updated)>0 then
    raise exception 'Le quota de personnel Caisse n''a pas été retiré de la réactivation historique';
  end if;
  execute v_updated;
end
$migration$;

-- L'ancien mécanisme de niveaux hiérarchiques reste utilisable pour les comptes
-- historiques, mais ne doit plus interpréter le niveau 3 comme un nombre de postes Caisse.
do $migration$
declare
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef(
    'public.accrediter_profile(uuid,uuid,smallint,uuid)'::regprocedure
  ) into v_definition;
  v_updated:=regexp_replace(
    v_definition,
    E'else select count\\(\\*\\) into v_count from public\\.profiles where pharmacie_id=p_pharmacie and actif and niveau_interne=3 and private\\.naxa_business_function\\(id\\)=''caisse''; if v_max_caisse is not null and v_count>=v_max_caisse then raise exception ''Quota Caisses atteint''; end if; end if;',
    'else null; end if;',
    'g'
  );
  if v_updated=v_definition or position('Quota Caisses atteint' in v_updated)>0 then
    raise exception 'Le quota de personnel Caisse n''a pas été retiré de l''ancienne accréditation';
  end if;
  execute v_updated;
end
$migration$;

-- En revanche, les caisses PHYSIQUES restent réellement plafonnées par l'architecture.
-- Ce trigger protège aussi les INSERT REST directs autorisés par la policy RLS.
create or replace function private.naxa_guard_physical_caisse_capacity()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_architecture text;
  v_max_caisses integer;
  v_count integer;
begin
  if new.actif is not true then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('naxa-caisse-resource:'||new.pharmacie_id::text,0)
  );

  select pa.architecture_code,pa.max_caisses
    into v_architecture,v_max_caisses
  from public.pharmacie_architectures pa
  where pa.pharmacie_id=new.pharmacie_id and pa.active=true;

  if v_architecture is null then
    raise exception 'Architecture active absente : caisse physique non autorisée'
      using errcode='23514';
  end if;
  if not exists(
    select 1 from public.naxa_architecture_niveaux n
    where n.architecture_code=v_architecture and n.niveau=3
  ) then
    raise exception 'Cette architecture ne comporte pas de niveau Caisse physique'
      using errcode='23514';
  end if;

  if v_max_caisses is not null then
    select count(*) into v_count
    from public.caisses c
    where c.pharmacie_id=new.pharmacie_id
      and c.actif=true
      and c.id is distinct from new.id;
    if v_count>=v_max_caisses then
      raise exception 'Capacité de caisses physiques atteinte pour cette architecture'
        using errcode='23505';
    end if;
  end if;
  return new;
end
$function$;

drop trigger if exists naxa_guard_physical_caisse_capacity
  on public.caisses;
create trigger naxa_guard_physical_caisse_capacity
before insert or update of pharmacie_id,actif
on public.caisses
for each row
execute function private.naxa_guard_physical_caisse_capacity();

commit;
