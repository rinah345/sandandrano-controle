import { describe, expect, it } from "vitest";
import { computeDilution, computeDosing, computePreparation, computeStock, finalConcentration, EQUATIONS, computeReversible, computeTrials, type TrialInput } from "./dosing";
import { CONC, FLOW, INJ, VOL, MASS, toBase, fromBase } from "./units";

const q = (v: number, u: string) => ({ v, u });
const find = (rows: { label: string; value: string }[], l: string) => rows.find((r) => r.label.includes(l))?.value;

describe("conversions", () => {
  it("concentrations", () => {
    expect(toBase(4, CONC, "% (m/v)")).toBe(40000);
    expect(toBase(40, CONC, "g/L")).toBe(40000);
    expect(toBase(1, CONC, "g/m³")).toBe(1);
    expect(toBase(1000, CONC, "mg/m³")).toBe(1);
  });
  it("débits", () => {
    expect(toBase(3.6, FLOW, "m³/h")).toBeCloseTo(1, 12);
    expect(toBase(86.4, FLOW, "m³/jour")).toBeCloseTo(1, 12);
    expect(fromBase(0.002625, INJ, "mL/s")).toBeCloseTo(2.625, 12);
    expect(fromBase(0.002625, INJ, "L/h")).toBeCloseTo(9.45, 12);
  });
  it("volumes et masses", () => {
    expect(toBase(2, VOL, "m³")).toBe(2000);
    expect(toBase(1, MASS, "kg")).toBe(1e6);
  });
});

describe("chaque paramètre est réversible", () => {
  for (const equation of EQUATIONS) {
    for (const target of equation.variables) {
      it(`${equation.id} : retrouver ${target.key}`, () => {
        const inputs = Object.fromEntries(equation.variables.map((variable) => {
          const unit = Object.keys(variable.units)[0] ?? "—";
          return [variable.key, q(fromBase(equation.example[variable.key] ?? 0, variable.units, unit), unit)];
        }));
        // The target must be calculated, never copied from its input.
        inputs[target.key] = { v: NaN, u: inputs[target.key]?.u ?? "—" };
        const unit = Object.keys(target.units)[0] ?? "—";
        const result = computeReversible(equation.id, target.key, inputs, unit);
        expect(result.checks.filter((c) => c.level === "error")).toEqual([]);
        expect(result.solved?.value).toBeCloseTo(fromBase(equation.example[target.key] ?? 0, target.units, unit), 7);
      });
    }
  }
  it("refuse l'inverse d'une commande nulle non unique", () => {
    const s = computeReversible("commande", "P", { O: q(0, "—"), r: q(25, "/jour"), securite: q(0, "—"), R: q(400, "—") }, "jours");
    expect(s.solved).toBeUndefined();
    expect(s.checks.some((c) => c.level === "error")).toBe(true);
  });
  it("commande directe plafonnée à zéro", () => {
    const s = computeReversible("commande", "O", { r: q(1, "/jour"), P: q(10, "jours"), securite: q(0, "—"), R: q(400, "—") }, "—");
    expect(s.solved?.value).toBe(0);
  });
  it("refuse une teneur calculée supérieure à 100 %", () => {
    const s = computeReversible("preparation", "p", { m: q(1, "kg"), C: q(100, "g/L"), V: q(100, "L") }, "%");
    expect(s.solved).toBeUndefined();
  });
  it("refuse les unités inconnues et valeurs infinies", () => {
    expect(computeReversible("sejour", "V", { Q: q(10, "inconnue"), t: q(2, "h") }, "m³").solved).toBeUndefined();
    expect(computeReversible("sejour", "V", { Q: q(Infinity, "m³/h"), t: q(2, "h") }, "m³").solved).toBeUndefined();
  });
  it("refuse une dilution qui concentre", () => {
    expect(computeReversible("dilution", "C2", { C1: q(1, "g/L"), V1: q(20, "L"), V2: q(10, "L") }, "g/L").solved).toBeUndefined();
  });
  it("refuse un nombre fractionnaire d'ouvrages", () => {
    expect(computeReversible("unites", "n", { S: q(100, "m²"), Su: q(30, "m²") }, "unités").solved).toBeUndefined();
  });
  it("refuse la division par zéro", () => {
    expect(computeReversible("cout", "prix", { coût: q(10, "unité monétaire"), quantite: q(0, "—") }, "monnaie / quantité").solved).toBeUndefined();
  });
  it("refuse une demande négative et accepte un résiduel théorique nul", () => {
    expect(computeReversible("residuel", "dem", { D: q(1, "mg/L"), res: q(2, "mg/L") }, "mg/L").solved).toBeUndefined();
    expect(computeReversible("residuel", "res", { D: q(2, "mg/L"), dem: q(2, "mg/L") }, "mg/L").solved?.value).toBe(0);
  });
});

