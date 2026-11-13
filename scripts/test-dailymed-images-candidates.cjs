const test = require("node:test");
const assert = require("node:assert/strict");

test("DailyMed v2 adapter validates SPL titles and media before review", async () => {
  const api = await import("./dailymed-images-candidates.mjs");
  assert.equal(api.titleMatches("acetaminophen", "ACETAMINOPHEN TABLET"), true);
  assert.equal(api.titleMatches("acetaminophen", "IBUPROFEN TABLET"), false);
  assert.deepEqual(api.extractSpls({ data: { spls: [{ setid: "x" }] } }), [{ setid: "x" }]);
  assert.deepEqual(api.extractMedia({ data: { media: [
    { name: "front.jpg", mime_type: "image/jpeg", url: "https://dailymed.nlm.nih.gov/dailymed/image.cfm?a=1" },
    { name: "remote.jpg", mime_type: "image/jpeg", url: "https://example.org/image.jpg" },
    { name: "label.pdf", mime_type: "application/pdf", url: "https://dailymed.nlm.nih.gov/file.pdf" }
  ] } }), [{ name: "front.jpg", mime_type: "image/jpeg", url: "https://dailymed.nlm.nih.gov/dailymed/image.cfm?a=1" }]);
  const update = api.buildCandidateUpdate({ cis: "CIS1", cip_code: "CIP1" }, { nom: "Acetaminophen" }, [{
    setid: "00000000-0000-0000-0000-000000000000",
    label_url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=x",
    media: [{ url: "https://dailymed.nlm.nih.gov/dailymed/image.cfm?a=1" }]
  }]);
  assert.equal(update.image_url, null);
  assert.equal(update.statut, "correspondance_a_verifier");
  assert.match(update.licence, /validation juridique obligatoire/);
  assert.match(update.methode_correspondance, /DailyMed v2/);
});

test("RxNorm extracts approximate candidates and preserves identifiers", async () => {
  const api = await import("./dailymed-images-candidates.mjs");
  assert.deepEqual(api.extractRxNormCandidates({ approximateGroup: { candidate: [
    { rxcui: "161", name: "acetaminophen 500 MG Oral Tablet", score: "12.5", rank: "1", source: "RXNORM" }
  ] } }), [{ rxcui: "161", name: "acetaminophen 500 MG Oral Tablet", score: 12.5, rank: 1, source: "RXNORM" }]);
  assert.deepEqual(api.extractRxNormCandidates({ approximateGroup: {} }), []);
});
