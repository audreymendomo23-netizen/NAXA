begin;

create or replace function private.log_evenement(
  p_type text,
  p_produit uuid default null,
  p_pharmacie uuid default null,
  p_terme text default null,
  p_resultats integer default null,
  p_lat double precision default null,
  p_lng double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  pid uuid := p_produit;
  t text;
  zl float8;
  zg float8;
  res int;
begin
  if p_type not in ('recherche','fiche_vue','panier_ajout','scan_ordonnance') then
    return;
  end if;

  res := case when p_resultats is null then null else least(greatest(p_resultats,0),1000) end;

  if p_type = 'recherche' and p_terme is not null then
    t := left(lower(extensions.unaccent(trim(p_terme))),60);
    if pid is null and length(t) >= 3 then
      select id into pid from public.produits where nom_norm ilike '%'||t||'%' order by nom limit 1;
    end if;
    if res = 0 and length(t) >= 3 and t !~ '[0-9]{5,}' and t !~ '@' then
      p_terme := t;
    else
      p_terme := null;
    end if;
  end if;

  if p_lat between -5 and 15 and p_lng between 5 and 20 then
    zl := (round(p_lat::numeric/0.02)*0.02)::float8;
    zg := (round(p_lng::numeric/0.02)*0.02)::float8;
  end if;

  insert into public.evenements(type,produit_id,pharmacie_id,terme,resultats,zone_lat,zone_lng)
  values(p_type,pid,p_pharmacie,p_terme,res,zl,zg);
end
$function$;

create or replace function private.log_recherche(p_terms text[])
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  i int;
  t text;
  pid uuid;
begin
  for i in 1..least(coalesce(array_length(p_terms, 1), 0), 10) loop
    t := lower(extensions.unaccent(trim(p_terms[i])));
    if length(t) < 3 or length(t) > 80 then
      continue;
    end if;

    pid := null;
    select id into pid
      from public.produits
     where nom_norm OPERATOR(extensions.%) t
        or nom_norm ilike '%' || t || '%'
     order by extensions.similarity(nom_norm, t) desc
     limit 1;

    if pid is not null then
      insert into public.recherche_events(produit_id) values (pid);
    end if;
  end loop;
end
$function$;

create or replace function private.produits_populaires(
  p_limit integer default 10,
  p_jours integer default 7
)
returns table(produit_id uuid, nom text, dosage text, photo_url text, prix_min integer)
language sql
stable
security definer
set search_path = ''
as $function$
with top as (
  select p.id, p.nom, p.dosage, p.photo_url, min(s.prix)::int prix_min,
         count(e.id)::int score
    from public.recherche_events e
    join public.produits p on p.id = e.produit_id
    join public.stocks s on s.produit_id = p.id and s.quantite > 0
   where e.created_at > now() - make_interval(days => p_jours)
   group by p.id
),
comp as (
  select p.id, p.nom, p.dosage, p.photo_url, min(s.prix)::int prix_min,
         count(distinct s.pharmacie_id)::int score
    from public.produits p
    join public.stocks s on s.produit_id = p.id and s.quantite > 0
   where not exists(select 1 from top t where t.id = p.id)
   group by p.id
)
select id, nom, dosage, photo_url, prix_min
  from (
    select *, 1 rang from top
    union all
    select *, 2 rang from comp
  ) x
 order by rang, score desc
 limit least(p_limit, 20);
$function$;

commit;
