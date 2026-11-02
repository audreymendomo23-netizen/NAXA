-- The Promoter may first declare the payment, then attach a supporting file from T+1h.
alter table public.abonnement_promoteur_reglements
  alter column preuve_path drop not null;

comment on column public.abonnement_promoteur_reglements.preuve_path is
  'Optional supporting file. The Promoter may attach a photo/PDF once one hour has elapsed after declared_at.';
