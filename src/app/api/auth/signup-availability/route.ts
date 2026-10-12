import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").replace(/\s+/g, "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Saisissez une adresse e-mail valide." }, { status: 400 });
    }
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      return NextResponse.json({ ok: false, error: "Saisissez un numéro de téléphone valide avec son indicatif." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data: phoneMatch, error: phoneError } = await admin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .limit(1);

    if (phoneError) {
      console.error("signup phone availability:", phoneError.message);
      return NextResponse.json({ ok: false, error: "Vérification du téléphone impossible. Réessayez." }, { status: 503 });
    }
    if (phoneMatch?.length) {
      return NextResponse.json({ ok: false, field: "phone", error: "Ce numéro de téléphone est déjà utilisé." }, { status: 409 });
    }

    // Supabase Auth ne propose pas de recherche admin directe par e-mail.
    // Parcourir les pages est nécessaire pour fournir le message demandé sans exposer les adresses.
    const perPage = 1000;
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error("signup email availability:", error.message);
        return NextResponse.json({ ok: false, error: "Vérification de l’adresse e-mail impossible. Réessayez." }, { status: 503 });
      }
      const users = data.users ?? [];
      if (users.some((user) => user.email?.trim().toLowerCase() === email)) {
        return NextResponse.json({ ok: false, field: "email", error: "Cette adresse e-mail est déjà prise." }, { status: 409 });
      }
      if (users.length < perPage) return NextResponse.json({ ok: true, available: true });
    }

    return NextResponse.json({ ok: false, error: "Vérification impossible pour le moment. Réessayez." }, { status: 503 });
  } catch {
    return NextResponse.json({ ok: false, error: "Vérification impossible pour le moment. Réessayez." }, { status: 400 });
  }
}
