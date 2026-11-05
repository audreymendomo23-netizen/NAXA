export type PasswordSecurityResult = {
  ok: boolean;
  compromised: boolean;
  message: string;
};

export async function verifierSecuriteMotDePasse(password: string): Promise<PasswordSecurityResult> {
  try {
    const response = await fetch("/api/auth/password-security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      return { ok: true, compromised: false, message: "" };
    }

    const result = await response.json().catch(() => null) as { error?: string; code?: string } | null;
    if (response.status === 409 || result?.code === "PASSWORD_COMPROMISED") {
      return {
        ok: false,
        compromised: true,
        message: result?.error || "Ce mot de passe apparaît dans des fuites connues. Choisissez-en un autre.",
      };
    }

    return {
      ok: false,
      compromised: false,
      message: result?.error || "La vérification de sécurité est indisponible. Réessayez avant d’enregistrer le mot de passe.",
    };
  } catch {
    return {
      ok: false,
      compromised: false,
      message: "La vérification de sécurité est indisponible. Vérifiez votre connexion puis réessayez.",
    };
  }
}
