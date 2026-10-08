import { supabaseAdmin } from "@/lib/supabase/server";

const MAX_SESSIONS = 4;

export async function hasAvailableSessionSlot(userId: string) {
  const { data, error } = await supabaseAdmin().rpc("naxa_session_count", { p_user_id: userId });
  if (error) throw error;
  return Number(data ?? 0) < MAX_SESSIONS;
}

export const MAX_CONCURRENT_SESSIONS = MAX_SESSIONS;
