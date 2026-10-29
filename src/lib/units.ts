// Facteurs de conversion vers l'unité interne de référence.
// Concentration -> mg/L ; débit -> L/s ; volume -> L ; masse -> mg ; durée -> h.
export type UnitTable = Record<string, number>;

// % (m/v) : 1 % = 1 g / 100 mL = 10 g/L = 10 000 mg/L
export const CONC: UnitTable = { "mg/L": 1, "g/L": 1000, "mg/m³": 0.001, "g/m³": 1, "% (m/v)": 10000 };
export const FLOW: UnitTable = { "L/s": 1, "L/min": 1 / 60, "L/h": 1 / 3600, "m³/h": 1000 / 3600, "m³/jour": 1000 / 86400 };
export const INJ: UnitTable = { "mL/s": 0.001, "mL/min": 0.001 / 60, "mL/h": 0.001 / 3600, "L/s": 1, "L/min": 1 / 60, "L/h": 1 / 3600 };
export const VOL: UnitTable = { mL: 0.001, L: 1, "m³": 1000 };
export const MASS: UnitTable = { mg: 1, g: 1000, kg: 1e6, t: 1e9 };
export const TIME: UnitTable = { min: 1 / 60, h: 1, jour: 24 };

export const toBase = (v: number, t: UnitTable, u: string) => {
  const f = t[u];
  if (f === undefined) throw new Error(`Unité inconnue : ${u}`);
  return v * f;
};
export const fromBase = (v: number, t: UnitTable, u: string) => {
  const f = t[u];
  if (f === undefined) throw new Error(`Unité inconnue : ${u}`);
  return v / f;
};

export function parseNum(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export function fmt(n: number, digits = 6): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const a = Math.abs(n);
  if (a >= 1e9 || a < 1e-6) return n.toExponential(3).replace(".", ",");
  const r = Number(n.toPrecision(digits));
  return r.toLocaleString("fr-FR", { maximumFractionDigits: 10 });
}
