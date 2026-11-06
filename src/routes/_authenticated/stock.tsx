import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Actions, Card, Field, PageHeader, SheetView } from "@/components/calc";
import { computeStock, type Sheet } from "@/lib/dosing";
import { pageHead } from "@/lib/head";
import { parseNum } from "@/lib/units";
import { ReversibleCalculator } from "@/components/ReversibleCalculator";

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => pageHead("Consommation et stock de produits", "Autonomie du stock, quantité à commander, coûts et prévisions de consommation de produits chimiques."),
  component: Stock,
});

const empty = { product: "", unit: "kg", rate: "", rateU: "/jour", initial: "", consumed: "", price: "", period: "", safety: "" };

function Stock() {
  const [f, setF] = useState(empty);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const set = (k: keyof typeof empty) => (v: string) => setF({ ...f, [k]: v });
  const calc = () => setSheet(computeStock({
    product: f.product, unit: f.unit, rate: { v: parseNum(f.rate), u: f.rateU }, initial: parseNum(f.initial),
    consumed: parseNum(f.consumed), price: parseNum(f.price), period: parseNum(f.period), safety: parseNum(f.safety),
  }));
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <PageHeader title="Consommation & stock" subtitle="Suivez chaque produit, cuve ou station : enregistrez chaque calcul pour garder un historique par site et par période." />
      <ReversibleCalculator module="stock"><Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-medium">Produit / cuve / station</span>
            <input value={f.product} onChange={(e) => set("product")(e.target.value)} placeholder="ex. Hypochlorite — Station Nord" className="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label>
          <label className="block"><span className="text-sm font-medium">Unité de quantité</span>
            <select value={f.unit} onChange={(e) => set("unit")(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2">
              {["kg", "t", "g", "L", "m³"].map((u) => <option key={u}>{u}</option>)}
            </select></label>
          <Field label="Consommation" value={f.rate} onChange={set("rate")} unit={f.rateU} units={["/h", "/jour", "/semaine", "/mois"]} onUnit={set("rateU")} hint={`En ${f.unit} par période.`} />
          <Field label="Stock initial" value={f.initial} onChange={set("initial")} unit={f.unit} />
          <Field label="Stock déjà consommé" optional value={f.consumed} onChange={set("consumed")} unit={f.unit} />
          <Field label="Période de prévision" optional value={f.period} onChange={set("period")} unit="jours" />
          <Field label="Stock de sécurité souhaité" optional value={f.safety} onChange={set("safety")} unit={f.unit} />
          <Field label="Prix unitaire" optional value={f.price} onChange={set("price")} unit={`/ ${f.unit}`} />
        </div>
        <Actions onCalc={calc} onReset={() => { setF(empty); setSheet(null); }} />
      </Card>
      {sheet && <SheetView sheet={sheet} />}
      </ReversibleCalculator>
    </div>
  );
}
