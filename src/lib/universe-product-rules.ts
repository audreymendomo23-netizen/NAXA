type ProductRuleInput = {
  name: string;
  category?: string | null;
  description?: string | null;
  brand?: string | null;
};

function normalizedProductText(product: ProductRuleInput) {
  return [product.name, product.category ?? "", product.description ?? "", product.brand ?? ""]
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Terms excluded from the Baby & Mom universe by the database guard. */
export function excludedFromBabyUniverse(product: ProductRuleInput) {
  const text = normalizedProductText(product);
  return /\b(?:laits?\s+(?:infantiles?|de croissance|pour nourrissons?|maternel|(?:1er|premier|2e|deuxieme|second)\s+age)|preparations?\s+infantiles?|substituts?\s+(?:du\s+)?lait\s+maternel|cereales?\s+infantiles?|farines?\s+infantiles?|biberons?|tetines?|sucettes?|infant\s+formula|baby\s+formula|baby\s+milks?|follow[- ]on\s+(?:milk|formulas?)|growing[- ]up\s+milks?|baby\s+bottles?|feeding\s+bottles?|bottles?|teats?|pacifiers?|dummies?|baby\s+cereals?|infant\s+(?:cereals?|flours?))\b/.test(text);
}

/** Best-effort lexical guard; the database migration is the authoritative write boundary. */
export function isMedicationProduct(product: ProductRuleInput) {
  const text = normalizedProductText(product);
  return /\b(?:medicaments?|medicinal products?|pharmaceuticals?|drugs?|antibiotiques?|antipaludiques?|antitussifs?|antalgiques?|anti[- ]inflammatoires?|antihistaminiques?|antipyretiques?|antidiarrheiques?|paracetamol|acetaminophen|ibuprofen|aspirine|amoxicilline|artemether|lumefantrine|quinine|metronidazole|diclofenac|omeprazole|cetirizine|loratadine|prednisolone|dexamethasone|tramadol|suppositoires?|sirop medicamenteux|medicinal syrup)\b/.test(text);
}
