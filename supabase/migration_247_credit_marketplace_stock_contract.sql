-- NAXA 247 — demandes de crédit Marketplace et réservation du stock à l'approbation.
-- Migration de code uniquement : ne pas appliquer à une base distante sans validation explicite.
begin;

alter table public.client_credit_requests
  add column if not exists origine text not null default 'caisse',
  add column if not exists telephone_demande text,
  add column if not exists date_remboursement date,
  add column if not exists justificatif_path text,
  add column if not exists panier_items jsonb,
  add column if not exists reservation_id uuid references public.reservations(id) on delete restrict;

alter table public.reservations
  add column if not exists credit_request_id uuid references public.client_credit_requests(id) on delete restrict;

create unique index if not exists reservations_credit_request_unique
  on public.reservations(credit_request_id) where credit_request_id is not null;
create unique index if not exists client_credit_requests_reservation_unique
  on public.client_credit_requests(reservation_id) where reservation_id is not null;
create index if not exists client_credit_marketplace_pending_idx
  on public.client_credit_requests(client_id, pharmacie_id, statut, created_at desc);

alter table public.client_credit_requests drop constraint if exists client_credit_requests_origine_check;
alter table public.client_credit_requests add constraint client_credit_requests_origine_check
  check (origine in ('caisse','marketplace'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'credit-marketplace-justificatifs',
  'credit-marketplace-justificatifs',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict(id) do update set
  public=false,
  file_size_limit=10485760,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists credit_marketplace_proof_insert_own on storage.objects;
create policy credit_marketplace_proof_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id='credit-marketplace-justificatifs'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists credit_marketplace_proof_read_own on storage.objects;
create policy credit_marketplace_proof_read_own on storage.objects
for select to authenticated
using (
  bucket_id='credit-marketplace-justificatifs'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists credit_marketplace_proof_delete_own on storage.objects;
create policy credit_marketplace_proof_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id='credit-marketplace-justificatifs'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

create or replace function public.client_credit_marketplace_soumettre(
  p_pharmacie uuid,
  p_items jsonb,
  p_telephone text,
  p_date_remboursement date,
  p_justificatif_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_credit public.client_credits%rowtype;
  v_item jsonb;
  v_produit uuid;
  v_q integer;
  v_prix integer;
  v_disponible integer;
  v_total bigint := 0;
  v_id uuid;
  v_phone text;
  v_mime text;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if p_pharmacie is null or not exists (
    select 1 from public.pharmacies p where p.id=p_pharmacie and p.actif=true
  ) then raise exception 'Pharmacie indisponible'; end if;
  if p_telephone is null or length(trim(p_telephone)) not between 8 and 24
     or trim(p_telephone) !~ '^[+0-9][0-9 ()-]{7,23}$' then
    raise exception 'Numéro de téléphone invalide';
  end if;
  if p_date_remboursement is null or p_date_remboursement <= current_date then
    raise exception 'La date prévue de remboursement doit être future';
  end if;
  if p_justificatif_path is null
     or (storage.foldername(p_justificatif_path))[1] is distinct from v_user::text
     or length(p_justificatif_path)>500 then
    raise exception 'Justificatif invalide';
  end if;
  select o.metadata->>'mimetype' into v_mime
  from storage.objects o
  where o.bucket_id='credit-marketplace-justificatifs' and o.name=p_justificatif_path;
  if not found or v_mime not in ('application/pdf','image/jpeg','image/png','image/webp') then
    raise exception 'Justificatif absent ou format non autorisé';
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>10 then
    raise exception 'Panier invalide';
  end if;
  if exists (
    select 1 from (
      select value->>'produit_id' pid,count(*) n
      from jsonb_array_elements(p_items) group by value->>'produit_id'
    ) d where d.n>1
  ) then raise exception 'Produit dupliqué dans le panier'; end if;

  -- Le verrou du crédit sérialise les soumissions concurrentes d'un même client/pharmacie.
  select * into v_credit from public.client_credits
  where client_id=v_user and pharmacie_id=p_pharmacie and actif=true
  for update;
  if not found then raise exception 'Crédit client non activé pour cette pharmacie'; end if;
  if v_credit.solde>0 then raise exception 'Un crédit est déjà actif : remboursement requis avant une nouvelle demande'; end if;
  if exists (
    select 1 from public.client_credit_requests q
    where q.client_id=v_user and q.pharmacie_id=p_pharmacie
      and q.statut in ('en_attente','approuvee')
      and q.consumed_at is null
  ) then raise exception 'Une demande de crédit est déjà en cours'; end if;

  for v_item in
    select value from jsonb_array_elements(p_items)
    order by value->>'produit_id'
  loop
    if coalesce(v_item->>'produit_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Référence produit invalide';
    end if;
    v_produit := (v_item->>'produit_id')::uuid;
    v_q := coalesce((v_item->>'quantite')::integer,1);
    if v_q<1 or v_q>10 then raise exception 'Quantité invalide'; end if;
    select o.prix,o.quantite into v_prix,v_disponible
    from public.marketplace_offre_stock_disponible(p_pharmacie,v_produit) o;
    if not found or v_disponible<v_q then
      raise exception 'Stock Marketplace insuffisant pour le produit %',v_produit;
    end if;
    v_total := v_total + v_prix::bigint*v_q;
  end loop;
  if v_total<=0 or v_total>2147483647 then raise exception 'Montant de demande invalide'; end if;

  v_phone := regexp_replace(trim(p_telephone),'[[:space:]()-]','','g');
  insert into public.client_credit_requests(
    credit_id,pharmacie_id,client_id,montant,statut,requested_by,
    origine,telephone_demande,date_remboursement,justificatif_path,panier_items
  ) values (
    v_credit.id,p_pharmacie,v_user,v_total::integer,'en_attente',v_user,
    'marketplace',v_phone,p_date_remboursement,p_justificatif_path,
    (select jsonb_agg(jsonb_build_object(
      'produit_id',(value->>'produit_id')::uuid,
      'quantite',coalesce((value->>'quantite')::integer,1)
    ) order by value->>'produit_id') from jsonb_array_elements(p_items))
  ) returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function public.client_credit_marketplace_soumettre(uuid,jsonb,text,date,text) from public,anon;
grant execute on function public.client_credit_marketplace_soumettre(uuid,jsonb,text,date,text) to authenticated;

create or replace function public.client_credit_demande_decider(
  p_demande uuid,
  p_approuver boolean
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  r public.client_credit_requests%rowtype;
  c public.client_credits%rowtype;
  v_reservation uuid;
  v_total integer;
  v_item record;
  v_lot record;
  v_need integer;
  v_take integer;
  v_allocated integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into r from public.client_credit_requests where id=p_demande for update;
  if not found or r.statut<>'en_attente' then raise exception 'Demande introuvable ou déjà traitée'; end if;
  if public.is_admin() is not true and not exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.actif and p.role::text='promoteur' and p.niveau_interne=1
  ) then raise exception 'Décision réservée au Promoteur ou à NAXA'; end if;
  if not public.is_admin() and not public.can_access_pharmacy(r.pharmacie_id) then raise exception 'Pharmacie hors périmètre'; end if;

  if not p_approuver then
    update public.client_credit_requests
      set statut='rejetee',decided_by=auth.uid(),decided_at=now()
      where id=r.id;
    return;
  end if;

  if r.origine='marketplace' then
    if r.panier_items is null or r.reservation_id is not null then
      raise exception 'Panier de crédit absent ou demande déjà réservée';
    end if;
    select * into c from public.client_credits where id=r.credit_id for update;
    if not found or not c.actif or c.solde>0 then
      raise exception 'Le crédit client a changé depuis la soumission';
    end if;
    if exists (
      select 1 from public.client_credit_requests q
      where q.client_id=r.client_id and q.id<>r.id
        and q.statut in ('en_attente','approuvee') and q.consumed_at is null
    ) then raise exception 'Une autre demande de crédit est déjà active'; end if;

    -- Le hold existant réserve les quantités Marketplace sans débiter le stock physique.
    v_reservation := private.reserve_stock(r.pharmacie_id,r.panier_items);
    select total into v_total from public.reservations where id=v_reservation for update;
    if v_total is distinct from r.montant then
      raise exception 'Le prix ou le total du panier a changé : la demande doit être réexaminée';
    end if;

    -- Allocation FEFO logique des lots : elle protège la préparation sans diminuer
    -- physiquement les quantités. Les autres holds sont déduits avant toute allocation.
    for v_item in
      select ri.produit_id,ri.quantite
      from public.reservation_items ri
      where ri.reservation_id=v_reservation
      order by ri.produit_id
    loop
      if exists(select 1 from public.stocks_lots sl where sl.pharmacie_id=r.pharmacie_id and sl.produit_id=v_item.produit_id) then
        v_need:=v_item.quantite;
        for v_lot in
          select sl.id,
            greatest(sl.quantite-coalesce((
              select sum(a.quantite)::integer
              from public.reservation_item_lots a
              join public.reservations active_r on active_r.id=a.reservation_id
              where a.lot_id=sl.id and a.restauree_at is null
                and active_r.statut in ('en_attente','confirmee')
                and active_r.expires_at>now()
                and active_r.consumed_at is null
                and active_r.stock_restored=false
                and active_r.stock_decremented=false
            ),0),0)::integer as disponible
          from public.stocks_lots sl
          where sl.pharmacie_id=r.pharmacie_id and sl.produit_id=v_item.produit_id
            and sl.quantite>0 and not sl.bloque
            and sl.date_peremption is not null and sl.date_peremption>=current_date
          order by sl.date_peremption,sl.numero_lot,sl.id
          for update
        loop
          exit when v_need=0;
          v_take:=least(v_need,v_lot.disponible);
          if v_take>0 then
            insert into public.reservation_item_lots(reservation_id,produit_id,lot_id,quantite)
            values(v_reservation,v_item.produit_id,v_lot.id,v_take);
            v_need:=v_need-v_take;
          end if;
        end loop;
        if v_need<>0 then raise exception 'Lots FEFO disponibles insuffisants pour la préparation du crédit'; end if;
      end if;
    end loop;

    update public.reservations
      set client_id=r.client_id,credit_request_id=r.id,mode='reservation',statut='confirmee'::public.resa_statut,preparation_statut='non_commencee'
      where id=v_reservation;
    update public.client_credit_requests
      set statut='approuvee',decided_by=auth.uid(),decided_at=now(),reservation_id=v_reservation
      where id=r.id;
    return;
  end if;

  -- Conserver le parcours historique des demandes de dépassement issues de la caisse.
  select * into c from public.client_credits where id=r.credit_id for update;
  if not found then raise exception 'Crédit client introuvable'; end if;
  update public.client_credits set updated_at=now() where id=c.id;
  update public.client_credit_requests set statut='approuvee',decided_by=auth.uid(),decided_at=now() where id=r.id;
end
$function$;

revoke all on function public.client_credit_demande_decider(uuid,boolean) from public,anon,authenticated;
grant execute on function public.client_credit_demande_decider(uuid,boolean) to authenticated;

comment on column public.reservations.credit_request_id is
  'Demande de crédit Marketplace ayant déclenché ce hold; une demande approuvée ne réserve qu’une seule fois.';
comment on function public.client_credit_marketplace_soumettre(uuid,jsonb,text,date,text) is
  'Soumet une demande Marketplace avec téléphone, échéance et justificatif privé. Aucun hold n’est créé avant approbation.';
comment on function public.client_credit_demande_decider(uuid,boolean) is
  'Décide une demande de crédit; pour Marketplace, approbation et hold stock sont atomiques, avec allocation FEFO logique sans débit physique.';
commit;
