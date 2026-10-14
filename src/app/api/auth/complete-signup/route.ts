import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isFinalizedNaxaProfile } from "@/lib/auth/finalized-profile";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: "Session invalide. Reconnectez-vous pour terminer l’inscription." }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
    const user = authData.user;
    if (authError || !user || !user.email_confirmed_at) {
      return NextResponse.json({ ok: false, error: "Confirmez d’abord votre adresse e-mail pour terminer l’inscription." }, { status: 401 });
    }

    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const firstName = String(body.first_name ?? "").trim();
    const lastName = String(body.last_name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const phoneCountry = String(body.phone_country ?? "").trim();
    const dateOfBirth = String(body.date_of_birth ?? "").trim();
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)
      || firstName.length < 2 || lastName.length < 2
      || !/^\+[1-9]\d{6,14}$/.test(phone)
      || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
      || body.consent_accepted !== true) {
      return NextResponse.json({ ok: false, error: "Certaines informations du profil sont invalides." }, { status: 400 });
    }

    const { data: currentProfile, error: currentProfileError } = await admin
      .from("profiles")
      .select("id, username")
      .eq("id", user.id)
      .maybeSingle();
    if (currentProfileError || !currentProfile) {
      console.error("signup profile prerequisite:", currentProfileError?.message ?? "profile missing");
      return NextResponse.json({ ok: false, error: "Le profil provisoire est introuvable. Réessayez l’inscription." }, { status: 503 });
    }

    const { data: matchingProfiles, error: lookupError } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .neq("id", user.id)
      .limit(2);
    if (lookupError) {
      console.error("signup profile username lookup:", lookupError.message);
      return NextResponse.json({ ok: false, error: "Impossible de vérifier le nom d’utilisateur. Réessayez." }, { status: 503 });
    }
    if (matchingProfiles?.length) {
      return NextResponse.json({ ok: false, error: "Ce nom d’utilisateur est déjà utilisé. Revenez au formulaire et choisissez-en un autre." }, { status: 409 });
    }

    // Vérifier à nouveau le téléphone au moment de finaliser, en ignorant les profils provisoires.
    const phoneDigits = phone.replace(/\D/g, "");
    let usersPage = 1;
    while (usersPage <= 100) {
      const { data, error } = await admin.auth.admin.listUsers({ page: usersPage, perPage: 1000 });
      if (error) {
        console.error("signup profile phone lookup:", error.message);
        return NextResponse.json({ ok: false, error: "Impossible de vérifier le numéro de téléphone. Réessayez." }, { status: 503 });
      }
      const users = data.users ?? [];
      for (const candidate of users) {
        if (candidate.id === user.id) continue;
        const existingPhone = String(candidate.user_metadata?.phone ?? "").replace(/\D/g, "");
        if (!existingPhone || existingPhone !== phoneDigits) continue;

        const { data: otherProfile, error: otherProfileError } = await admin
          .from("profiles")
          .select("id, username")
          .eq("id", candidate.id)
          .maybeSingle();
        if (otherProfileError) {
          console.error("signup profile phone profile lookup:", otherProfileError.message);
          return NextResponse.json({ ok: false, error: "Impossible de vérifier le numéro de téléphone. Réessayez." }, { status: 503 });
        }
        if (otherProfile && isFinalizedNaxaProfile(otherProfile, candidate)) {
          return NextResponse.json({ ok: false, error: "Ce numéro de téléphone est déjà utilisé par un autre compte." }, { status: 409 });
        }
      }
      if (users.length < 1000) break;
      usersPage += 1;
    }
    if (usersPage > 100) {
      return NextResponse.json({ ok: false, error: "Vérification du numéro impossible pour le moment. Réessayez." }, { status: 503 });
    }

    // Mettre à jour le profil d'abord. Si l'écriture des métadonnées échoue, restaurer
    // le nom précédent afin de ne pas laisser une inscription partiellement finalisée.
    const { data: updatedProfile, error: profileError } = await admin
      .from("profiles")
      .update({ username })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();
    if (profileError || !updatedProfile) {
      console.error("signup profile save:", profileError?.message ?? "profile update affected no rows");
      return NextResponse.json({ ok: false, error: "Impossible d’enregistrer le profil. Réessayez." }, { status: 503 });
    }

    const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata ?? {}),
        username,
        first_name: firstName,
        last_name: lastName,
        phone,
        phone_country: phoneCountry,
        date_of_birth: dateOfBirth,
        consent_accepted: true,
        naxa_signup_completed: true,
      },
    });
    if (metadataError) {
      console.error("signup profile metadata save:", metadataError.message);
      const { error: rollbackError } = await admin
        .from("profiles")
        .update({ username: currentProfile.username })
        .eq("id", user.id);
      if (rollbackError) console.error("signup profile rollback failed:", rollbackError.message);
      return NextResponse.json({ ok: false, error: "Impossible de finaliser le compte. Réessayez sans quitter le formulaire." }, { status: 503 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Impossible de terminer l’inscription. Réessayez." }, { status: 400 });
  }
}
