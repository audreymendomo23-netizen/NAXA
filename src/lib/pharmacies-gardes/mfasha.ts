import { cache } from "react";

export const MFASHA_SOURCE_URL = "https://mfasha.com/";

export type GardeExterne = {
  id: string;
  nom: string;
  quartier: string | null;
  telephone: string | null;
  autresTelephones: string[];
  imageUrl: string | null;
  periode: string | null;
  source: typeof MFASHA_SOURCE_URL;
};

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function plainText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
}

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function phoneNumbers(value: string): string[] {
  const matches = value.match(/(?:\+?237\s*)?(?:2\d{2}|6\d{2})[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}/g) ?? [];
  return [...new Set(matches.map(normalizePhone))];
}

function extractPeriod(text: string): string | null {
  const match = text.match(/Garde\s+du\s+(.{3,80}?)\s+au\s+(.{3,80}?)(?=\s+Filtrer\s+par|\s+Mfasha\s*[·|]|$)/i);
  if (!match) return null;
  return `${match[1].trim()} au ${match[2].trim()}`;
}

/**
 * Fetches the currently published public duty list from Mfasha.
 * This is a public web page, not a documented API. If its HTML structure
 * changes, parsing fails closed and callers should use their trusted fallback.
 */
export const chargerGardesMfasha = cache(async (): Promise<{
  pharmacies: GardeExterne[];
  periode: string | null;
  fetchedAt: string;
} | null> => {
  try {
    const response = await fetch(MFASHA_SOURCE_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "NAXA-PharmacyDuty-Reader/1.0 (public source attribution)",
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const text = plainText(html);
    const periode = extractPeriod(text);
    if (!periode) return null;

    const headings = [...html.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)];
    const pharmacies: GardeExterne[] = [];

    for (let index = 0; index < headings.length; index += 1) {
      const heading = headings[index];
      const nom = plainText(heading[1]);
      if (!nom || /pharmacies de garde|mfasha|garde à venir/i.test(nom)) continue;
      const start = (heading.index ?? 0) + heading[0].length;
      const end = headings[index + 1]?.index ?? html.length;
      const section = plainText(html.slice(start, end));
      const phones = phoneNumbers(section);
      const sectionHtml = html.slice(start, end);
      const imageMatch = sectionHtml.match(/<img\\b[^>]*?src=["']([^"']+)["'][^>]*>/i);
      let imageUrl: string | null = null;
      if (imageMatch?.[1]) {
        try {
          const candidate = new URL(decodeHtml(imageMatch[1]), MFASHA_SOURCE_URL);
          if (candidate.protocol === "https:" && /mfasha\\.com$/i.test(candidate.hostname)) imageUrl = candidate.toString();
        } catch {
          imageUrl = null;
        }
      }
      const quartier = section
        .replace(/Zone\s*\d+/gi, " ")
        .replace(/Autres numéros?/gi, " ")
        .replace(/(?:\+?237\s*)?(?:2\d{2}|6\d{2})[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!phones.length || !/Zone\s*\d+/i.test(section)) continue;
      pharmacies.push({
        id: `mfasha-${index}-${nom.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        nom,
        quartier: quartier || null,
        telephone: phones[0] ?? null,
        autresTelephones: phones.slice(1),
        imageUrl,
        periode,
        source: MFASHA_SOURCE_URL,
      });
    }

    if (pharmacies.length < 5) return null;
    return { pharmacies, periode, fetchedAt: new Date().toISOString() };
  } catch {
    return null;
  }
});