describe("chlore — exemple de référence", () => {
  it("3,5 L/s, 40 000 mg/L, 30 mg/L → 2,625 mL/s ; 9,45 L/h ; 226,8 L/24 h", () => {
    const s = computeDosing("chlore", { mode: "continu", Cm: q(40000, "mg/L"), D: q(30, "mg/L"), Qe: q(3.5, "L/s"), t: q(24, "h") });
    expect(s.checks.some((c) => c.level === "error")).toBe(false);
    expect(s.steps[0]!.result).toBe("0,002625 L/s");
    expect(s.steps[1]!.result).toBe("2,625 mL/s");
    expect(s.steps[2]!.result).toBe("9,45 L/h");
    expect(find(s.results, "Volume consommé")).toBe("226,8 L");
  });
  it("même résultat avec unités différentes (4 %, 12,6 m³/h)", () => {
    const s = computeDosing("chlore", { mode: "continu", Cm: q(4, "% (m/v)"), D: q(30, "g/m³"), Qe: q(12.6, "m³/h") });
    expect(s.steps[1]!.result).toBe("2,625 mL/s");
  });
  it("lot : 10 m³ à 2 mg/L avec 40 g/L → 0,5 L", () => {
    const s = computeDosing("chlore", { mode: "lot", Cm: q(40, "g/L"), D: q(2, "mg/L"), Ve: q(10, "m³") });
    expect(s.steps[0]!.result).toBe("0,5 L");
  });
  it("refuse une concentration nulle et un débit négatif", () => {
    const s = computeDosing("chlore", { mode: "continu", Cm: q(0, "mg/L"), D: q(2, "mg/L"), Qe: q(-1, "L/s") });
    expect(s.checks.filter((c) => c.level === "error").length).toBe(2);
    expect(s.main).toBeUndefined();
  });
  it("autonomie : 100 L de stock à 9,45 L/h", () => {
    const s = computeDosing("chlore", { mode: "continu", Cm: q(40000, "mg/L"), D: q(30, "mg/L"), Qe: q(3.5, "L/s"), stock: q(100, "L") });
    expect(s.steps.at(-1)!.result).toBe("10,582 h");
  });
});

describe("sulfate d'aluminium", () => {
  it("continu : 100 m³/h, 30 mg/L, solution 100 g/L → 30 L/h", () => {
    const s = computeDosing("sulfate", { mode: "continu", Cm: q(100, "g/L"), D: q(30, "mg/L"), Qe: q(100, "m³/h") });
    expect(s.steps[2]!.result).toBe("30 L/h");
  });
  it("masse : 1000 m³ à 40 mg/L → 40 kg actif", () => {
    const s = computeDosing("sulfate", { mode: "lot", Cm: q(100, "g/L"), D: q(40, "mg/L"), Ve: q(1000, "m³") });
    expect(s.steps[1]!.result).toContain("= 40 kg");
  });
  it("cuve 1 m³ à 10 % avec produit à 80 % → 125 kg", () => {
    const s = computeDosing("sulfate", { mode: "lot", Cm: q(100, "g/L"), D: q(40, "mg/L"), Ve: q(1000, "m³"), tankV: q(1, "m³"), tankC: q(10, "% (m/v)"), purity: 80 });
    expect(s.steps.at(-1)!.result).toBe("125 kg");
  });
});

describe("préparation, dilution, stock", () => {
  it("préparation 500 L à 50 g/L, produit à 70 % → 35,7143 kg", () => {
    const s = computePreparation({ C: q(50, "g/L"), V: q(500, "L"), purity: 70 });
    expect(s.steps[1]!.result).toBe("35,7143 kg");
  });
  it("dilution 12 % → 1 % pour 120 L : V1 = 10 L", () => {
    const s = computeDilution({ C1: q(12, "% (m/v)"), C2: q(1, "% (m/v)"), V2: q(120, "L") });
    expect(s.steps[0]!.result).toBe("10 L");
    expect(finalConcentration(120000, 10, 120)).toBe(10000);
  });
  it("stock : 500 kg, 25 kg/jour, 100 consommés → 16 jours ; commande 30 j + 50 = 400 kg", () => {
    const s = computeStock({ product: "Sulfate", unit: "kg", rate: q(25, "/jour"), initial: 500, consumed: 100, price: null, period: 30, safety: 50 });
    expect(s.main!.value).toBe("16 jours");
    expect(find(s.results, "Quantité à commander")).toBe("400 kg");
  });
});

import { computeSizing } from "./dosing";
const trials = (changes: Partial<TrialInput> = {}): TrialInput => ({
  kind: "sulfate", points: [{ dose: 10, response: 18, ph: 7.1 }, { dose: 20, response: 4, ph: 6.9 }, { dose: 30, response: 1.2, ph: 6.7 }, { dose: 40, response: 0.8, ph: 6.4 }],
  rawTurbidity: 50, contactMinutes: 30, temperature: 22, target: 2, maxResidual: 1, phMin: 6, phMax: 8,
  stockConcentration: q(10, "g/L"), beakerVolume: q(1, "L"), breakpoint: null, metadata: [], demonstration: false, ...changes,
});
const chlorination = (changes: Partial<TrialInput> = {}) => trials({ kind: "chlore", rawTurbidity: 0.6, target: 0.5,
  points: [{ dose: 2, response: 0.2, total: 0.25, ph: 7.2 }, { dose: 2.5, response: 0.6, total: 0.65, ph: 7.2 }, { dose: 3, response: 1.1, total: 1.15, ph: 7.2 }], ...changes });
