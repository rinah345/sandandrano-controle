import { useState, type ReactNode } from "react";
import { ArrowLeftRight, Calculator, RotateCcw } from "lucide-react";
import { EQUATIONS, computeReversible, type Q, type ReversibleSheet } from "@/lib/dosing";
import { fromBase, parseNum } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Card, Field, SheetView } from "./calc";

type Props = { module: "chlore" | "sulfate" | "dilution" | "stock" | "dimensionnement"; children: ReactNode };
export function ReversibleCalculator({ module, children }: Props) {
  const equations = EQUATIONS.filter((e) => e.module === module || ((module === "chlore" || module === "sulfate") && (e.module === "dosage" || e.id === "preparation")));
  const [view, setView] = useState("inverse");
  const [id, setId] = useState(equations[0]?.id ?? "continu");
  const eq = equations.find((e) => e.id === id) ?? equations[0];
  const [target, setTarget] = useState(eq?.variables[0]?.key ?? "Qi");
  const [fields, setFields] = useState<Record<string, { value: string; unit: string }>>({});
  const [sheet, setSheet] = useState<ReversibleSheet | null>(null);
  const [quantityUnit, setQuantityUnit] = useState("kg");
  if (!eq) return null;
  const unknown = eq.variables.find((v) => v.key === target) ?? eq.variables[0];
  if (!unknown) return null;
  const unitOf = (key: string) => fields[key]?.unit ?? Object.keys(eq.variables.find((v) => v.key === key)?.units ?? {})[0] ?? "—";
  const update = (key: string, change: { value?: string; unit?: string }) => {
    setFields((previous) => ({ ...previous, [key]: { value: previous[key]?.value ?? "", unit: unitOf(key), ...change } }));
    setSheet(null);
  };
  const loadExample = () => {
    setFields(Object.fromEntries(eq.variables.map((v) => {
      const unit = unitOf(v.key);
      return [v.key, { value: String(fromBase(eq.example[v.key] ?? 0, v.units, unit)).replace(".", ","), unit }];
    })));
    setSheet(null);
  };
  const calculate = () => {
    const inputs: Record<string, Q> = Object.fromEntries(eq.variables.map((v) => [v.key, { v: parseNum(fields[v.key]?.value ?? ""), u: unitOf(v.key) }]));
    setSheet(computeReversible(eq.id, unknown.key, inputs, unitOf(unknown.key), quantityUnit));
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 print:hidden" aria-label="Mode de calcul">
        <Button variant={view === "inverse" ? "default" : "outline"} onClick={() => setView("inverse")}><ArrowLeftRight />Calcul réversible</Button>
        <Button variant={view === "detailed" ? "default" : "outline"} onClick={() => setView("detailed")}><Calculator />Calcul détaillé</Button>
      </div>
      {view === "detailed" ? children : <>
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="text-sm font-medium">Relation de calcul</span>
              <select aria-label="Relation de calcul" className="mt-1 w-full min-w-0 rounded-md border bg-background px-3 py-2" value={eq.id} onChange={(e) => {
                const next = equations.find((item) => item.id === e.target.value);
                if (!next) return;
                setId(next.id); setTarget(next.variables[0]?.key ?? ""); setFields({}); setSheet(null);
              }}>{equations.map((e) => <option value={e.id} key={e.id}>{e.label}</option>)}</select>
            </label>
            <label className="block"><span className="text-sm font-medium">Paramètre à trouver</span>
              <select aria-label="Paramètre à trouver" className="mt-1 w-full min-w-0 rounded-md border bg-background px-3 py-2" value={unknown.key} onChange={(e) => { setTarget(e.target.value); setSheet(null); }}>
                {eq.variables.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
              </select>
            </label>
            {module === "stock" && <label className="block"><span className="text-sm font-medium">Unité commune des quantités</span><select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={quantityUnit} onChange={(e) => { setQuantityUnit(e.target.value); setSheet(null); }}>{["kg", "g", "t", "L", "m³"].map((u) => <option key={u}>{u}</option>)}</select></label>}
          </div>
          <div className="my-5 border-y py-3 font-mono text-sm break-words text-primary">{eq.formula}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            {eq.variables.filter((v) => v.key !== unknown.key).map((v) => <Field key={v.key} label={v.label} value={fields[v.key]?.value ?? ""} onChange={(value) => update(v.key, { value })} unit={unitOf(v.key) === "—" ? quantityUnit : unitOf(v.key)} units={Object.keys(v.units)[0] === "—" ? undefined : Object.keys(v.units)} onUnit={(unit) => update(v.key, { unit })} />)}
            <label className="block"><span className="text-sm font-medium">Unité du résultat — {unknown.label}</span><select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={unitOf(unknown.key)} onChange={(e) => update(unknown.key, { unit: e.target.value })}>{Object.keys(unknown.units).map((u) => <option key={u} value={u}>{u === "—" ? quantityUnit : u}</option>)}</select></label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 print:hidden">
            <Button onClick={calculate}><Calculator />CALCULER</Button>
            <Button variant="outline" onClick={() => { setFields({}); setSheet(null); }}><RotateCcw />Réinitialiser</Button>
            <Button variant="link" className="h-auto whitespace-normal text-left" onClick={loadExample}>Charger l'exemple de vérification</Button>
          </div>
        </Card>
        <div aria-live="polite">{sheet && <SheetView sheet={sheet} />}</div>
      </>}
    </div>
  );
}