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
    const usersWithPhone: string[] = [];
    let pendingEmailUserId: string | null = null;

    // Une inscription non confirmée peut être reprise avec la même adresse.
    // Une adresse déjà confirmée reste indisponible pour une nouvelle inscription.
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
          if (user.email_confirmed_at) {
            return NextResponse.json({ ok: false, field: "email", error: "Cette adresse e-mail possède déjà un compte confirmé. Connectez-vous ou utilisez « Mot de passe oublié »." }, { status: 409 });
          }
          pendingEmailUserId = user.id;
        }
        const existingPhone = String(user.user_metadata?.phone ?? "").replace(/\D/g, "");
        if (existingPhone && existingPhone === phoneDigits) usersWithPhone.push(user.id);
      }

      if (users.length < perPage) {
        // Identifier d’abord le compte e-mail en attente évite un faux doublon dû à l’ordre de pagination.\n        const phoneAlreadyUsed = usersWithPhone.some((userId) => userId !== pendingEmailUserId);\n        if (phoneAlreadyUsed) {
          return NextResponse.json({ ok: false, field: "phone", error: "Ce numéro de téléphone est déjà utilisé par un autre compte." }, { status: 409 });
        }
        return NextResponse.json({ ok: true, available: true, pendingSignup: Boolean(pendingEmailUserId) });
      }
    }

    return NextResponse.json({ ok: false, error: "Vérification impossible pour le moment. Réessayez." }, { status: 503 });
  } catch {
    return NextResponse.json({ ok: false, error: "Vérification impossible pour le moment. Réessayez." }, { status: 400 });
  }
}
