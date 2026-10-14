import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { isFinalizedNaxaProfile } from "@/lib/auth/finalized-profile";

type SignupBody = {
  email?: unknown;
  username?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  phone?: unknown;
  phone_country?: unknown;
  date_of_birth?: unknown;
  consent_accepted?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignupBody;
    const email = String(body.email ?? "").trim().toLowerCase();
    const username = String(body.username ?? "").trim().toLowerCase();
    const firstName = String(body.first_name ?? "").trim();
    const lastName = String(body.last_name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const phoneCountry = String(body.phone_country ?? "").trim();
    const dateOfBirth = String(body.date_of_birth ?? "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || !/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)
      || firstName.length < 2 || lastName.length < 2
      || !/^\+[1-9]\d{6,14}$/.test(phone)
      || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
      || body.consent_accepted !== true) {
      return NextResponse.json({ ok: false, error: "Certaines informations sont invalides. Vérifiez le formulaire." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    let existing: { id: string; email_confirmed_at?: string | null; email?: string | null; user_metadata?: Record<string, unknown> | null } | null = null;
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) {
        console.error("signup OTP account lookup:", error.message);
        return NextResponse.json({ ok: false, error: "Impossible de vérifier ce compte. Réessayez." }, { status: 503 });
      }
      const user = (data.users ?? []).find((item) => item.email?.trim().toLowerCase() === email);
      if (user) {
        existing = { id: user.id, email_confirmed_at: user.email_confirmed_at, email: user.email, user_metadata: user.user_metadata as Record<string, unknown> | null };
        break;
      }
      if ((data.users ?? []).length < 1000) break;
    }

    if (existing) {
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id, username")
        .eq("id", existing.id)
        .maybeSingle();
      if (profileError) {
        console.error("signup OTP profile lookup:", profileError.message);
        return NextResponse.json({ ok: false, error: "Impossible de vérifier ce compte. Réessayez." }, { status: 503 });
      }
      if (profile && isFinalizedNaxaProfile(profile, existing)) {
        return NextResponse.json({ ok: false, error: "Cette adresse e-mail possède déjà un compte confirmé. Connectez-vous ou utilisez « Mot de passe oublié »." }, { status: 409 });
      }

      // Un profil provisoire n'est pas un compte NAXA : effacer les seules métadonnées
      // d'inscription éventuelles, sans supprimer l'utilisateur Auth ni ses autres métadonnées.
      const metadata = { ...(existing.user_metadata ?? {}) };
      const metadataKeys = ["username", "first_name", "last_name", "phone", "phone_country", "date_of_birth", "consent_accepted", "naxa_signup_completed"];
      const hadSignupMetadata = metadataKeys.some((key) => Object.prototype.hasOwnProperty.call(metadata, key))
        || metadata.naxa_signup_pending !== true;
      for (const key of metadataKeys) delete metadata[key];
      metadata.naxa_signup_pending = true;
      if (hadSignupMetadata) {
        const { error: clearError } = await admin.auth.admin.updateUserById(existing.id, { user_metadata: metadata });
        if (clearError) {
          console.error("signup OTP pending metadata cleanup:", clearError.message);
          return NextResponse.json({ ok: false, error: "Impossible de reprendre cette inscription. Réessayez." }, { status: 503 });
        }
      }
    }

    const authClient = supabaseServer();
    // Même flux OTP e-mail pour les nouveaux comptes et les inscriptions en attente.
    const { error } = await authClient.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: { naxa_signup_pending: true },
      },
    });
    if (error) {
      console.error("signup OTP send:", error.message);
      const rateLimited = /rate|too many|for security purposes|only request this after|after \\d+ seconds/i.test(error.message);
      return NextResponse.json({
        ok: false,
        error: rateLimited
          ? "Attendez environ 55 secondes avant de demander un nouveau code."
          : "L’envoi du code a échoué. Vérifiez l’adresse e-mail et réessayez.",
      }, { status: rateLimited ? 429 : 502 });
    }

    return NextResponse.json({ ok: true, pendingSignup: Boolean(existing), message: "Un code de confirmation a été envoyé à votre adresse e-mail." });
  } catch {
    return NextResponse.json({ ok: false, error: "Demande invalide. Réessayez." }, { status: 400 });
  }
}
