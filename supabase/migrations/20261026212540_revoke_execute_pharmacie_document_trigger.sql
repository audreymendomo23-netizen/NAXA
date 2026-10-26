-- Cette fonction est appelée uniquement par le trigger ; elle ne doit pas être exposée comme RPC.
revoke all on function public.journaliser_pharmacie_document() from public, anon, authenticated;
