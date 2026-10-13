export const NAXA_EMAIL = "naxa.home@gmail.com";
export const NAXA_WHATSAPP = "237681972237";

export function lienGmail(nom: string) {
  const sujet = "Demande d'aide NAXA";
  const corps = `Bonjour NAXA,\nJe suis ${nom.trim() || "client"} et j'ai besoin d'aide avec l'application.\nMerci.`;
  return `mailto:${NAXA_EMAIL}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
}

export function lienWhatsApp(nom: string) {
  const message = `Bonjour NAXA, je suis ${nom.trim() || "client"} et j'ai besoin d'aide avec l'application.`;
  return `https://wa.me/${NAXA_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
