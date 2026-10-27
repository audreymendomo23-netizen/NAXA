-- Le paiement est déclaré par le Promoteur. L’Administrateur ne fait que vérifier puis confirmer ou contester.
-- Désactive l’ancienne RPC qui permettait à l’Administrateur d’enregistrer lui-même le paiement.
revoke all on function public.admin_enregistrer_reglement_promoteur(uuid, integer, text, text, text, timestamptz, text, uuid)
from public, anon, authenticated, service_role;
