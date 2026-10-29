import { useState } from "react";
import { computeDosing, type Q, type Sheet } from "@/lib/dosing";
import { CONC, FLOW, INJ, MASS, TIME, VOL, parseNum } from "@/lib/units";
import { Actions, Card, Field, SheetView } from "./calc";

const K = (t: Record<string, number>) => Object.keys(t);
type F = { v: string; u: string };

function initial(kind: "chlore" | "sulfate") {
  return {
    Cm: { v: "", u: kind === "chlore" ? "mg/L" : "g/L" }, D: { v: "", u: "mg/L" }, Qe: { v: "", u: "L/s" }, Ve: { v: "", u: "m³" },
    stock: { v: "", u: "L" }, t: { v: "", u: "h" }, pump: { v: "", u: "mL/s" }, residual: { v: "", u: "mg/L" }, demand: { v: "", u: "mg/L" },
    productMass: { v: "", u: "kg" }, tankV: { v: "", u: "L" }, tankC: { v: "", u: "% (m/v)" }, purity: { v: "", u: "%" },
  } as Record<string, F>;
}

export function DosingCalculator({ kind }: { kind: "chlore" | "sulfate" }) {
  const [mode, setMode] = useState<"continu" | "lot">("continu");
  const [f, setF] = useState(initial(kind));
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const bind = (k: string, units?: string[]) => ({
    value: f[k].v, unit: f[k].u, units,
    onChange: (v: string) => setF({ ...f, [k]: { ...f[k], v } }),
    onUnit: (u: string) => setF({ ...f, [k]: { ...f[k], u } }),
  });
  const q = (k: string): Q => ({ v: parseNum(f[k].v), u: f[k].u });

  const calc = () => {
    setSheet(computeDosing(kind, {
      mode, Cm: q("Cm"), D: q("D"), Qe: q("Qe"), Ve: q("Ve"), stock: q("stock"), t: q("t"), pump: q("pump"),
      residual: q("residual"), demand: q("demand"), productMass: q("productMass"), tankV: q("tankV"), tankC: q("tankC"),
      purity: parseNum(f.purity.v),
    }));
    setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth" }), 50);
  };
  const loadExample = () => {
    setMode("continu");
    const n = initial(kind);
    if (kind === "chlore") { n.Qe.v = "3,5"; n.Cm.v = "40000"; n.Cm.u = "mg/L"; n.D.v = "30"; n.t.v = "24"; }
    else { n.Qe.v = "100"; n.Qe.u = "m³/h"; n.Cm.v = "100"; n.D.v = "30"; n.t.v = "24"; }
    setF(n); setSheet(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="inline-flex rounded-lg border p-1">
            {(["continu", "lot"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`rounded-md px-4 py-1.5 text-sm ${mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                {m === "continu" ? "A — En continu" : "B — Par lot"}
              </button>
            ))}
          </div>
          <button onClick={loadExample} className="text-sm text-primary underline-offset-4 hover:underline">Charger l'exemple de vérification</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Concentration de la solution mère (Cm)" {...bind("Cm", K(CONC))} />
          <Field label="Dose cible à appliquer (D)" {...bind("D", K(CONC))} hint={kind === "sulfate" ? "À déterminer par jar-test." : "Dose injectée, distincte du résiduel."} />
          {mode === "continu"
            ? <Field label="Débit d'eau à traiter (Qe)" {...bind("Qe", K(FLOW))} />
            : <Field label="Volume d'eau à traiter (Ve)" {...bind("Ve", K(VOL))} />}
          <Field label="Durée de fonctionnement" optional {...bind("t", K(TIME))} />
          <Field label="Volume de solution mère disponible" optional {...bind("stock", K(VOL))} />
          {mode === "continu" && <Field label="Débit réel de la pompe doseuse" optional {...bind("pump", K(INJ))} />}
          {kind === "chlore" && <>
            <Field label="Chlore résiduel mesuré" optional {...bind("residual", K(CONC))} />
            <Field label="Demande en chlore estimée" optional {...bind("demand", K(CONC))} />
          </>}
          {kind === "sulfate" && <>
            <Field label="Teneur en produit actif du commercial" optional unit="%" value={f.purity.v} onChange={(v) => setF({ ...f, purity: { ...f.purity, v } })} hint="Seulement si connue (fiche technique)." />
            <Field label="Quantité de produit disponible" optional {...bind("productMass", K(MASS))} />
            <Field label="Volume de la cuve de préparation" optional {...bind("tankV", K(VOL))} />
            <Field label="Concentration souhaitée de la cuve" optional {...bind("tankC", K(CONC))} />
          </>}
        </div>
        <Actions onCalc={calc} onReset={() => { setF(initial(kind)); setSheet(null); }} />
      </Card>
      <div id="result">{sheet && <SheetView sheet={sheet} />}</div>
    </div>
  );
}