describe("essais mesurés et sélection conservatrice", () => {
  it("retient la plus petite dose de sulfate satisfaisant 2 NTU et pH 6–8, pas la turbidité minimale", () => {
    const s = computeTrials(trials());
    expect(s.selectedDose).toBe(30);
    expect(s.series.find((p) => p.dose === 30)?.removal).toBeCloseTo(97.6);
  });
  it("convertit la dose bécher : 30 mg/L, 1 L, 10 g/L donnent 3 mL", () => {
    expect(computeTrials(trials()).series.find((p) => p.dose === 30)?.injectionMl).toBe(3);
    expect(computeTrials(trials({ stockConcentration: q(1, "% (m/v)"), beakerVolume: q(1000, "mL") })).series.find((p) => p.dose === 30)?.injectionMl).toBe(3);
  });
  it("exclut une dose de sulfate hors plage de pH", () => {
    expect(computeTrials(trials({ phMin: 6.8 })).selectedDose).toBeUndefined();
  });
  it("chlore : dose 2,5, libre 0,6, total 0,65 → combiné 0,05 et consommé 1,85", () => {
    const s = computeTrials(chlorination());
    expect(s.selectedDose).toBe(2.5);
    expect(s.series[1]?.combined).toBeCloseTo(0.05);
    expect(s.series[1]?.demand).toBeCloseTo(1.85);
    expect(s.steps.find((step) => step.formula.startsWith("CT ="))?.result).toBe("18 mg·min/L");
  });
  it("respecte contact ≥30 min", () => {
    expect(computeTrials(chlorination({ contactMinutes: 29 })).selectedDose).toBeUndefined();
    expect(computeTrials(chlorination({ contactMinutes: 30 })).selectedDose).toBe(2.5);
  });
  it("respecte pH strictement inférieur à 8 pour le repère chlore", () => {
    const points = chlorination().points.map((p) => ({ ...p, ph: 8 }));
    expect(computeTrials(chlorination({ points })).selectedDose).toBeUndefined();
  });
  it("n'extrapole pas de dose et respecte la limite haute saisie", () => {
    expect(computeTrials(chlorination({ maxResidual: 0.55 })).selectedDose).toBeUndefined();
    expect(computeTrials(trials({ target: 0.5 })).selectedDose).toBeUndefined();
  });
  it("respecte le breakpoint repéré manuellement sans en inventer un", () => {
    expect(computeTrials(chlorination({ breakpoint: 2.6, maxResidual: 2 })).selectedDose).toBe(3);
    expect(computeTrials(chlorination()).selectedDose).toBe(2.5);
  });
  it("refuse un chlore total inférieur au libre", () => {
    const points = chlorination().points.map((p) => ({ ...p, total: 0.1 }));
    expect(computeTrials(chlorination({ points })).checks.some((c) => c.level === "error")).toBe(true);
  });
  it("refuse total supérieur à la dose sur eau sans chlore initial", () => {
    const points = chlorination().points.map((p) => ({ ...p, total: p.dose + 1 }));
    expect(computeTrials(chlorination({ points })).series).toEqual([]);
  });
  it("refuse doses répétées et données non finies", () => {
    expect(computeTrials(trials({ points: [trials().points[0] ?? { dose: 10, response: 18, ph: 7 }, ...trials().points] })).series).toEqual([]);
    expect(computeTrials(trials({ temperature: Infinity })).series).toEqual([]);
    expect(computeTrials(trials({ beakerVolume: q(NaN, "L") })).series).toEqual([]);
  });
  it("garde l'abattement négatif au lieu de le masquer", () => {
    const s = computeTrials(trials({ points: [{ dose: 0, response: 60, ph: 7 }, ...trials().points] }));
    expect(s.series[0]?.removal).toBe(-20);
    expect(s.checks.some((c) => c.level === "warn")).toBe(true);
  });
  it("CT inverse non déterminable quand le chlore est nul", () => {
    expect(computeReversible("ctEssai", "te", { CT: q(0, "mg·min/L"), Cl: q(0, "mg/L") }, "min").solved).toBeUndefined();
  });
});
describe("dimensionnement", () => {
  it("décanteur 100 m³/h, 2 h, Vh 1 m/h → 200 m³, 100 m², 2 m", () => {
    const s = computeSizing({ type: "decanteur", Q: q(100, "m³/h"), t: q(2, "h"), vh: 1 });
    expect(s.steps.map((x) => x.result)).toEqual(["200 m³", "100 m²", "2 m"]);
  });
  it("contact : volume 50 m³ à 25 m³/h → 120 min", () => {
    const s = computeSizing({ type: "contact", Q: q(25, "m³/h"), V: q(50, "m³") });
    expect(s.main!.value).toBe("120 min");
  });
  it("filtre sans vitesse refusé", () => {
    const s = computeSizing({ type: "filtre", Q: q(10, "L/s"), t: q(10, "min"), vh: null });
    expect(s.main).toBeUndefined();
  });
});
