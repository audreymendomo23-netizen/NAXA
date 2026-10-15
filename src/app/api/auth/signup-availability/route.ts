import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isFinalizedNaxaProfile } from "@/lib/auth/finalized-profile";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").replace(/\s+/g, "");
    const phoneDigits = phone.replace(/\D/g, "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Saisissez une adresse e-mail valide." }, { status: 400 });
    }
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      return NextResponse.json({ ok: false, error: "Saisissez un numéro de téléphone valide avec son indicatif." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const perPage = 1000;
    const usersWithPhone: Array<{ id: string; user: { id: string; email?: string | null; email_confirmed_at?: string | null; user_metadata?: Record<string, unknown> | null } }> = [];
    let pendingEmailUserId: string | null = null;
    let finished = false;

    // Un compte Auth sans profil NAXA finalisé ne réserve pas ses coordonnées.
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error("signup availability lookup:", error.message);
        return NextResponse.json({ ok: false, error: "Vérification des coordonnées impossible. Réessayez." }, { status: 503 });
      }

      const users = data.users ?? [];
      for (const user of users) {
        const sameEmail = user.email?.trim().toLowerCase() === email;
        if (sameEmail) {
          const { data: profile, error: profileError } = await admin
            .from("profiles")
            .select("id, username")
            .eq("id", user.id)
            .maybeSingle();
          if (profileError) {
            console.error("signup availability profile lookup:", profileError.message);
            return NextResponse.json({ ok: false, error: "Vérification des coordonnées impossible. Réessayez." }, { status: 503 });
          }
          if (profile && isFinalizedNaxaProfile(profile, user)) {
            return NextResponse.json({ ok: false, field: "email", error: "Cette adresse e-mail possède déjà un compte confirmé. Connectez-vous ou utilisez « Mot de passe oublié »." }, { status: 409 });
          }
          pendingEmailUserId = user.id;
        }

        const existingPhone = String(user.user_metadata?.phone ?? "").replace(/\D/g, "");
        if (existingPhone && existingPhone === phoneDigits) usersWithPhone.push({ id: user.id, user });
      }

      if (users.length < perPage) {
        finished = true;
        break;
      }
    }

    if (!finished) {
      return NextResponse.json({ ok: false, error: "Vérification impossible pour le moment. Réessayez." }, { status: 503 });
    }

    // Métadonnées Auth et profil peuvent diverger : vérifier les deux sources.
    // Seul un compte NAXA finalisé réserve le numéro; un profil provisoire ne le bloque pas.
    const checkedUserIds = new Set<string>();
    for (const candidate of usersWithPhone) {
      if (candidate.id === pendingEmailUserId) continue;
      checkedUserIds.add(candidate.id);
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id, username, phone")
        .eq("id", candidate.id)
        .maybeSingle();
      if (profileError) {
        console.error("signup availability phone profile lookup:", profileError.message);
        return NextResponse.json({ ok: false, error: "Vérification des coordonnées impossible. Réessayez." }, { status: 503 });
      }
      const metadataPhone = String(candidate.user.user_metadata?.phone ?? "").replace(/\D/g, "");
      const profilePhone = String(profile?.phone ?? "").replace(/\D/g, "");
      if ((metadataPhone === phoneDigits || profilePhone === phoneDigits)
        && profile && isFinalizedNaxaProfile(profile, candidate.user)) {
        return NextResponse.json({ ok: false, field: "phone", error: "Ce numéro de téléphone est déjà utilisé par un autre compte." }, { status: 409 });
      }
    }

    // Inclure les comptes finalisés dont le téléphone n'est présent que dans profiles.phone.
    const { data: matchingProfiles, error: matchingProfilesError } = await admin
      .from("profiles")
      .select("id, username, phone")
      .eq("phone", phone);
    if (matchingProfilesError) {
      console.error("signup availability profile phone lookup:", matchingProfilesError.message);
      return NextResponse.json({ ok: false, error: "Vérification des coordonnées impossible. Réessayez." }, { status: 503 });
    }
    for (const profile of matchingProfiles ?? []) {
      if (profile.id === pendingEmailUserId || checkedUserIds.has(profile.id)) continue;
      const { data: authResult, error: authLookupError } = await admin.auth.admin.getUserById(profile.id);
      if (authLookupError) {
        console.error("signup availability profile auth lookup:", authLookupError.message);
        return NextResponse.json({ ok: false, error: "Vérification des coordonnées impossible. Réessayez." }, { status: 503 });
      }
      if (authResult.user && isFinalizedNaxaProfile(profile, authResult.user)) {
        return NextResponse.json({ ok: false, field: "phone", error: "Ce numéro de téléphone est déjà utilisé par un autre compte." }, { status: 409 });
      }
    }

    return NextResponse.json({ ok: true, available: true, pendingSignup: Boolean(pendingEmailUserId) });
  } catch {
    return NextResponse.json({ ok: false, error: "Vérification impossible pour le moment. Réessayez." }, { status: 400 });
  }
}
