-- NAXA — Assistance directe à tous les comptes actifs (Clients et professionnels).
-- Étend support_naxa sans toucher au chat Client–pharmacie.
begin;
alter table public.tickets_support drop constraint if exists tickets_support_categorie_check;
alter table public.tickets_support add constraint tickets_support_categorie_check check (categorie in (
  'compte','technique','gestion_espace','personnel','stock','caisse','commandes','livraison',
  'abonnement_paiement','publication','confidentialite','signalement','suggestion','autre'
));
drop policy if exists tickets_support_client_create_naxa_support on public.tickets_support;
drop policy if exists tickets_support_account_create_naxa_support on public.tickets_support;
create policy tickets_support_account_create_naxa_support on public.tickets_support for insert to authenticated
with check (
  auteur_profile_id=(select auth.uid()) and pharmacie_id is null and type='support_naxa' and statut='ouvert'
  and categorie in ('compte','technique','gestion_espace','personnel','stock','caisse','commandes','livraison','abonnement_paiement','publication','confidentialite','signalement','suggestion','autre')
  and exists(select 1 from public.profiles me where me.id=(select auth.uid()) and me.actif is true and me.role<>'admin'::public.role_type)
  and public.naxa_business_function() is not null and public.naxa_business_function()<>'admin'
);
drop policy if exists tickets_support_acces on public.tickets_support;
create policy tickets_support_acces on public.tickets_support for select to authenticated using (
  (public.is_admin() and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'::public.role_type and p.actif is true) and public.naxa_business_function()='admin')
  or (auteur_profile_id=(select auth.uid()) and (
    type<>'support_naxa' or (
      exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.actif is true and p.role<>'admin'::public.role_type)
      and public.naxa_business_function() is not null and public.naxa_business_function()<>'admin'
    )
  ))
  or pharmacie_id=(select public.my_pharmacie())
);
drop policy if exists messages_support_acces on public.messages_support;
create policy messages_support_acces on public.messages_support for select to authenticated using (
  (public.is_admin() and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'::public.role_type and p.actif is true) and public.naxa_business_function()='admin')
  or (interne=false and exists(
    select 1 from public.tickets_support t join public.profiles me on me.id=(select auth.uid())
    where t.id=messages_support.ticket_id and (
      (t.type='support_naxa' and t.auteur_profile_id=(select auth.uid()) and me.actif is true
        and me.role<>'admin'::public.role_type and public.naxa_business_function() is not null
        and public.naxa_business_function()<>'admin')
      or (t.type<>'support_naxa' and (t.auteur_profile_id=(select auth.uid()) or t.pharmacie_id=(select public.my_pharmacie())))
    )
  ))
);
drop policy if exists messages_support_chat_participant_insert on public.messages_support;
create policy messages_support_chat_participant_insert on public.messages_support for insert to authenticated with check (
  auteur_profile_id=(select auth.uid()) and interne=false and length(btrim(contenu)) between 1 and 2000
  and exists(
    select 1 from public.tickets_support t join public.profiles me on me.id=(select auth.uid())
    where t.id=messages_support.ticket_id and (
      (t.type='conseil_pharmacien' and t.statut='ouvert' and (
        (t.auteur_profile_id=(select auth.uid()) and me.role='client'::public.role_type)
        or (t.pharmacie_id=(select public.my_pharmacie()) and me.role='pharmacie'::public.role_type)
      ))
      or (t.type='support_naxa' and t.pharmacie_id is null and t.auteur_profile_id=(select auth.uid())
        and t.statut<>'ferme' and me.actif is true and me.role<>'admin'::public.role_type
        and public.naxa_business_function() is not null and public.naxa_business_function()<>'admin')
    )
  )
  and (piece_jointe_path is null or (
    piece_jointe_path like (select auth.uid()::text)||'/'||ticket_id::text||'/%'
    and piece_jointe_mime in ('application/pdf','image/jpeg','image/png','image/webp')
    and piece_jointe_taille between 1 and 4194304
  ))
);
drop policy if exists naxa_support_attachment_insert_own on storage.objects;
create policy naxa_support_attachment_insert_own on storage.objects for insert to authenticated with check (
  bucket_id='naxa-support-attachments' and (storage.foldername(name))[1]=(select auth.uid())::text
  and array_length(storage.foldername(name),1)=2 and (storage.foldername(name))[2]~*'^[0-9a-f-]{36}$'
  and storage.filename(name)~*'^[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$'
  and coalesce(metadata->>'mimetype','') in ('application/pdf','image/jpeg','image/png','image/webp')
  and public.naxa_business_function() is not null and public.naxa_business_function()<>'admin'
  and exists(select 1 from public.tickets_support t join public.profiles me on me.id=(select auth.uid())
    where t.id::text=(storage.foldername(objects.name))[2] and t.auteur_profile_id=(select auth.uid())
      and t.type='support_naxa' and t.pharmacie_id is null and t.statut<>'ferme'
      and me.actif is true and me.role<>'admin'::public.role_type)
);
drop policy if exists naxa_support_attachment_read_own on storage.objects;
create policy naxa_support_attachment_read_own on storage.objects for select to authenticated using (
  bucket_id='naxa-support-attachments' and public.naxa_business_function() is not null
  and public.naxa_business_function()<>'admin'
  and exists(select 1 from public.messages_support m join public.tickets_support t on t.id=m.ticket_id
    join public.profiles me on me.id=(select auth.uid()) where m.piece_jointe_path=objects.name
      and m.interne=false and t.auteur_profile_id=(select auth.uid()) and t.type='support_naxa'
      and me.actif is true and me.role<>'admin'::public.role_type)
);
drop policy if exists naxa_support_attachment_delete_own on storage.objects;
create policy naxa_support_attachment_delete_own on storage.objects for delete to authenticated using (
  bucket_id='naxa-support-attachments' and public.naxa_business_function() is not null
  and public.naxa_business_function()<>'admin' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.tickets_support t join public.profiles me on me.id=(select auth.uid())
    where t.id::text=(storage.foldername(objects.name))[2] and t.auteur_profile_id=(select auth.uid())
      and t.type='support_naxa' and me.actif is true and me.role<>'admin'::public.role_type)
);
create or replace function public.open_naxa_support_ticket(p_categorie text,p_sujet text,p_message text)
returns table(ticket_id uuid,reference_code text)
language plpgsql security invoker set search_path=public,pg_temp
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_ticket_id uuid;
  v_reference_code text;
  v_subject text:=btrim(coalesce(p_sujet,''));
  v_message text:=btrim(coalesce(p_message,''));
  v_business_role text:=public.naxa_business_function();
