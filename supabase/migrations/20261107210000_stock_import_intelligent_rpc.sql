-- NAXA — Import stock adaptatif : snapshot contrôlé, protection des lots/FEFO.
begin;

create or replace function public.naxa_import_stock_batch(
  p_pharmacie uuid,
  p_lignes jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_group record;
  v_lot record;
  v_existing public.stocks%rowtype;
  v_existing_lots integer;
  v_price integer;
  v_quantity bigint;
  v_imported integer := 0;
  v_lots_imported integer := 0;
  v_lines integer := 0;
  v_has_lot boolean;
  v_without_lot integer;
  v_with_lot integer;
  v_location text;
  v_expiry date;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if p_pharmacie is null then raise exception 'Pharmacie requise'; end if;
  if jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) not between 1 and 5000 then
    raise exception 'Le fichier doit contenir entre 1 et 5000 lignes valides';
  end if;
  select * into v_profile from public.profiles where id=v_user and actif=true;
  if not found then raise exception 'Compte inactif'; end if;
  if not public.naxa_scope_allows(v_user,p_pharmacie,'PHARMACIE') then
    raise exception 'Pharmacie hors périmètre';
  end if;
  if not exists (
    select 1 from public.pharmacies p
    where p.id=p_pharmacie and p.actif=true and p.archivee_le is null
  ) then raise exception 'Pharmacie inactive ou archivée'; end if;
  if not (
    public.is_admin()
    or (
      public.naxa_has_privilege('VIEW_STOCK',p_pharmacie,'PHARMACIE')
      and public.naxa_has_privilege('IMPORT_STOCK',p_pharmacie,'PHARMACIE')
    )
  ) then raise exception 'Privilège IMPORT_STOCK requis pour cette pharmacie'; end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lignes) x(line)
    where nullif(x.line->>'produit_id','') is null
       or nullif(x.line->>'quantite','') is null
       or (x.line->>'quantite') !~ '^\d+$'
       or (x.line->>'quantite')::numeric > 2147483647
       or coalesce(x.line->>'nom','') = ''
  ) then raise exception 'Une ligne ne possède pas un produit, un nom ou une quantité entière valide'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_lignes) x(line)
    where nullif(x.line->>'prix','') is not null
      and ((x.line->>'prix') !~ '^\d+$' or (x.line->>'prix')::numeric > 2147483647)
  ) then raise exception 'Un prix doit être un entier FCFA positif ou nul'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_lignes) x(line)
    where (nullif(trim(x.line->>'lot'),'') is null) <> (nullif(x.line->>'peremption','') is null)
  ) then raise exception 'Un lot doit avoir simultanément un numéro et une date de péremption'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_lignes) x(line)
    where nullif(trim(x.line->>'lot'),'') is not null
      and ((x.line->>'quantite')::integer <= 0 or (x.line->>'peremption') !~ '^\d{4}-\d{2}-\d{2}$')
  ) then raise exception 'Une ligne de lot doit avoir une quantité positive et une date ISO valide'; end if;

  select count(*) into v_lines from jsonb_array_elements(p_lignes);

  for v_group in
    select
      (line->>'produit_id')::uuid as produit_id,
      sum((line->>'quantite')::bigint) as total_quantite,
      count(distinct nullif(line->>'prix','')::integer) filter (where nullif(line->>'prix','') is not null) as nb_prix,
      min(nullif(line->>'prix','')::integer) as prix,
      min(nullif(trim(line->>'emplacement'),'')) as emplacement,
      bool_or(nullif(trim(line->>'lot'),'') is not null) as avec_lot,
      count(*) filter (where nullif(trim(line->>'lot'),'') is not null) as nb_lignes_lot,
      count(*) filter (where nullif(trim(line->>'lot'),'') is null) as nb_lignes_sans_lot,
      min(nullif(line->>'peremption','')::date) as premiere_peremption
    from jsonb_array_elements(p_lignes) x(line)
    group by (line->>'produit_id')::uuid
  loop
    if not exists(select 1 from public.produits p where p.id=v_group.produit_id) then
      raise exception 'Produit catalogue introuvable : %',v_group.produit_id;
    end if;
    if v_group.nb_prix > 1 then
      raise exception 'Plusieurs prix de vente différents pour le même produit. Corrigez le fichier avant import : %',v_group.produit_id;
    end if;
    if v_group.avec_lot and v_group.nb_lignes_sans_lot > 0 then
      raise exception 'Le produit mélange des lignes avec lot et sans lot. Séparez les lignes avant import : %',v_group.produit_id;
    end if;
    if v_group.total_quantite < 0 or v_group.total_quantite > 2147483647 then
      raise exception 'Quantité agrégée hors limites : %',v_group.produit_id;
    end if;

    select * into v_existing from public.stocks
    where pharmacie_id=p_pharmacie and produit_id=v_group.produit_id
    for update;
    v_price := coalesce(v_group.prix,v_existing.prix);
    if v_price is null then
      raise exception 'Prix de vente absent pour une nouvelle référence : %',v_group.produit_id;
    end if;

    select count(*) into v_existing_lots
    from public.stocks_lots l
    where l.pharmacie_id=p_pharmacie and l.produit_id=v_group.produit_id;
    if v_existing_lots > 0 then
      raise exception 'Produit déjà suivi par lots. Import bloqué pour préserver FEFO et allocations existantes : %',v_group.produit_id;
    end if;

    insert into public.stocks(
      pharmacie_id,produit_id,prix,quantite,date_peremption,emplacement,updated_at
    ) values (
      p_pharmacie,v_group.produit_id,v_price,v_group.total_quantite::integer,
      v_group.premiere_peremption,v_group.emplacement,now()
    )
    on conflict (pharmacie_id,produit_id) do update set
      prix=excluded.prix,
      quantite=excluded.quantite,
      date_peremption=excluded.date_peremption,
      emplacement=coalesce(excluded.emplacement,public.stocks.emplacement),
      updated_at=now();

    if v_group.avec_lot then
      for v_lot in
        select
          trim(line->>'lot') as numero_lot,
          (line->>'peremption')::date as date_peremption,
          sum((line->>'quantite')::integer)::integer as quantite
        from jsonb_array_elements(p_lignes) x(line)
        where (line->>'produit_id')::uuid=v_group.produit_id
        group by trim(line->>'lot'),(line->>'peremption')::date
      loop
        insert into public.stocks_lots(
          pharmacie_id,produit_id,lot,peremption,numero_lot,date_peremption,
          quantite,bloque,motif_blocage,emplacement
        ) values (
          p_pharmacie,v_group.produit_id,v_lot.numero_lot,v_lot.date_peremption,
          v_lot.numero_lot,v_lot.date_peremption,v_lot.quantite,
          v_lot.date_peremption < current_date,
          case when v_lot.date_peremption < current_date then 'Péremption antérieure à la date d’import' else null end,
          v_group.emplacement
        );
        v_lots_imported := v_lots_imported + 1;
      end loop;
    end if;
    v_imported := v_imported + 1;
  end loop;

  return jsonb_build_object(
    'ok',true,
    'pharmacie_id',p_pharmacie,
    'lignes_lues',v_lines,
    'references_importees',v_imported,
    'lots_importes',v_lots_imported,
    'mode','snapshot',
    'message','Les quantités importées remplacent les quantités agrégées du fichier source.'
  );
end;
$function$;

revoke all on function public.naxa_import_stock_batch(uuid,jsonb) from public,anon;
grant execute on function public.naxa_import_stock_batch(uuid,jsonb) to authenticated;

comment on function public.naxa_import_stock_batch(uuid,jsonb) is
  'Import stock snapshot authentifié et atomique. Requiert IMPORT_STOCK; conserve le stock et les lots existants en bloquant les produits déjà lotisés; importe des lots complets uniquement sur les références sans lots préexistants.';

commit;
