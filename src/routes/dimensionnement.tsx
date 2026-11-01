import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Actions, Card, Field, PageHeader, SheetView } from "@/components/calc";
import { computeSizing, type Sheet } from "@/lib/dosing";
import { pageHead } from "@/lib/head";
import { FLOW, TIME, VOL, parseNum } from "@/lib/units";
import { ReversibleCalculator } from "@/components/ReversibleCalculator";

export const Route = createFileRoute("/dimensionnement")({
  head: () => pageHead("Dimensionnement décanteur et filtre", "Volume, surface et hauteur d'un décanteur, d'un filtre ou d'un bassin de contact à partir du débit et du temps de séjour."),
  component: Sizing,
});

const K = Object.keys;
const empty = { Q: "", Qu: "m³/h", t: "", tu: "h", V: "", Vu: "m³", vh: "", n: "" };
const types = [["decanteur", "Décanteur"], ["filtre", "Filtre"], ["contact", "Bassin de contact"]] as const;

function Sizing() {
  const [type, setType] = useState<"decanteur" | "filtre" | "contact">("decanteur");
  const [f, setF] = useState(empty);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const set = (k: keyof typeof empty) => (v: string) => setF({ ...f, [k]: v });
  const calc = () => setSheet(computeSizing({
    type, Q: { v: parseNum(f.Q), u: f.Qu }, t: { v: parseNum(f.t), u: f.tu }, V: { v: parseNum(f.V), u: f.Vu }, vh: parseNum(f.vh), n: parseNum(f.n),
  }));
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <PageHeader title="Dimensionnement des ouvrages" subtitle="V = Q × t ; S = Q / vitesse ; H = V / S. Saisissez un temps de séjour pour obtenir le volume, ou un volume existant pour vérifier le temps de séjour." />
      <ReversibleCalculator module="dimensionnement"><Card>
        <div className="mb-4 inline-flex flex-wrap rounded-lg border p-1 print:hidden">
          {types.map(([k, l]) => (
            <button key={k} onClick={() => { setType(k); setSheet(null); }} className={`rounded-md px-4 py-1.5 text-sm ${type === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{l}</button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Débit d'eau à traiter (Q)" value={f.Q} onChange={set("Q")} unit={f.Qu} units={K(FLOW)} onUnit={set("Qu")} />
          <Field label="Temps de séjour / contact (t)" value={f.t} onChange={set("t")} unit={f.tu} units={K(TIME)} onUnit={set("tu")} />
          <Field label="Volume existant" optional value={f.V} onChange={set("V")} unit={f.Vu} units={K(VOL)} onUnit={set("Vu")} hint="Pour vérifier un ouvrage déjà construit." />
          {type !== "contact" && <>
            <Field label={type === "filtre" ? "Vitesse de filtration" : "Vitesse ascensionnelle (charge superficielle)"} value={f.vh} onChange={set("vh")} unit="m/h" hint="Valeur de conception choisie par l'ingénieur." />
            <Field label="Nombre d'unités" optional value={f.n} onChange={set("n")} unit="unités" />
          </>}
        </div>
        <Actions onCalc={calc} onReset={() => { setF(empty); setSheet(null); }} />
      </Card>
      {sheet && <SheetView sheet={sheet} />}
      </ReversibleCalculator>
    </div>
  );
}
