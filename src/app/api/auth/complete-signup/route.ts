import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

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

    const { data: otherProfile, error: lookupError } = await admin
      .from("profiles").select("id").ilike("username", username).neq("id", user.id).maybeSingle();
    if (lookupError) {
      console.error("signup profile username lookup:", lookupError.message);
      return NextResponse.json({ ok: false, error: "Impossible de vérifier le nom d’utilisateur. Réessayez." }, { status: 503 });
    }
    if (otherProfile) {
      return NextResponse.json({ ok: false, error: "Ce nom d’utilisateur est déjà utilisé. Revenez au formulaire et choisissez-en un autre." }, { status: 409 });
    }

    const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        username,
        first_name: firstName,
        last_name: lastName,
        phone,
        phone_country: phoneCountry,
        date_of_birth: dateOfBirth,
        consent_accepted: true,
      },
    });
    if (metadataError) {
      console.error("signup profile metadata save:", metadataError.message);
      return NextResponse.json({ ok: false, error: "Impossible d’enregistrer les informations du compte. Réessayez." }, { status: 503 });
    }

    const { error: profileError } = await admin.from("profiles").update({ username }).eq("id", user.id);
    if (profileError) {
      console.error("signup profile save:", profileError.message);
      return NextResponse.json({ ok: false, error: "Le compte est créé, mais le nom d’utilisateur n’a pas pu être enregistré. Réessayez." }, { status: 503 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Impossible de terminer l’inscription. Réessayez." }, { status: 400 });
  }
}
