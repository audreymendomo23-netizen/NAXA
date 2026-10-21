// NAXA Comptable — worker outbox.
 // Déclenchement : cron Supabase toutes les 15 minutes (configuration opérationnelle séparée).
 // Secrets requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COMPTA_WORKER_SECRET.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "null",
  "Access-Control-Allow-Headers": "authorization, x-compta-worker-secret, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Méthode non autorisée", { status: 405, headers: corsHeaders });

  const expectedSecret = Deno.env.get("COMPTA_WORKER_SECRET");
  const suppliedSecret = request.headers.get("x-compta-worker-secret");
  if (!expectedSecret || !suppliedSecret || suppliedSecret.length !== expectedSecret.length) {
    return new Response("Non autorisé", { status: 401, headers: corsHeaders });
  }
  let secretMatches = 0;
  for (let i = 0; i < expectedSecret.length; i++) {
    secretMatches |= expectedSecret.charCodeAt(i) ^ suppliedSecret.charCodeAt(i);
  }
  if (secretMatches !== 0) return new Response("Non autorisé", { status: 401, headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return new Response("Configuration worker incomplète", { status: 500, headers: corsHeaders });

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: claimed, error: claimError } = await supabase.rpc("compta_evenements_reclamer", { p_limite: 50 });
  if (claimError) {
    return Response.json({ ok: false, error: "reclamation_indisponible" }, { status: 500, headers: corsHeaders });
  }

  let traite = 0;
  let aTraiter = 0;
  let erreurs = 0;
  for (const event of (claimed ?? [])) {
    const { data, error } = await supabase.rpc("compta_traiter_evenement", {
      p_evenement: event.event_id,
      p_claim_token: event.claim_token,
    });
    if (error) {
      // Le worker SQL enregistre déjà une tentative lorsque le traitement métier échoue.
      // Si l'appel réseau a échoué avant l'exécution, le bail expirera et l'événement sera repris.
      erreurs++;
      continue;
    }
    if (data === "traite") traite++;
    else if (data === "erreur") erreurs++;
    else aTraiter++;
  }

  return Response.json({
    ok: erreurs === 0,
    reclames: (claimed ?? []).length,
    traite,
    a_traiter: aTraiter,
    erreurs,
  }, { status: erreurs > 0 ? 207 : 200, headers: corsHeaders });
});
