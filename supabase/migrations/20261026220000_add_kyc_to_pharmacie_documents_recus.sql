-- Conserver la déclaration de réception KYC du parcours d'ouverture de pharmacie.
alter table public.pharmacie_documents_recus add column if not exists kyc boolean not null default false;
