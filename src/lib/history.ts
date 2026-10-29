import type { Sheet } from "./dosing";

export type Entry = { id: string; date: string; sheet: Sheet };
const KEY = "aqua-dosage-history";

export function loadHistory(): Entry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function saveHistory(list: Entry[]) { localStorage.setItem(KEY, JSON.stringify(list)); }
export function addEntry(sheet: Sheet) {
  const list = loadHistory();
  list.unshift({ id: crypto.randomUUID(), date: new Date().toISOString(), sheet });
  saveHistory(list);
}

export function sheetToRows(s: Sheet): string[][] {
  const rows: string[][] = [[s.title], []];
  const sec = (t: string, r: { label: string; value: string }[]) => { if (r.length) { rows.push([t]); r.forEach((x) => rows.push([x.label, x.value])); rows.push([]); } };
  sec("Données saisies", s.inputs);
  sec("Conversions", s.conversions);
  if (s.steps.length) { rows.push(["Calculs", "Formule", "Substitution", "Résultat"]); s.steps.forEach((x) => rows.push([x.label, x.formula, x.substitution, x.result])); rows.push([]); }
  if (s.main) sec("Résultat principal", [s.main]);
  sec("Résultats", s.results);
  sec("Prévisions", s.forecast);
  if (s.checks.length) { rows.push(["Contrôles"]); s.checks.forEach((c) => rows.push([c.level, c.msg])); }
  return rows;
}

export function downloadCSV(name: string, rows: string[][]) {
  const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  download(name, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}
export function download(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
