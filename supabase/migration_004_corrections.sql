-- NAXA : migration 004 — remet la base au niveau prévu par le cahier des charges (écarts constatés après 002 et 003).
-- Ordre : schema.sql, 002, 003, puis ce fichier. Sans danger si relancée. Ne supprime rien.

-- 1. Colonne manquante pour l'import de la base publique des médicaments.
alter table public.produits add column if not exists bdpm_cis text;

-- 2. Valeurs autorisées pour la source d'une fiche (appliqué aux nouvelles écritures seulement).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'produits_source_fiche_check') then
    alter table public.produits
      add constraint produits_source_fiche_check
      check (source_fiche in ('aucune', 'bdpm', 'ia', 'admin', 'pharmacien')) not valid;
  end if;
end $$;

-- 3. Les synonymes entrent dans la recherche (ex. « acetaminophen » trouve le paracétamol).
create or replace function public.produits_norm() returns trigger
language plpgsql set search_path = public, extensions
as $$
begin
  new.nom_norm := lower(unaccent(
    coalesce(new.nom, '') || ' ' || coalesce(new.dci, '') || ' ' || coalesce(new.dosage, '') || ' ' ||
    coalesce(array_to_string(new.synonymes, ' '), '')));
  return new;
end $$;

update public.produits set nom_norm = lower(unaccent(
  coalesce(nom, '') || ' ' || coalesce(dci, '') || ' ' || coalesce(dosage, '') || ' ' ||
  coalesce(array_to_string(synonymes, ' '), '')));

-- 4. Garde-fou : un compte pharmacie qui crée un produit ne peut pas y mettre une fiche, une photo ni la déclarer « relue ».
create or replace function public.produits_garde_fiche() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.photo_url := null; new.description := null; new.indications := null; new.precautions := null;
    new.synonymes := '{}'; new.source_fiche := 'aucune'; new.fiche_validee := false;
    new.fiche_maj := null; new.bdpm_cis := null;
  else
    new.photo_url := old.photo_url; new.description := old.description; new.indications := old.indications;
    new.precautions := old.precautions; new.synonymes := old.synonymes; new.source_fiche := old.source_fiche;
    new.fiche_validee := old.fiche_validee; new.fiche_maj := old.fiche_maj; new.bdpm_cis := old.bdpm_cis;
  end if;
  return new;
end $$;

drop trigger if exists trg_produits_garde on public.produits;
create trigger trg_produits_garde before insert or update on public.produits
  for each row execute function public.produits_garde_fiche();

-- 5. Photos : bucket public en lecture, écriture réservée à l'admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produits-photos', 'produits-photos', true, 524288, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists photos_lecture on storage.objects;
drop policy if exists photos_admin_ajout on storage.objects;
drop policy if exists photos_admin_maj on storage.objects;
drop policy if exists photos_admin_suppr on storage.objects;
create policy photos_lecture on storage.objects for select using (bucket_id = 'produits-photos');
create policy photos_admin_ajout on storage.objects for insert with check (bucket_id = 'produits-photos' and public.is_admin());
create policy photos_admin_maj on storage.objects for update using (bucket_id = 'produits-photos' and public.is_admin());
create policy photos_admin_suppr on storage.objects for delete using (bucket_id = 'produits-photos' and public.is_admin());

-- 6. Dictionnaire : colonnes et mots simples manquants.
alter table public.dictionnaire add column if not exists categorie text not null default 'mot';
alter table public.dictionnaire add column if not exists source text not null default 'NAXA (à faire valider par un pharmacien)';
alter table public.dictionnaire enable row level security;
drop policy if exists dico_lecture on public.dictionnaire;
drop policy if exists dico_admin on public.dictionnaire;
create policy dico_lecture on public.dictionnaire for select using (true);
create policy dico_admin on public.dictionnaire for all using (public.is_admin()) with check (public.is_admin());

insert into public.dictionnaire (terme, categorie, definition)
select v.terme, v.categorie, v.definition
from (values
  ('comprimé', 'forme', 'Forme solide à avaler avec de l''eau. Certains se croquent ou se dissolvent : lisez la notice.'),
  ('gélule', 'forme', 'Petite capsule qui contient une poudre. On l''avale entière avec de l''eau.'),
  ('sirop', 'forme', 'Médicament liquide sucré, souvent utilisé pour les enfants. Utilisez la mesure fournie dans la boîte.'),
  ('suspension buvable', 'forme', 'Liquide à agiter avant de boire, car la poudre se dépose au fond.'),
  ('injectable', 'forme', 'Médicament donné par piqûre, par un professionnel de santé.'),
  ('pommade', 'forme', 'Crème grasse à appliquer sur la peau.'),
  ('collyre', 'forme', 'Gouttes à mettre dans les yeux.'),
  ('effervescent', 'forme', 'Comprimé ou poudre à dissoudre dans un verre d''eau avant de boire.'),
  ('dci', 'mot', 'Dénomination commune internationale : le nom de la substance active, le même partout dans le monde (ex. paracétamol).'),
  ('substance active', 'mot', 'L''élément du médicament qui agit sur le corps.'),
  ('générique', 'mot', 'Médicament qui contient la même substance active qu''un médicament de marque, souvent moins cher. Le pharmacien peut vous conseiller.'),
  ('posologie', 'mot', 'La quantité à prendre et le rythme des prises. Elle vient de l''ordonnance ou de la notice, jamais de NAXA.'),
  ('contre-indication', 'mot', 'Situation dans laquelle un médicament ne doit pas être pris. Demandez au pharmacien en cas de doute.'),
  ('ordonnance', 'mot', 'Papier du médecin qui prescrit un médicament. Certains produits ne sont délivrés que sur ordonnance.')
) as v(terme, categorie, definition)
where not exists (select 1 from public.dictionnaire d where d.terme = v.terme);

-- 7. « Les plus recherchés » : au plus 10 termes par appel.
create or replace function public.log_recherche(p_terms text[]) returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare i int; t text; pid uuid;
begin
  for i in 1..least(coalesce(array_length(p_terms, 1), 0), 10) loop
    t := lower(unaccent(trim(p_terms[i])));
    if length(t) < 3 or length(t) > 80 then continue; end if;
    pid := null;
    select id into pid from public.produits
     where nom_norm % t or nom_norm ilike '%' || t || '%'
     order by similarity(nom_norm, t) desc limit 1;
    if pid is not null then insert into public.recherche_events (produit_id) values (pid); end if;
  end loop;
end $$;
grant execute on function public.log_recherche(text[]) to anon, authenticated;