import { describe, expect, it } from "vitest";
import { computeDilution, computeDosing, computePreparation, computeStock, finalConcentration } from "./dosing";
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
