export type PaymentChannel = "orange_money" | "mtn_momo";
export type PaymentSmsDirection = "payer_debit" | "merchant_credit" | "informative_only";
export type PaymentSmsCandidate = {
  channel: PaymentChannel;
  direction: PaymentSmsDirection;
  success: boolean;
  amount: number | null;
  reference: string | null;
  occurredAt: string | null;
  payerNumber: string | null;
  merchantNumber: string | null;
  merchantLabel: string | null;
  senderId: string | null;
  senderTrusted: boolean;
  parser: "rules" | "ai";
  quality: "complete" | "incomplete" | "informative_only";
};
export type PaymentSmsValidation = {
  status: "coherent_needs_operator_confirmation" | "manual_review";
  eligibleForAutomaticConfirmation: false;
  reasons: string[];
};

export function normalizePaymentSms(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ").toLowerCase().replace(/\s+/g, " ").trim();
}
export function normalizePaymentReference(value: unknown): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}
function parseAmount(value: string | undefined): number | null {
  if (!value) return null;
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
function parseProviderDate(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const iso = match[1] + "-" + match[2] + "-" + match[3] + "T" + match[4] + ":" + match[5] + ":" + (match[6] ?? "00") + "+01:00";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}
function trustedSender(senderId: string | null, channel: PaymentChannel): boolean {
  const value = normalizePaymentSms(senderId).replace(/[^a-z0-9]/g, "").toUpperCase();
  const expected = channel === "orange_money" ? "ORANGEMONEY" : "MOBILEMONEY";
  return value === expected && !/^\d+$/.test(value);
}
function makeCandidate(
  channel: PaymentChannel,
  direction: PaymentSmsDirection,
  senderId: string | null,
  fields: Partial<PaymentSmsCandidate>
): PaymentSmsCandidate {
  return {
    channel, direction, senderId, senderTrusted: trustedSender(senderId, channel),
    success: fields.success === true, amount: fields.amount ?? null,
    reference: fields.reference ?? null, occurredAt: fields.occurredAt ?? null,
    payerNumber: fields.payerNumber ?? null, merchantNumber: fields.merchantNumber ?? null,
    merchantLabel: fields.merchantLabel ?? null, parser: fields.parser ?? "rules",
    quality: fields.quality ?? "incomplete",
  };
}

/** Formats OrangeMoney and MTN MoMo observed in Cameroon, French and English. */
export function parsePromoteurPaymentSms(
  rawText: string,
  channel: PaymentChannel,
  senderId?: string | null
): PaymentSmsCandidate | null {
  if (typeof rawText !== "string" || rawText.trim().length < 12 || rawText.length > 8000) return null;
  const text = normalizePaymentSms(rawText);
  const sender = String(senderId ?? "").trim() || null;

  if (channel === "orange_money") {
    const payer = text.match(/paiement de (.+?) reussi par ([0-9]{8,15})\s+[^.]*[.]?\s*id transaction:\s*([a-z0-9.]+),\s*montant:\s*([0-9][0-9 .,]*)\s*fcfa/);
    if (payer) {
      const amount = parseAmount(payer[4]);
      return makeCandidate(channel, "payer_debit", sender, {
        success: true, amount, reference: payer[3], payerNumber: normalizePhone(payer[2]),
        merchantLabel: payer[1].trim(), quality: amount && payer[3] ? "complete" : "incomplete",
      });
    }
    const merchant = text.match(/payment de ([0-9]{8,15})\s+.+?\s+par ([0-9]{8,15})\s+.+?\s+reussi[.]?\s+informations detaillees:\s*id transaction:\s*([a-z0-9.]+),\s*montant transaction:\s*([0-9][0-9 .,]*)\s*fcfa/);
    if (merchant) {
      const amount = parseAmount(merchant[4]);
      return makeCandidate(channel, "merchant_credit", sender, {
        success: true, amount, reference: merchant[3], merchantNumber: normalizePhone(merchant[1]),
        payerNumber: normalizePhone(merchant[2]), quality: amount && merchant[3] ? "complete" : "incomplete",
      });
    }
  }

  if (channel === "mtn_momo") {
    const payer = text.match(/(?:votre paiement|your payment) de? ?([0-9][0-9 .,]*)\s*(?:xaf|fcfa)\s+(?:a|to)\s+.+?\(([0-9]{8,15})\)\s+(?:a ete finalise a|was (?:successfully )?completed at|was successful at)\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
    if (payer) {
      const ref = text.match(/(?:identifiant de transaction financiere|financial transaction id)\s*:\s*([a-z0-9-]+)/);
      const amount = parseAmount(payer[1]);
      const occurredAt = parseProviderDate(payer[3]);
      return makeCandidate(channel, "payer_debit", sender, {
        success: true, amount, reference: ref?.[1] ?? null, merchantNumber: normalizePhone(payer[2]),
        occurredAt, quality: amount && ref?.[1] && occurredAt ? "complete" : "incomplete",
      });
    }
    const recipient = text.match(/(?:vous avez recu|you have received) ([0-9][0-9 .,]*)\s*(?:xaf|fcfa)\s+(?:de|from)\s+.+?\(([0-9]{8,15})\)\s+(?:sur votre compte mobile money|to your mobile money account)\s+(?:a|at)\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
    if (recipient) {
      const ref = text.match(/(?:financial transaction id|identifiant de transaction financiere)\s*:\s*([a-z0-9-]+)/);
      const amount = parseAmount(recipient[1]);
      const occurredAt = parseProviderDate(recipient[3]);
      return makeCandidate(channel, "merchant_credit", sender, {
        success: true, amount, reference: ref?.[1] ?? null, payerNumber: normalizePhone(recipient[2]),
        occurredAt, quality: amount && ref?.[1] && occurredAt ? "complete" : "incomplete",
      });
    }
    if (/paiement successintegral de |payment successintegral of /.test(text)) {
      const short = text.match(/(?:paiement successintegral de |payment successintegral of )([0-9][0-9 .,]*)/);
      return makeCandidate(channel, "informative_only", sender, {
        success: true, amount: parseAmount(short?.[1]), quality: "informative_only",
      });
    }
  }
  return null;
}

export function validatePromoteurPaymentSms(
  parsed: PaymentSmsCandidate | null,
  expected: {
    channel: PaymentChannel;
    amount: number;
    payerNumber?: string | null;
    reference?: string | null;
    paidAt?: string | null;
    merchantName?: string | null;
    merchantReference?: string | null;
  },
  options: { provenance: "manual_submission" | "authenticated_android"; now?: Date }
): PaymentSmsValidation {
  const reasons: string[] = [];
  const now = options.now ?? new Date();
  if (!parsed) {
    reasons.push("SMS non reconnu par les règles connues ni par l'analyse IA.");
  } else {
    if (parsed.channel !== expected.channel) reasons.push("Canal Mobile Money différent du canal déclaré.");
    if (parsed.direction === "informative_only") reasons.push("Le SMS court MTN ne contient ni référence ni horodatage et ne prouve pas le paiement.");
    if (!parsed.success) reasons.push("La réussite du paiement n'est pas explicite.");
    if (parsed.amount !== expected.amount) reasons.push("Montant différent du tarif de l'abonnement.");
    if (!parsed.reference || normalizePaymentReference(parsed.reference).length < 5) reasons.push("Référence financière absente ou inexploitable.");
    if (!parsed.occurredAt) reasons.push("Date et heure réelles de transaction absentes ou non interprétables.");
    if (!parsed.senderTrusted) reasons.push("Identifiant expéditeur brut différent de l'identifiant officiel attendu.");
    if (parsed.occurredAt) {
      const occurred = new Date(parsed.occurredAt).getTime();
      if (!Number.isFinite(occurred) || occurred > now.getTime() + 5 * 60_000) reasons.push("Date de transaction invalide ou future.");
      else if (now.getTime() - occurred > 24 * 60 * 60_000) reasons.push("Transaction antérieure à la fenêtre de vérification de 24 heures.");
      if (expected.paidAt) {
        const declared = new Date(expected.paidAt).getTime();
        if (!Number.isFinite(declared) || Math.abs(occurred - declared) > 5 * 60_000) reasons.push("Date/heure du SMS différente de la date déclarée de plus de cinq minutes.");
      }
    }
    if (expected.reference && parsed.reference && normalizePaymentReference(expected.reference) !== normalizePaymentReference(parsed.reference)) reasons.push("Référence du SMS différente de la référence déclarée.");
    if (expected.payerNumber && parsed.payerNumber && normalizePhone(expected.payerNumber) !== normalizePhone(parsed.payerNumber)) reasons.push("Numéro du payeur différent du numéro déclaré.");
    const merchantPhone = normalizePhone(expected.merchantReference);
    const merchantName = normalizePaymentSms(expected.merchantName).replace(/[^a-z0-9]/g, "");
    const parsedName = normalizePaymentSms(parsed.merchantLabel).replace(/[^a-z0-9]/g, "");
    if (parsed.merchantNumber && merchantPhone && normalizePhone(parsed.merchantNumber) !== merchantPhone) reasons.push("Numéro marchand différent de la destination NAXA.");
    else if (parsed.merchantLabel && merchantName && parsedName !== merchantName) reasons.push("Libellé marchand différent du bénéficiaire NAXA.");
    else if (!parsed.merchantNumber && !parsed.merchantLabel) reasons.push("Le SMS ne fournit pas de donnée suffisante pour rapprocher le bénéficiaire.");
  }
  if (options.provenance !== "authenticated_android") reasons.push("Les données ont été soumises manuellement et ne proviennent pas d'une capture Android authentifiée.");
  return {
    status: reasons.length ? "manual_review" : "coherent_needs_operator_confirmation",
    eligibleForAutomaticConfirmation: false,
    reasons,
  };
}
