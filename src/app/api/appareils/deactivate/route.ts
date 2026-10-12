import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { PHARMACIE_SCHEMA as S } from "@/lib/pharmacie-schema";

export async function POST(req: NextRequest) {
  try {
    const { data: { user }, error } = await supabaseServer().auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
    const { data: actor } = await supabaseAdmin().from(S.profilesTable)
      .select([S.profileIdColumn,S.profilePharmacyIdColumn,S.profileRoleColumn,S.profileActiveColumn].join(","))
      .eq(S.profileIdColumn,user.id).maybeSingle();
    const actorRecord = actor as unknown as Record<string, unknown> | null;
    const role = String(actorRecord?.[S.profileRoleColumn] || "");
    if (!actorRecord || actorRecord[S.profileActiveColumn] === false || !["promoteur","admin"].includes(role)) {
      return NextResponse.json({ error: "Action réservée au promoteur ou à l'administrateur NAXA." }, { status: 403 });
    }
    const body = await req.json(), deviceId = String(body.deviceId || "");
    if (!deviceId) return NextResponse.json({ error: "Identifiant appareil requis." }, { status: 400 });
    const query = supabaseAdmin().from(S.devicesTable).update({ [S.deviceActiveColumn]: false }).eq(S.deviceIdColumn,deviceId);
    if (role === "promoteur") {
      const { data: links, error: linksError } = await supabaseAdmin().from(S.promoterPharmaciesTable)
        .select(S.devicePharmacyIdColumn).eq(S.promoterProfileIdColumn,user.id).eq(S.promoterLinkActiveColumn,true);
      if (linksError || !links?.length) return NextResponse.json({ error: "Aucune pharmacie gérée par ce promoteur." }, { status: 403 });
      query.in(S.devicePharmacyIdColumn, links.map((x: Record<string,string>) => x[S.devicePharmacyIdColumn]));
    }
    const { data, error: updateError } = await query.select(S.deviceIdColumn).maybeSingle();
    if (updateError || !data) return NextResponse.json({ error: "Appareil introuvable ou non autorisé." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Désactivation impossible." }, { status: 500 });
  }
}