begin
  if v_user_id is null then raise exception 'Connexion requise' using errcode='42501'; end if;
  if p_categorie not in ('compte','technique','gestion_espace','personnel','stock','caisse','commandes','livraison','abonnement_paiement','publication','confidentialite','signalement','suggestion','autre')
    or length(v_subject) not between 5 and 100 or length(v_message) not between 1 and 2000 then
    raise exception 'Catégorie, sujet ou message invalide' using errcode='22023';
  end if;
  if not exists(select 1 from public.profiles p where p.id=v_user_id and p.actif is true and p.role<>'admin'::public.role_type)
    or v_business_role is null or v_business_role='admin' then
    raise exception 'Assistance réservée aux comptes actifs dans leur espace autorisé' using errcode='42501';
  end if;
  insert into public.tickets_support as inserted_ticket(auteur_profile_id,pharmacie_id,sujet,type,statut,categorie)
    values(v_user_id,null,v_subject,'support_naxa','ouvert',p_categorie)
    returning inserted_ticket.id,inserted_ticket.reference_code into v_ticket_id,v_reference_code;
  insert into public.messages_support(ticket_id,auteur_profile_id,contenu,interne)
    values(v_ticket_id,v_user_id,v_message,false);
  ticket_id:=v_ticket_id; reference_code:=v_reference_code; return next;
end;
$function$;
commit;
