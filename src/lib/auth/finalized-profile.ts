export type NaxaAuthUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export type NaxaProfile = {
  id: string;
  username?: string | null;
};

/**
 * The auth.users trigger creates a provisional profile with:
 * local-part-of-email + "_" + first four characters of the user id.
 * That generated username is not a completed NAXA registration.
 */
export function isFinalizedNaxaProfile(
  profile: NaxaProfile | null | undefined,
  user: NaxaAuthUser | null | undefined,
): boolean {
  if (!profile?.id || !user || profile.id !== user.id || !user.email_confirmed_at) return false;
  if (user.user_metadata?.naxa_signup_completed === true) return true;

  const username = String(profile.username ?? "").trim().toLowerCase();
  const email = String(user.email ?? "").trim().toLowerCase();
  if (!username || !email || !email.includes("@")) return false;

  const fallbackUsername = `${email.split("@", 1)[0]}_${user.id.slice(0, 4)}`.toLowerCase();
  return username !== fallbackUsername;
}
