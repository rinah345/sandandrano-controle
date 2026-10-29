import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Actions, Card, Field, PageHeader, SheetView } from "@/components/calc";
import { computeDilution, computePreparation, type Sheet } from "@/lib/dosing";
import { pageHead } from "@/lib/head";
import { CONC, VOL, parseNum } from "@/lib/units";

export const Route = createFileRoute("/dilution")({
  head: () => pageHead("Préparation et dilution des solutions mères", "Masse de produit commercial, concentration obtenue et dilution C1V1 = C2V2."),
  component: Dilution,
});

const K = Object.keys;

function Dilution() {
  const [tab, setTab] = useState<"prep" | "dil">("prep");
  const [p, setP] = useState({ C: "", Cu: "g/L", V: "", Vu: "L", pur: "" });
  const [d, setD] = useState({ C1: "", C1u: "% (m/v)", C2: "", C2u: "% (m/v)", V2: "", V2u: "L" });
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const calc = () => setSheet(tab === "prep"
    ? computePreparation({ C: { v: parseNum(p.C), u: p.Cu }, V: { v: parseNum(p.V), u: p.Vu }, purity: parseNum(p.pur) })
    : computeDilution({ C1: { v: parseNum(d.C1), u: d.C1u }, C2: { v: parseNum(d.C2), u: d.C2u }, V2: { v: parseNum(d.V2), u: d.V2u } }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <PageHeader title="Préparation & dilution" subtitle="Distinguez la masse de produit commercial de la masse de substance active. Le volume d'eau ajouté n'est pas égal au volume final." />
      <Card>
        <div className="mb-4 inline-flex rounded-lg border p-1 print:hidden">
          {([["prep", "Préparer à partir d'un solide"], ["dil", "Diluer une solution"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setSheet(null); }} className={`rounded-md px-4 py-1.5 text-sm ${tab === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{l}</button>
          ))}
        </div>
        {tab === "prep" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Concentration cible" value={p.C} onChange={(v) => setP({ ...p, C: v })} unit={p.Cu} units={K(CONC)} onUnit={(u) => setP({ ...p, Cu: u })} />
            <Field label="Volume final de solution" value={p.V} onChange={(v) => setP({ ...p, V: v })} unit={p.Vu} units={K(VOL)} onUnit={(u) => setP({ ...p, Vu: u })} />
            <Field label="Teneur en produit actif" optional unit="%" value={p.pur} onChange={(v) => setP({ ...p, pur: v })} hint="Vide = produit supposé pur (100 %)." />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Concentration initiale C1" value={d.C1} onChange={(v) => setD({ ...d, C1: v })} unit={d.C1u} units={K(CONC)} onUnit={(u) => setD({ ...d, C1u: u })} />
            <Field label="Concentration finale souhaitée C2" value={d.C2} onChange={(v) => setD({ ...d, C2: v })} unit={d.C2u} units={K(CONC)} onUnit={(u) => setD({ ...d, C2u: u })} />
            <Field label="Volume final V2" value={d.V2} onChange={(v) => setD({ ...d, V2: v })} unit={d.V2u} units={K(VOL)} onUnit={(u) => setD({ ...d, V2u: u })} />
          </div>
        )}
        <Actions onCalc={calc} onReset={() => { setP({ ...p, C: "", V: "", pur: "" }); setD({ ...d, C1: "", C2: "", V2: "" }); setSheet(null); }} />
      </Card>
      {sheet && <SheetView sheet={sheet} />}
    </div>
  );
}
