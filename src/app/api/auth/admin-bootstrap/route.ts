import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EMAIL = "naxa.home@gmail.com";

function secretMatches(provided: string | null, expected: string | undefined) {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length
    && timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  if (!secretMatches(
    request.headers.get("x-naxa-bootstrap-secret"),
    process.env.NAXA_ADMIN_BOOTSTRAP_SECRET,
  )) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (typeof body.email !== "string" || body.email.trim().toLowerCase() !== ALLOWED_EMAIL) {
    return NextResponse.json({ error: "Adresse non autorisée." }, { status: 403 });
  }

  const admin = supabaseAdmin();
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    return NextResponse.json({ error: "Vérification du compte impossible." }, { status: 500 });
  }

  const user = listed.users.find(
    (candidate) => candidate.email?.trim().toLowerCase() === ALLOWED_EMAIL,
  );
  if (!user) {
    return NextResponse.json(
      { error: "Crée d’abord le compte avec cette adresse, puis confirme l’email avant le bootstrap." },
      { status: 409 },
    );
  }
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: "L’adresse email doit être confirmée avant le bootstrap." },
      { status: 409 },
    );
  }

  const { error: bootstrapError } = await admin.rpc("naxa_bootstrap_first_admin", {
    p_user_id: user.id,
  });
  if (bootstrapError) {
    if (/administrateur existe déjà/i.test(bootstrapError.message)) {
      return NextResponse.json({ error: "Le premier administrateur a déjà été créé." }, { status: 409 });
    }
    if (/Adresse non autorisée/i.test(bootstrapError.message)) {
      return NextResponse.json({ error: "Adresse non autorisée." }, { status: 403 });
    }
    return NextResponse.json({ error: "Bootstrap administrateur impossible." }, { status: 500 });
  }

  const { data: updated, error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, role: "admin" },
  });
  if (metadataError || !updated.user) {
    return NextResponse.json(
      { error: "Profil administrateur créé, mais actualisation des métadonnées Auth incomplète." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, message: "Premier administrateur NAXA créé." });
}
