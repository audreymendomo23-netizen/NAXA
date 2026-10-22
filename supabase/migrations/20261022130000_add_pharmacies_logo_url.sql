alter table public.pharmacies add column if not exists logo_url text;
comment on column public.pharmacies.logo_url is 'URL du logo de la pharmacie utilisé sur les tickets et dans le profil Promoteur.';
