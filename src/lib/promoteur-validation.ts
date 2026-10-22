export const PROMOTEUR_VALIDATION = {
  username: /^[a-z0-9][a-z0-9._-]{2,29}$/,
  personName: /^.{2,80}$/u,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  passwordMinLength: 6,
  phone: {
    CM: { dial: "+237", flag: "🇨🇲", digits: 9 },
    CF: { dial: "+236", flag: "🇨🇫", digits: 8 },
    TD: { dial: "+235", flag: "🇹🇩", digits: 8 },
    CG: { dial: "+242", flag: "🇨🇬", digits: 9 },
    CD: { dial: "+243", flag: "🇨🇩", digits: 9 },
    GQ: { dial: "+240", flag: "🇬🇶", digits: 9 },
    GA: { dial: "+241", flag: "🇬🇦", digits: 8 },
    ST: { dial: "+239", flag: "🇸🇹", digits: 7 },
    AO: { dial: "+244", flag: "🇦🇴", digits: 9 },
    BI: { dial: "+257", flag: "🇧🇮", digits: 8 },
    RW: { dial: "+250", flag: "🇷🇼", digits: 9 },
  },
} as const;

export type PromoteurPhoneCountry = keyof typeof PROMOTEUR_VALIDATION.phone;
export function normalizePromoteurPhone(raw: string, country: PromoteurPhoneCountry): string {
  const config = PROMOTEUR_VALIDATION.phone[country];
  if (!config) return "";
  let digits = raw.replace(/\D/g, "");
  const dialDigits = config.dial.replace(/\D/g, "");
  if (digits.startsWith(dialDigits) && digits.length > config.digits) digits = digits.slice(dialDigits.length);
  digits = digits.replace(/^0+/, "");
  return config.dial + digits;
}
export function validatePromoteurPhone(raw: string, country: PromoteurPhoneCountry): string | undefined {
  const config = PROMOTEUR_VALIDATION.phone[country];
  if (!config) return "Choisissez un indicatif téléphonique valide.";
  let digits = raw.replace(/\D/g, "");
  const dialDigits = config.dial.replace(/\D/g, "");
  if (digits.startsWith(dialDigits) && digits.length > config.digits) digits = digits.slice(dialDigits.length);
  digits = digits.replace(/^0+/, "");
  return digits.length === config.digits ? undefined : `${config.digits} chiffres attendus`;
}
