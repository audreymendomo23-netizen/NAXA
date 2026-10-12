import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

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
    let phoneAlreadyUsed = false;

    // L’adresse et le téléphone sont recherchés dans les métadonnées Auth :
    // le téléphone est fourni à Supabase au moment de l’inscription OTP.
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error("signup availability lookup:", error.message);
        return NextResponse.json({ ok: false, error: "Vérification des coordonnées impossible. Réessayez." }, { status: 503 });
      }

      const users = data.users ?? [];
      for (const user of users) {
        if (user.email?.trim().toLowerCase() === email) {
          return NextResponse.json({ ok: false, field: "email", error: "Cette adresse e-mail est déjà prise." }, { status: 409 });
        }
        const existingPhone = String(user.user_metadata?.phone ?? "").replace(/\D/g, "");
        if (existingPhone && existingPhone === phoneDigits) phoneAlreadyUsed = true;
      }

      if (users.length < perPage) {
        if (phoneAlreadyUsed) {
          return NextResponse.json({ ok: false, field: "phone", error: "Ce numéro de téléphone est déjà utilisé." }, { status: 409 });
        }
        return NextResponse.json({ ok: true, available: true });
      }
    }

    return NextResponse.json({ ok: false, error: "Vérification impossible pour le moment. Réessayez." }, { status: 503 });
  } catch {
    return NextResponse.json({ ok: false, error: "Vérification impossible pour le moment. Réessayez." }, { status: 400 });
  }
}
