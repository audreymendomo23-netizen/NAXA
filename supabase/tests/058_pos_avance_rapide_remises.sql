-- NAXA ERP-003 — test structurel étapes 7/8/9
select to_regclass('public.vente_vouchers') is not null as vouchers_exists;
select to_regclass('public.pos_favoris') is not null as favoris_exists;
select to_regclass('public.pos_paniers_attente') is not null as paniers_attente_exists;
select to_regclass('public.pos_affichage_client') is not null as affichage_client_exists;
select to_regclass('public.pos_promotions') is not null as promotions_exists;
select to_regclass('public.pos_remise_demandes') is not null as remise_requests_exists;
select has_function_privilege('authenticated','public.vente_payer_voucher(uuid,uuid,integer)','EXECUTE') as authenticated_can_voucher;
select has_function_privilege('authenticated','public.vente_payer_assurance(uuid,uuid,integer)','EXECUTE') as authenticated_can_assurance;
select has_function_privilege('authenticated','public.client_credit_enregistrer_vente(uuid,integer,text)','EXECUTE') as authenticated_can_credit;
select has_function_privilege('authenticated','public.pos_panier_mettre_attente(uuid,text)','EXECUTE') as authenticated_can_hold;
select has_function_privilege('authenticated','public.pos_panier_reprendre(uuid)','EXECUTE') as authenticated_can_resume;
select has_function_privilege('authenticated','public.pos_affichage_client_update(uuid,uuid,jsonb)','EXECUTE') as authenticated_can_customer_display;
select has_function_privilege('authenticated','public.vente_remise_demander(uuid,integer,uuid)','EXECUTE') as authenticated_can_discount_request;
select has_function_privilege('authenticated','public.vente_remise_decider(uuid,boolean)','EXECUTE') as authenticated_can_discount_decide;
select has_function_privilege('anon','public.vente_payer_voucher(uuid,uuid,integer)','EXECUTE') = false as anon_cannot_voucher;
select has_function_privilege('anon','public.vente_remise_decider(uuid,boolean)','EXECUTE') = false as anon_cannot_discount_decide;

select has_function_privilege('authenticated','public.vente_voucher_creer(uuid,text,integer,timestamptz)','EXECUTE') as authenticated_can_create_voucher;
select has_function_privilege('authenticated','public.pos_promotion_creer(uuid,text,text,integer,integer,boolean,timestamptz,timestamptz)','EXECUTE') as authenticated_can_create_promotion;
select has_function_privilege('anon','public.vente_voucher_creer(uuid,text,integer,timestamptz)','EXECUTE') = false as anon_cannot_create_voucher;
