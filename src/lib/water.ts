export type Param = {
  key: string;
  name: string;
  unit: string;
  min?: number;
  max?: number;
  defaultValue: number;
  advice: string;
};

// Valeurs guides inspirées des recommandations OMS pour l'eau potable
export const PARAMS: Param[] = [
  { key: "ph", name: "pH", unit: "", min: 6.5, max: 8.5, defaultValue: 7.2, advice: "Ajuster avec chaux (pH bas) ou CO₂/acide (pH élevé)." },
  { key: "turb", name: "Turbidité", unit: "NTU", max: 5, defaultValue: 1, advice: "Renforcer coagulation-floculation (sulfate d'alumine) et filtration sur sable." },
  { key: "chlore", name: "Chlore résiduel", unit: "mg/L", min: 0.2, max: 0.5, defaultValue: 0.3, advice: "Ajuster la dose d'hypochlorite de calcium / sodium." },
  { key: "cond", name: "Conductivité", unit: "µS/cm", max: 2500, defaultValue: 400, advice: "Eau trop minéralisée : envisager osmose inverse ou mélange." },
  { key: "tds", name: "TDS", unit: "mg/L", max: 1000, defaultValue: 250, advice: "Réduire les solides dissous (osmose inverse, déminéralisation)." },
  { key: "durete", name: "Dureté totale", unit: "mg/L CaCO₃", max: 500, defaultValue: 150, advice: "Adoucissement par résine échangeuse d'ions." },
  { key: "nitrates", name: "Nitrates", unit: "mg/L", max: 50, defaultValue: 10, advice: "Dénitrification biologique ou résine anionique ; vérifier pollution agricole." },
  { key: "nitrites", name: "Nitrites", unit: "mg/L", max: 3, defaultValue: 0.1, advice: "Renforcer l'oxydation (chloration)." },
  { key: "fer", name: "Fer", unit: "mg/L", max: 0.3, defaultValue: 0.1, advice: "Aération / oxydation puis filtration." },
  { key: "mn", name: "Manganèse", unit: "mg/L", max: 0.4, defaultValue: 0.05, advice: "Oxydation au permanganate puis filtration." },
  { key: "fluor", name: "Fluorures", unit: "mg/L", max: 1.5, defaultValue: 0.5, advice: "Défluoration sur alumine activée." },
  { key: "arsenic", name: "Arsenic", unit: "mg/L", max: 0.01, defaultValue: 0, advice: "Coagulation au fer ou adsorption spécifique. Danger sanitaire." },
  { key: "coli", name: "E. coli", unit: "UFC/100mL", max: 0, defaultValue: 0, advice: "Contamination fécale : désinfection immédiate, eau non potable." },
  { key: "temp", name: "Température", unit: "°C", max: 25, defaultValue: 20, advice: "Température élevée favorise les bactéries ; protéger le stockage." },
];

export type Status = "ok" | "warn" | "bad";

export function evaluate(p: Param, v: number): Status {
  const over = p.max !== undefined && v > p.max;
  const under = p.min !== undefined && v < p.min;
  if (!over && !under) return "ok";
  const ref = over ? p.max! : p.min!;
  const gap = ref === 0 ? Infinity : Math.abs(v - ref) / ref;
  return gap > 0.2 ? "bad" : "warn";
}

export function score(values: Record<string, number>) {
  let pts = 0;
  for (const p of PARAMS) {
    const s = evaluate(p, values[p.key] ?? 0);
    pts += s === "ok" ? 1 : s === "warn" ? 0.5 : 0;
  }
  const pct = Math.round((pts / PARAMS.length) * 100);
  const critical = ["coli", "arsenic", "nitrates"].some(
    (k) => evaluate(PARAMS.find((p) => p.key === k)!, values[k] ?? 0) === "bad",
  );
  let quality: string;
  if (critical) quality = "Non potable";
  else if (pct >= 90) quality = "Excellente";
  else if (pct >= 75) quality = "Bonne";
  else if (pct >= 50) quality = "Moyenne";
  else quality = "Mauvaise";
  return { pct, quality, critical };
}
