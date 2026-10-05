-- NAXA 020 — tests structurels d'acceptation
begin;

do $$
declare c integer; has_responsable_enum boolean;
begin
  select count(*) into c from public.naxa_privileges;
  if c < 80 then raise exception 'Catalogue privilèges incomplet: %',c; end if;

  -- 016 a historiquement ajouté la valeur enum responsable. PostgreSQL ne permet pas
  -- de retirer proprement une valeur d'enum sans recréer le type, ce que nous refusons
  -- pour préserver l'existant. La règle canonique est donc : aucune utilisation active
  -- de cette valeur ; Responsable est porté par fonction_interne/niveau_interne.
  select exists(
    select 1 from public.profiles where role::text='responsable'
  ) into has_responsable_enum;
  if has_responsable_enum then raise exception 'Contradiction: un profil utilise encore role_type=responsable'; end if;

  if not exists(select 1 from public.naxa_privileges where code='CREATE_RESPONSABLE') then raise exception 'CREATE_RESPONSABLE absent'; end if;
  if not exists(select 1 from public.naxa_privileges where code='CREATE_CAISSE') then raise exception 'CREATE_CAISSE absent'; end if;
  if not exists(select 1 from public.naxa_privileges where code='CHANGE_ARCHITECTURE' and governance_only) then raise exception 'CHANGE_ARCHITECTURE doit être gouvernance'; end if;

  if exists(select 1 from public.naxa_architecture_privileges where architecture_code in ('ORPHELIN','PARENTS_ENFANTS') and role_key='responsable') then
    raise exception 'Contradiction: Responsable exposé dans A1/A2';
  end if;
  if exists(select 1 from public.naxa_architecture_privileges where architecture_code in ('ORPHELIN','PARENTS_ENFANTS') and role_key='promoteur' and privilege_code='CREATE_RESPONSABLE') then
    raise exception 'Contradiction: Promoteur ne peut pas créer Responsable en A1/A2';
  end if;
  if not exists(select 1 from public.naxa_architecture_privileges where architecture_code='PARENTS_AINES_CADETS' and role_key='promoteur' and privilege_code='CREATE_RESPONSABLE') then
    raise exception 'A3 doit permettre au Promoteur de créer Responsable';
  end if;

  if not exists(select 1 from public.naxa_architecture_privileges where architecture_code='PARENTS_AINES_CADETS' and role_key='responsable' and privilege_code='CREATE_CAISSE') then
    raise exception 'A3 ne permet pas au Responsable de gérer une Caisse';
  end if;

  if exists(select 1 from public.naxa_role_privileges where role_key='caisse' and privilege_code in ('CREATE_RESPONSABLE','MANAGE_RESPONSABLES','CHANGE_ARCHITECTURE','MANAGE_NAXA_PRIVILEGES')) then
    raise exception 'Caisse possède un privilège supérieur interdit';
  end if;
end $$;

rollback;
