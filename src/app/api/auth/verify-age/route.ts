import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = supabaseServer();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

    const body = await request.json();
    const value = String(body.date_of_birth ?? "");
    const policiesAccepted = Array.isArray(body.policiesAccepted) ? body.policiesAccepted : [];
    if (policiesAccepted.length !== 3 || policiesAccepted.some((item: unknown) => item !== true)) {
      return NextResponse.json({ error: "Veuillez lire et accepter les trois documents avant de continuer." }, { status: 400 });
    }

    const dob = new Date(value + "T00:00:00");
    if (!value || Number.isNaN(dob.getTime()) || dob > new Date()) {
      return NextResponse.json({ error: "Date de naissance invalide." }, { status: 400 });
    }

    const today = new Date();
    let age = today.getUTCFullYear() - dob.getUTCFullYear();
    const month = today.getUTCMonth() - dob.getUTCMonth();
    if (month < 0 || (month === 0 && today.getUTCDate() < dob.getUTCDate())) age--;
    if (age < 18) return NextResponse.json({ error: "NAXA est réservé aux personnes âgées de 18 ans ou plus." }, { status: 403 });

    const { error } = await supabaseAdmin()
      .from("profiles")
      .update({ date_of_birth:value, age_verified:true })
      .eq("id", auth.user.id);

    if (error) return NextResponse.json({ error: "Validation impossible." }, { status: 500 });
    return NextResponse.json({ ok:true });
  } catch {
    return NextResponse.json({ error:"Validation impossible." }, { status:500 });
  }
}
