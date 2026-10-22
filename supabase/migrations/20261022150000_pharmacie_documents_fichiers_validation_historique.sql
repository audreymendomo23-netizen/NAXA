-- Documents de pharmacie : réception déclarée, fichier réellement stocké, validation et historique séparés.
create table if not exists public.pharmacie_documents (
 id uuid primary key default gen_random_uuid(),
 pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
 type_document text not null check (type_document in ('existence_legale','registre_commerce','niu','attestation_non_redevance','plan_localisation','cni_promoteur','autre')),
 nom_fichier text not null,
 bucket_id text not null default 'pharmacie-documents',
 object_path text not null,
 mime_type text,
 taille_octets bigint check (taille_octets is null or taille_octets >= 0),
 statut_validation text not null default 'en_attente' check (statut_validation in ('en_attente','valide','rejete')),
 note_validation text,
 recu_par uuid references auth.users(id) on delete set null,
 recu_le timestamptz not null default now(),
 valide_par uuid references auth.users(id) on delete set null,
 valide_le timestamptz,
 version integer not null default 1 check (version > 0),
 unique(bucket_id, object_path)
);
create index if not exists pharmacie_documents_pharmacie_idx on public.pharmacie_documents(pharmacie_id, type_document, recu_le desc);
alter table public.pharmacie_documents enable row level security;
drop policy if exists pharmacie_documents_admin_select on public.pharmacie_documents;
create policy pharmacie_documents_admin_select on public.pharmacie_documents for select to authenticated using (public.is_admin());
drop policy if exists pharmacie_documents_admin_insert on public.pharmacie_documents;
create policy pharmacie_documents_admin_insert on public.pharmacie_documents for insert to authenticated with check (public.is_admin());
drop policy if exists pharmacie_documents_admin_update on public.pharmacie_documents;
create policy pharmacie_documents_admin_update on public.pharmacie_documents for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.pharmacie_documents from anon, authenticated;
grant select,insert,update on public.pharmacie_documents to authenticated;

create table if not exists public.pharmacie_document_historique (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.pharmacie_documents(id) on delete cascade,
 acteur_id uuid references auth.users(id) on delete set null,
 action text not null check (action in ('enregistrement','validation','rejet','remplacement')),
 ancien_statut text,
 nouveau_statut text,
 detail text,
 cree_le timestamptz not null default now()
);
alter table public.pharmacie_document_historique enable row level security;
drop policy if exists pharmacie_document_historique_admin_select on public.pharmacie_document_historique;
create policy pharmacie_document_historique_admin_select on public.pharmacie_document_historique for select to authenticated using (public.is_admin());
revoke all on public.pharmacie_document_historique from anon, authenticated;
grant select on public.pharmacie_document_historique to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pharmacie-documents','pharmacie-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists pharmacie_documents_storage_admin_select on storage.objects;
create policy pharmacie_documents_storage_admin_select on storage.objects for select to authenticated using (bucket_id='pharmacie-documents' and public.is_admin());
drop policy if exists pharmacie_documents_storage_admin_insert on storage.objects;
create policy pharmacie_documents_storage_admin_insert on storage.objects for insert to authenticated with check (bucket_id='pharmacie-documents' and public.is_admin());
drop policy if exists pharmacie_documents_storage_admin_update on storage.objects;
create policy pharmacie_documents_storage_admin_update on storage.objects for update to authenticated using (bucket_id='pharmacie-documents' and public.is_admin()) with check (bucket_id='pharmacie-documents' and public.is_admin());
drop policy if exists pharmacie_documents_storage_admin_delete on storage.objects;
create policy pharmacie_documents_storage_admin_delete on storage.objects for delete to authenticated using (bucket_id='pharmacie-documents' and public.is_admin());

create or replace function public.journaliser_pharmacie_document()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_action text; v_ancien text; v_nouveau text;
begin
 if tg_op='INSERT' then v_action:='enregistrement'; v_ancien:=null; v_nouveau:=new.statut_validation;
 elsif new.statut_validation is distinct from old.statut_validation then
   v_action:=case when new.statut_validation='valide' then 'validation' when new.statut_validation='rejete' then 'rejet' else 'remplacement' end;
   v_ancien:=old.statut_validation; v_nouveau:=new.statut_validation;
 else
   v_action:='remplacement'; v_ancien:=old.statut_validation; v_nouveau:=new.statut_validation;
 end if;
 insert into public.pharmacie_document_historique(document_id,acteur_id,action,ancien_statut,nouveau_statut,detail)
 values(new.id,coalesce(auth.uid(),new.valide_par,new.recu_par),v_action,v_ancien,v_nouveau,new.note_validation);
 return new;
end $$;
drop trigger if exists trg_journaliser_pharmacie_document on public.pharmacie_documents;
create trigger trg_journaliser_pharmacie_document after insert or update on public.pharmacie_documents for each row execute function public.journaliser_pharmacie_document();
