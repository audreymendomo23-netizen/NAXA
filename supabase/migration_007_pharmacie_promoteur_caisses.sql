-- NAXA — rôles organisationnels pharmacie
-- Étape 1 : les nouvelles valeurs d'enum doivent être validées par un commit avant usage.
alter type public.role_type add value if not exists 'promoteur';
alter type public.role_type add value if not exists 'caisse';
