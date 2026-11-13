export type MerchantPaymentChannel = "mtn_momo" | "orange_money";

export function buildMerchantPaymentUssd(
  channel: MerchantPaymentChannel,
  merchantCode: string,
  amount: number,
): string {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Montant de paiement invalide.");
  }
  if (!/^\d{6}$/.test(merchantCode)) {
    throw new Error("Le code marchand doit comporter exactement 6 chiffres.");
  }
  if (channel === "mtn_momo") {
    return `*126*4*${merchantCode}*${amount}#`;
  }
  if (channel === "orange_money") {
    return "#150*47#";
  }
  throw new Error("Opérateur de paiement non pris en charge.");
}

export function buildTelephoneUri(ussd: string): string {
  if (!ussd || !/^[*#0-9]+$/.test(ussd)) {
    throw new Error("Commande USSD invalide.");
  }
  return `tel:${encodeURIComponent(ussd)}`;
}
