import type { PaymentChannel, PaymentSmsCandidate } from "@/lib/promoteurPaymentSms";
import { normalizePaymentReference, normalizePaymentSms, parsePromoteurPaymentSms } from "@/lib/promoteurPaymentSms";

function redactForAi(raw: string): string {
  return raw
    .replace(/https?:\/\/\S+/gi, "[LIEN RETIRE]")
    .replace(/(?:solde|nouveau solde|votre nouveau solde|new balance|balance)\s*:\s*[^\n.]*/gi, "[SOLDE MASQUE]")
    .replace(/(?:frais|fees|commission|coupons?|reduction|discount)\s*:\s*[^\n.]*/gi, "[FRAIS MASQUES]")
    .replace(/(?:emprunte jusqu|borrow up to|telecharge la nouvelle|download the new).*/gi, "[PUBLICITE RETIREE]")
    .replace(/(reussi par\s+[0-9]{8,15})\s+[^.]+/gi, "$1 [NOM MASQUE]")
    .replace(/(par\s+[0-9]{8,15})\s+[^.]+/gi, "$1 [NOM MASQUE]")
    .slice(0, 4000);
}
function parseJson(raw: string): unknown {
  const clean = raw.replace(/^\x60{3}(?:json)?/i, "").replace(/\x60{3}$/i, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? clean.slice(start, end + 1) : clean);
}
function validateAiFields(value: unknown, raw: string, channel: PaymentChannel, senderId: string | null): PaymentSmsCandidate | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (item.direction !== "payer_debit" && item.direction !== "merchant_credit") return null;
  const amount = Number(item.amount);
  const reference = typeof item.reference === "string" ? item.reference.trim() : "";
  const occurred = typeof item.occurredAt === "string" ? item.occurredAt.trim() : "";
  const source = normalizePaymentSms(raw);
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  if (!reference || !normalizePaymentReference(raw).includes(normalizePaymentReference(reference))) return null;
  if (occurred) {
    const local = occurred.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\+01:00)?$/);
    if (!local) return null;
    const [, year, month, day, hour, minute, second = "00"] = local;
    const dateForms = [
      year + "-" + month + "-" + day,
      day + "/" + month + "/" + year,
      day + "-" + month + "-" + year,
      month + "/" + day + "/" + year,
    ];
    const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];
    const monthShort = monthNames.map(name => name.slice(0,3));
    const monthIndex = Number(month) - 1;
    const englishMonth = monthNames[monthIndex];
    const englishMonthShort = monthShort[monthIndex];
    const namedDate = monthIndex >= 0 && monthIndex < 12 && (
      new RegExp("\\b" + englishMonth + "\\s+" + Number(day) + "(?:st|nd|rd|th)?[,]?\\s+" + year + "\\b").test(source) ||
      new RegExp("\\b" + Number(day) + "\\s+" + englishMonth + "\\s+" + year + "\\b").test(source) ||
      new RegExp("\\b" + englishMonthShort + "\\s+" + Number(day) + "(?:st|nd|rd|th)?[,]?\\s+" + year + "\\b").test(source)
    );
    const hasDate = dateForms.some(form => source.includes(form)) || namedDate;
    const hasTime = source.includes(hour + ":" + minute + ":" + second) || source.includes(hour + ":" + minute);
    if (!hasDate || !hasTime) return null;
  }
  if (!occurred && channel === "mtn_momo") return null;
  if (!/(reussi|finalise|success|successful|completed|complete|received|credited)/i.test(source)) return null;
  const rawDigits = raw.replace(/\D/g, "");
  const payerNumber = typeof item.payerNumber === "string" ? item.payerNumber.replace(/\D/g, "") : "";
  const merchantNumber = typeof item.merchantNumber === "string" ? item.merchantNumber.replace(/\D/g, "") : "";
  if (payerNumber && !rawDigits.includes(payerNumber)) return null;
  if (merchantNumber && !rawDigits.includes(merchantNumber)) return null;
  const parsedDate = occurred ? new Date(occurred) : null;
  if (parsedDate && !Number.isFinite(parsedDate.getTime())) return null;
  return {
    channel,
    direction: item.direction,
    success: item.success === true,
    amount,
    reference,
    occurredAt: occurred ? parsedDate.toISOString() : null,
    payerNumber: payerNumber.length >= 8 ? payerNumber : null,
    merchantNumber: merchantNumber.length >= 8 ? merchantNumber : null,
    merchantLabel: typeof item.merchantLabel === "string" ? item.merchantLabel.trim().slice(0, 120) : null,
    senderId,
    senderTrusted: false,
    parser: "ai",
    quality: occurred || channel === "orange_money" ? "complete" : "incomplete",
  };
}

/** L'IA extrait les champs ; les contrôles déterministes restent obligatoires. */
export async function interpretPromoteurPaymentSms(
  rawText: string,
  channel: PaymentChannel,
  senderId?: string | null
): Promise<PaymentSmsCandidate | null> {
  if (typeof rawText !== "string" || rawText.length > 8000 || rawText.trim().length < 12) return null;
  const exact = parsePromoteurPaymentSms(rawText, channel, senderId);
  if (exact) return exact;
  const prompt = [
    "Extract only payment facts from this Cameroon mobile-money SMS.",
    "Language may be French or English. Never infer missing values. Return JSON only.",
    "Keys: direction, success, amount, reference, occurredAt, payerNumber, merchantNumber, merchantLabel.",
    "direction is payer_debit or merchant_credit. amount is an integer in XAF/FCFA. occurredAt is an ISO 8601 date with Cameroon +01:00 offset. Set missing values to null.",
    "Do not output names of people, balances, fees, commissions, coupons, OTPs, PINs, ads or URLs.",
    "SMS:",
    redactForAi(rawText),
  ].join("\n");
  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY ?? process.env.Gemini_API_Key;
  const groqKey = process.env.GROQ_API_KEY;
  if (geminiKey) {
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(geminiKey), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
        signal: AbortSignal.timeout(9000), cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const content = data.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("\n") ?? "";
        const candidate = validateAiFields(parseJson(content), rawText, channel, senderId ?? null);
        if (candidate) return candidate;
      }
    } catch {
      // Une indisponibilité IA n'élève jamais le niveau de confiance.
    }
  }
  if (groqKey) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + groqKey },
        body: JSON.stringify({ model: "llama-3.3-70b-versatile", temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(9000), cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content ?? "";
        return validateAiFields(parseJson(content), rawText, channel, senderId ?? null);
      }
    } catch {
      // Repli vers une vérification manuelle.
    }
  }
  return null;
}
