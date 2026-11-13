const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadTypeScript(relativePath) {
  const filename = path.join(__dirname, "..", relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", compiled)(require, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const calc = loadTypeScript("src/lib/compta/calculs.ts");
const moteur = loadTypeScript("src/lib/compta/moteur.ts");

assert.equal(calc.montantFcfa("9007199254740993"), 9007199254740993n);
assert.throws(() => calc.montantFcfa("12.50"), RangeError);
assert.throws(() => calc.montantFcfa(-1), RangeError);

const comptes = [
  { id: "a", code: "C-A", libelle: "Compte A", statut: "valide", sectionEtats: "section-actif" },
  { id: "b", code: "C-B", libelle: "Compte B", statut: "valide", sectionEtats: "section-passif" },
  { id: "c", code: "C-C", libelle: "Compte C", statut: "valide", sectionEtats: null },
];
const ecriture = {
  id: "e1", pharmacieId: "p1", dateEcriture: "2026-10-01", journalCode: "OD", libelle: "Écriture vérifiée",
  lignes: [
    { compteId: "a", libelle: "Débit", debitFcfa: "1250", creditFcfa: "0" },
    { compteId: "b", libelle: "Crédit", debitFcfa: "0", creditFcfa: "1250" },
  ],
};
assert.equal(calc.verifierEcritureEquilibree(ecriture).valide, true);
assert.equal(calc.verifierEcritureEquilibree(ecriture).debitFcfa, 1250n);
assert.equal(calc.verifierEcritureEquilibree({ ...ecriture, lignes: [{ compteId: "a", libelle: "D", debitFcfa: 20, creditFcfa: 0 }, { compteId: "b", libelle: "C", debitFcfa: 0, creditFcfa: 19 }] }).valide, false);
assert.throws(() => calc.calculerBalance([{ ...ecriture, lignes: [{ compteId: "missing", libelle: "D", debitFcfa: 10, creditFcfa: 0 }, { compteId: "b", libelle: "C", debitFcfa: 0, creditFcfa: 10 }] }], comptes), /Compte absent/);
const balance = calc.calculerBalance([ecriture], comptes);
assert.equal(balance.equilibree, true);
assert.equal(balance.totalDebitFcfa, 1250n);
assert.equal(balance.totalCreditFcfa, 1250n);
assert.equal(balance.lignes.length, 2);
const sections = calc.regrouperBalanceParSections(balance, comptes, new Set(["section-actif", "section-passif"]));
assert.deepEqual(sections.map(s => s.section).sort(), ["section-actif", "section-passif"]);

const aging = calc.calculerAncienneteCreances([
  { id: "r1", reference: "R1", debiteur: "Assureur A", dateEcheance: "2026-10-20", montantInitialFcfa: 1000, montantRegleFcfa: 200 },
  { id: "r2", reference: "R2", debiteur: "Assureur B", dateEcheance: "2026-09-01", montantInitialFcfa: "2500", montantRegleFcfa: "0" },
  { id: "r3", reference: "R3", debiteur: "Assureur C", dateEcheance: null, montantInitialFcfa: 100, montantRegleFcfa: 100 },
], "2026-10-21");
assert.equal(aging[1].montantFcfa, 800n);
assert.equal(aging[1].nombre, 1);
assert.equal(aging[2].montantFcfa, 2500n);
assert.throws(() => calc.calculerAncienneteCreances([{ id: "r4", reference: "R4", debiteur: "X", dateEcheance: null, montantInitialFcfa: 100, montantRegleFcfa: 0 }], "2026-10-21"), /Échéance manquante/);
assert.throws(() => calc.calculerAncienneteCreances([{ id: "r5", reference: "R5", debiteur: "X", dateEcheance: "2026-10-01", montantInitialFcfa: 100, montantRegleFcfa: 101 }], "2026-10-21"), /dépasse/);

const indicators = calc.calculerIndicateurs({ chiffreAffairesFcfa: 10000, coutDesVentesFcfa: 6500, stockMoyenFcfa: 1300, creancesClientsFcfa: 2000, ventesCreditFcfa: 10000, joursPeriode: 30 });
assert.equal(indicators.margeBruteFcfa, 3500n);
assert.equal(indicators.tauxMargeBrute, 35);
assert.equal(indicators.tauxRotationStock, 5);
assert.equal(indicators.delaiMoyenEncaissementJours, 6);
assert.equal(calc.calculerIndicateurs({ chiffreAffairesFcfa: 1000 }).margeBruteFcfa, null);
assert.equal(calc.calculerIndicateurs({ chiffreAffairesFcfa: 1000, coutDesVentesFcfa: 1000 }).tauxMargeBrute, 0);

const mappings = [
  { evenementType: "vente_payee", sens: "debit", compteId: "a", statut: "valide", valideDu: "2026-01-01" },
  { evenementType: "vente_payee", sens: "credit", compteId: "b", statut: "valide", valideDu: "2026-01-01" },
];
const ready = moteur.resoudreMappingEvenement({ evenementType: "vente_payee", dateEvenement: "2026-10-21", mappings, comptesValides: new Set(["a", "b"]), parametresRequisValides: true });
assert.equal(ready.statut, "pret");
assert.equal(ready.comptesResolus.debit, "a");
assert.equal(moteur.resoudreMappingEvenement({ evenementType: "vente_payee", dateEvenement: "2026-02-31", mappings, comptesValides: new Set(["a", "b"]) }).statut, "a_traiter");
assert.equal(moteur.resoudreMappingEvenement({ evenementType: "vente_payee", dateEvenement: "2026-10-21", mappings: mappings.map(m => ({ ...m, valideDu: "2026-02-31" })), comptesValides: new Set(["a", "b"]) }).statut, "a_traiter");
assert.equal(moteur.resoudreMappingEvenement({ evenementType: "vente_payee", dateEvenement: "2026-10-21", mappings: mappings.map(m => ({ ...m, valideDu: "2026-11-01", valideJusquau: "2026-01-01" })), comptesValides: new Set(["a", "b"]) }).statut, "a_traiter");
assert.equal(moteur.resoudreMappingEvenement({ evenementType: "achat", dateEvenement: "2026-10-21", mappings, comptesValides: new Set(["a", "b"]) }).statut, "a_traiter");
assert.equal(moteur.resoudreMappingEvenement({ evenementType: "vente_payee", dateEvenement: "2026-10-21", mappings, comptesValides: new Set(["a", "b"]), parametresRequisValides: false }).statut, "a_traiter");
assert.equal(moteur.statutParametreApresLecture("a_valider"), "a_traiter");
assert.equal(moteur.statutParametreApresLecture("valide"), "valide");

console.log("PASS — moteur Comptable : montants exacts, partie double, balance, sections validées, ancienneté, indicateurs conditionnels et mapping sans défaut.");
