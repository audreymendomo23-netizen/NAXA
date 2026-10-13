import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}

export async function POST() {
  try {
    const auth = await supabaseServer().auth.getUser();
    const user = auth.data.user;
    if (auth.error || !user) {
      return NextResponse.json({ sent: false, error: "Connectez-vous pour confirmer l’envoi du courrier de bienvenue." }, { status: 401 });
    }
    if (!user.email || !user.email_confirmed_at) {
      return NextResponse.json({ sent: false, error: "L’adresse e-mail doit être confirmée avant l’envoi." }, { status: 409 });
    }

    const admin = supabaseAdmin();
    const { data: current, error: lookupError } = await admin.auth.admin.getUserById(user.id);
    if (lookupError || !current.user) {
      console.error("welcome email user lookup failed");
      return NextResponse.json({ sent: false, error: "Impossible de vérifier le compte." }, { status: 503 });
    }
    if (current.user.app_metadata?.naxa_welcome_email_sent_at) {
      return NextResponse.json({ sent: true, alreadySent: true });
    }

    const googleScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    const googleScriptSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    const privacyContact = process.env.NAXA_PRIVACY_CONTACT_EMAIL;
    if (!googleScriptUrl || !googleScriptSecret || !siteUrl || !privacyContact) {
      return NextResponse.json({ sent: false, error: "Le courrier Google n’est pas encore configuré. L’envoi n’est pas confirmé." }, { status: 503 });
    }

    const firstName = escapeHtml(String(user.user_metadata?.first_name ?? ""));
    const termsUrl = `${siteUrl}/conditions-utilisation`;
    const privacyUrl = `${siteUrl}/politique-confidentialite`;
    const termsVersion = "12 octobre 2026";
    const privacyVersion = "12 octobre 2026";
    const html = `<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;color:#102a43;line-height:1.65;max-width:640px;margin:auto;padding:24px"><div style="border-radius:16px;background:#e6fffb;padding:22px"><p style="margin:0;color:#047d78;font-weight:bold;letter-spacing:2px">NAXA</p><h1 style="color:#054a45;margin-bottom:8px">Bienvenue${firstName ? `, ${firstName}` : ""} !</h1><p style="margin-top:0">Votre adresse e-mail est confirmée et votre compte NAXA est prêt.</p></div><p>Merci de rejoindre NAXA. Vous pouvez maintenant accéder aux fonctionnalités disponibles pour votre compte.</p><h2 style="font-size:18px">Vos documents</h2><p><a href="${termsUrl}">Conditions générales d’utilisation</a> — version du ${termsVersion}<br><a href="${privacyUrl}">Politique de confidentialité</a> — version du ${privacyVersion}</p><p>Pour toute question relative à vos données personnelles, écrivez à <a href="mailto:${escapeHtml(privacyContact)}">${escapeHtml(privacyContact)}</a>.</p><p style="font-size:12px;color:#52606d">Ce message est automatique, envoyé à la suite de la confirmation de votre compte NAXA. Il ne s’agit pas d’un message publicitaire.</p><p>À bientôt,<br><strong>L’équipe NAXA</strong></p></body></html>`;

    const response = await fetch(googleScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: googleScriptSecret,
        to: user.email,
        subject: "Bienvenue sur NAXA — votre compte est prêt",
        html,
        idempotencyKey: `naxa-welcome-${user.id}`,
      }),
      cache: "no-store",
    });

    let result: { sent?: boolean; alreadySent?: boolean } | null = null;
    try { result = await response.json(); } catch { /* Invalid provider response: never claim success. */ }
    if (!response.ok || result?.sent !== true) {
      console.error("Google Apps Script did not confirm welcome email", response.status);
      return NextResponse.json({ sent: false, error: "Google n’a pas confirmé l’envoi. Vous pourrez réessayer." }, { status: 502 });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...current.user.app_metadata,
        naxa_welcome_email_sent_at: new Date().toISOString(),
      },
    });
    if (updateError) {
      console.error("welcome email sent but Supabase status could not be saved; Google idempotency protects retries");
    }
    return NextResponse.json({ sent: true, alreadySent: result.alreadySent === true });
  } catch {
    return NextResponse.json({ sent: false, error: "Envoi impossible pour le moment. Google n’a pas confirmé l’envoi." }, { status: 500 });
  }
}
