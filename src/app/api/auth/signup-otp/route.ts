import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

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
    let existing: { id: string; email_confirmed_at?: string | null } | null = null;
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) {
        console.error("signup OTP account lookup:", error.message);
        return NextResponse.json({ ok: false, error: "Impossible de vérifier ce compte. Réessayez." }, { status: 503 });
      }
      const user = (data.users ?? []).find((item) => item.email?.trim().toLowerCase() === email);
      if (user) {
        existing = { id: user.id, email_confirmed_at: user.email_confirmed_at };
        break;
      }
      if ((data.users ?? []).length < 1000) break;
    }

    if (existing?.email_confirmed_at) {
      return NextResponse.json({ ok: false, error: "Cette adresse e-mail possède déjà un compte confirmé. Connectez-vous ou utilisez « Mot de passe oublié »." }, { status: 409 });
    }

    const userMetadata = {
      username,
      first_name: firstName,
      last_name: lastName,
      phone,
      phone_country: phoneCountry,
      date_of_birth: dateOfBirth,
      consent_accepted: true,
    };

    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, { user_metadata: userMetadata });
      if (error) {
        console.error("signup OTP pending account update:", error.message);
        return NextResponse.json({ ok: false, error: "Impossible de reprendre cette inscription. Réessayez." }, { status: 503 });
      }
    }

    const { error } = await supabaseServer().auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: !existing,
        data: userMetadata,
      },
    });
    if (error) {
      console.error("signup OTP send:", error.message);
      const rateLimited = /rate|too many/i.test(error.message);
      return NextResponse.json({
        ok: false,
        error: rateLimited
          ? "Trop de demandes. Attendez un peu avant de réessayer."
          : "L’envoi du code a échoué. Vérifiez l’adresse e-mail et réessayez.",
      }, { status: rateLimited ? 429 : 502 });
    }

    return NextResponse.json({ ok: true, pendingSignup: Boolean(existing), message: "Un code de confirmation a été envoyé à votre adresse e-mail." });
  } catch {
    return NextResponse.json({ ok: false, error: "Demande invalide. Réessayez." }, { status: 400 });
  }
}
