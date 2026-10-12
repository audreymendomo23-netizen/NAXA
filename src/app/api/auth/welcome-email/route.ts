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
    if (current.user.user_metadata?.naxa_welcome_email_sent_at) {
      return NextResponse.json({ sent: true, alreadySent: true });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.NAXA_EMAIL_FROM;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    const termsVersion = process.env.NAXA_TERMS_VERSION;
    const privacyVersion = process.env.NAXA_PRIVACY_VERSION;
    const privacyContact = process.env.NAXA_PRIVACY_CONTACT_EMAIL;
    if (!apiKey || !from || !siteUrl || !termsVersion || !privacyVersion || !privacyContact) {
      return NextResponse.json({ sent: false, error: "Le service de bienvenue n’est pas encore configuré. L’envoi n’est pas confirmé." }, { status: 503 });
    }

    const email = user.email;
    const firstName = escapeHtml(String(user.user_metadata?.first_name ?? ""));
    const termsUrl = `${siteUrl}/conditions-utilisation`;
    const privacyUrl = `${siteUrl}/politique-confidentialite`;
    const html = `<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;color:#102a43;line-height:1.6"><h1 style="color:#047d78">Bienvenue sur NAXA${firstName ? `, ${firstName}` : ""} !</h1><p>Votre compte NAXA a été créé et votre adresse e-mail confirmée.</p><p>Pour consulter les documents applicables :</p><ul><li><a href="${termsUrl}">Conditions générales d’utilisation</a> — version ${escapeHtml(termsVersion)}</li><li><a href="${privacyUrl}">Politique de confidentialité</a> — version ${escapeHtml(privacyVersion)}</li></ul><p>Pour toute question relative à vos données personnelles, contactez <a href="mailto:${escapeHtml(privacyContact)}">${escapeHtml(privacyContact)}</a>.</p><p>À bientôt,<br><strong>L’équipe NAXA</strong></p></body></html>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `naxa-welcome-${user.id}`,
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Bienvenue sur NAXA — votre compte est créé",
        html,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("welcome email provider rejected request", response.status);
      return NextResponse.json({ sent: false, error: "Le service e-mail n’a pas confirmé l’envoi. Vous pourrez réessayer." }, { status: 502 });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...current.user.user_metadata,
        naxa_welcome_email_sent_at: new Date().toISOString(),
      },
    });
    if (updateError) {
      console.error("welcome email sent but status could not be saved");
      // Resend's idempotency key prevents a duplicate when this request is retried.
    }
    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ sent: false, error: "Envoi impossible pour le moment. L’envoi n’est pas confirmé." }, { status: 500 });
  }
}
