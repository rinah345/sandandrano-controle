import { useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { FlaskConical, Plus, Trash2, Calculator, RotateCcw, ArrowLeftRight } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { computeTrials, type TrialPoint, type TrialResult } from "@/lib/dosing";
import { fmt, parseNum } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Field, SheetView } from "@/components/calc";
import { ReversibleCalculator } from "@/components/ReversibleCalculator";

type Kind = "chlore" | "sulfate";
type Measurement = { dose: string; response: string; total: string; ph: string };
const blank = (): Measurement => ({ dose: "", response: "", total: "", ph: "" });
const defaults = (kind: Kind) => ({
  sample: "", operator: "", date: "", temperature: "", raw: "", alkalinity: "", ammonia: "",
  contact: "", target: kind === "chlore" ? "0,5" : "2", maximum: "1", phMin: "6", phMax: "8",
  stock: "", beaker: "1", breakpoint: "", rapidRpm: "", rapidTime: "", slowRpm: "", slowTime: "", method: "",
});
type Values = ReturnType<typeof defaults>;

export function TreatmentTrials({ kind }: { kind: Kind }) {
  const [view, setView] = useState("trials");
  return <div className="space-y-6">
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button variant={view === "trials" ? "default" : "outline"} onClick={() => setView("trials")}><FlaskConical />Essais & courbes</Button>
      <Button variant={view === "inverse" ? "default" : "outline"} onClick={() => setView("inverse")}><ArrowLeftRight />Calculs des essais</Button>
    </div>
    {view === "trials" ? <TrialWorkspace key={kind} kind={kind} /> : <ReversibleCalculator module="essais"><TrialWorkspace key={kind} kind={kind} /></ReversibleCalculator>}
  </div>;
}

function TrialWorkspace({ kind }: { kind: Kind }) {
  const chlorine = kind === "chlore";
  const [values, setValues] = useState(defaults(kind));
  const [rows, setRows] = useState<Measurement[]>(Array.from({ length: 6 }, blank));
  const [result, setResult] = useState<TrialResult | null>(null);
  const [demo, setDemo] = useState(false);
  const [stockUnit, setStockUnit] = useState("g/L");
  const numeric = (v: string) => parseNum(v) ?? NaN;
  const update = (key: keyof Values, value: string) => { setValues((old) => ({ ...old, [key]: value })); setResult(null); };
  const field = (key: keyof Values, label: string, unit?: string, optional = false) => <Field label={label} value={values[key]} unit={unit} optional={optional} onChange={(v) => update(key, v)} />;
  const reset = () => { setValues(defaults(kind)); setRows(Array.from({ length: 6 }, blank)); setResult(null); setDemo(false); setStockUnit("g/L"); };
  const example = () => {
    setDemo(true); setResult(null); setStockUnit("g/L");
    setValues({ ...defaults(kind), sample: "Échantillon fictif", operator: "Démonstration", temperature: "22", raw: chlorine ? "0,6" : "50", alkalinity: "80", ammonia: chlorine ? "0,3" : "", contact: "30", stock: chlorine ? "1" : "10", method: chlorine ? "DPD libre et total — exemple" : "Néphélométrie — exemple", rapidRpm: chlorine ? "" : "150", rapidTime: chlorine ? "" : "1", slowRpm: chlorine ? "" : "40", slowTime: chlorine ? "" : "20", breakpoint: chlorine ? "2" : "" });
    const data = chlorine
      ? [[0, 0, 0, 7.2], [0.5, 0.02, 0.3, 7.2], [1, 0.03, 0.6, 7.2], [1.5, 0.05, 0.25, 7.2], [2, 0.2, 0.25, 7.2], [2.5, 0.6, 0.65, 7.2], [3, 1.1, 1.15, 7.2]]
      : [[0, 50, 0, 7.2], [10, 18, 0, 7.1], [20, 4, 0, 6.9], [30, 1.2, 0, 6.7], [40, 0.8, 0, 6.4], [50, 2.5, 0, 5.8]];
    setRows(data.map(([dose, response, total, ph]) => ({ dose: String(dose), response: String(response), total: String(total), ph: String(ph) })));
  };
  const calculate = () => {
    const points: TrialPoint[] = rows.map((r) => ({ dose: numeric(r.dose), response: numeric(r.response), ph: numeric(r.ph), ...(chlorine ? { total: numeric(r.total) } : {}) }));
    const metadata = [
      { label: "Échantillon", value: values.sample || "Non renseigné" }, { label: "Opérateur", value: values.operator || "Non renseigné" },
      { label: "Date / heure du prélèvement", value: values.date || "Non renseignées" }, { label: "Méthode / appareil", value: values.method || "Non renseigné" },
      { label: "Alcalinité", value: values.alkalinity ? `${values.alkalinity} mg/L CaCO₃` : "Non mesurée" },
      ...(chlorine ? [{ label: "Ammonium", value: values.ammonia ? `${values.ammonia} mg/L N` : "Non mesuré" }] : [
        { label: "Mélange rapide", value: `${values.rapidRpm || "—"} tr/min ; ${values.rapidTime || "—"} min` },
        { label: "Mélange lent", value: `${values.slowRpm || "—"} tr/min ; ${values.slowTime || "—"} min` },
      ]),
    ];
    setResult(computeTrials({ kind, points, rawTurbidity: numeric(values.raw), contactMinutes: numeric(values.contact), temperature: numeric(values.temperature), target: numeric(values.target), maxResidual: numeric(values.maximum), phMin: numeric(values.phMin), phMax: numeric(values.phMax), stockConcentration: { v: parseNum(values.stock), u: stockUnit }, beakerVolume: { v: parseNum(values.beaker), u: "L" }, breakpoint: chlorine ? parseNum(values.breakpoint) : null, metadata, demonstration: demo }));
  };
  const changeRow = (index: number, key: keyof Measurement, value: string) => { setRows((old) => old.map((r, i) => i === index ? { ...r, [key]: value } : r)); setResult(null); };
  const valid = result && !result.checks.some((c) => c.level === "error");
  return <div className="space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3">
      <p className="text-sm font-semibold">{demo ? "DONNÉES FICTIVES — DÉMONSTRATION" : "DONNÉES EXPÉRIMENTALES"}</p>
      <Button variant="outline" onClick={example}><FlaskConical />Exemple fictif</Button>
    </div>
    <section>
      <h2 className="mb-4 font-display text-xl">01 · Échantillon & protocole</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {field("sample", "Référence de l'échantillon", undefined, true)}
        {field("operator", "Opérateur", undefined, true)}
        <label className="block text-sm font-medium">Date / heure du prélèvement<input aria-label="Date / heure du prélèvement" type="datetime-local" value={values.date} onChange={(e) => update("date", e.target.value)} className="mt-1 w-full min-w-0 rounded-md border bg-background px-3 py-2" /></label>
        {field("raw", "Turbidité de l'eau brute", "NTU")}
        {field("temperature", "Température de l'eau", "°C")}
        {field("alkalinity", "Alcalinité", "mg/L CaCO₃", true)}
        {chlorine && field("ammonia", "Ammonium (en azote)", "mg/L N", true)}
        {field("contact", chlorine ? "Contact effectif de l'essai" : "Durée de décantation", "min")}
        {field("method", "Méthode / appareil", undefined, true)}
        {!chlorine && <>{field("rapidRpm", "Agitation rapide", "tr/min", true)}{field("rapidTime", "Durée du mélange rapide", "min", true)}{field("slowRpm", "Agitation lente", "tr/min", true)}{field("slowTime", "Durée du mélange lent", "min", true)}</>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{chlorine ? "Mesures DPD libre et total au même instant, en équivalent Cl₂. Eau initialement sans chlore." : "Protocole de coagulation–floculation puis décantation identique entre béchers. Vitesses et durées à valider sur l'appareil, pas de protocole universel."}</p>
    </section>
    <section className="border-t pt-6">
      <h2 className="mb-4 font-display text-xl">02 · Solution mère & critères opérationnels</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Concentration de la solution d'essai" value={values.stock} unit={stockUnit} units={["g/L", "mg/L", "% (m/v)"]} onChange={(v) => update("stock", v)} onUnit={(u) => { setStockUnit(u); setResult(null); }} />
        {field("beaker", "Volume d'eau par bécher", "L")}
        {field("target", chlorine ? "Chlore libre minimum visé" : "Turbidité maximale après décantation", chlorine ? "mg/L" : "NTU")}
        {chlorine ? <>{field("maximum", "Chlore libre maximum opérationnel", "mg/L")}{field("breakpoint", "Dose repère du breakpoint (opérateur)", "mg/L", true)}</> : <>{field("phMin", "pH minimum opérationnel")}{field("phMax", "pH maximum opérationnel")}</>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{chlorine ? "Objectif initial 0,5 mg/L : repère OMS après ≥ 30 min à pH < 8, pas une dose prescrite. Limite haute 1 mg/L : critère d'exploitation modifiable, non limite réglementaire." : "Doses en mg/L de sulfate commercial sec ; solution mère sur la même base. Les valeurs initiales 2 NTU et pH 6–8 sont des critères d'exemple modifiables, pas une norme."}</p>
    </section>
    <section className="border-t pt-6">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-display text-xl">03 · Mesures par bécher</h2><Button variant="outline" size="sm" onClick={() => { setRows((old) => [...old, blank()]); setResult(null); }}><Plus />Ajouter</Button></div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[580px] text-sm">
          <thead className="bg-muted"><tr>{["Bécher", "Dose (mg/L)", chlorine ? "Libre (mg/L)" : "Turbidité (NTU)", ...(chlorine ? ["Total (mg/L)"] : []), "pH", ""].map((h, i) => <th className="px-3 py-3 text-left font-medium" key={i}>{h}</th>)}</tr></thead>
          <tbody className="divide-y">{rows.map((r, i) => <tr key={i}>
            <td className="px-3 text-muted-foreground">{String(i + 1).padStart(2, "0")}</td>
            {(["dose", "response", ...(chlorine ? ["total"] : []), "ph"] as (keyof Measurement)[]).map((key) => <td className="p-2" key={key}><input aria-label={`Bécher ${i + 1} — ${key === "dose" ? "Dose" : key === "ph" ? "pH" : key === "total" ? "Chlore total" : chlorine ? "Chlore libre" : "Turbidité"}`} inputMode="decimal" value={r[key]} onChange={(e) => changeRow(i, key, e.target.value)} className="w-full min-w-20 rounded-md border bg-background px-2 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-ring" placeholder="—" /></td>)}
            <td className="p-2"><Button variant="ghost" size="icon" aria-label={`Supprimer le bécher ${i + 1}`} title="Supprimer ce bécher" disabled={rows.length <= 3} onClick={() => { setRows((old) => old.filter((_, index) => index !== i)); setResult(null); }}><Trash2 /></Button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 print:hidden"><Button onClick={calculate}><Calculator />Analyser les essais</Button><Button variant="outline" onClick={reset}><RotateCcw />Réinitialiser</Button></div>
    </section>
    {valid && <section className="border-t pt-6" aria-label="Courbe expérimentale">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><h2 className="font-display text-2xl">{chlorine ? "Courbe de chloration" : "Courbe de coagulation"}</h2><span className="text-xs text-muted-foreground">{demo ? "Mesures fictives" : "Mesures saisies"} · {result.series.length} points</span></div>
      <div className="h-80 w-full min-w-0" role="img" aria-label={chlorine ? "Résiduels libre et total en fonction de la dose de chlore" : "Turbidité après décantation en fonction de la dose de sulfate"}>
        <ClientOnly fallback={<div className="flex h-full items-center justify-center text-muted-foreground">Chargement du graphique…</div>}><ResponsiveContainer width="100%" height="100%"><LineChart data={result.series} margin={{ top: 15, right: 20, bottom: 25, left: 5 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="dose" type="number" domain={["dataMin", "dataMax"]} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} label={{ value: "Dose appliquée (mg/L)", position: "bottom", fill: "var(--muted-foreground)" }} />
          <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} width={48} label={{ value: chlorine ? "mg/L" : "NTU", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)" }} />
          <Tooltip formatter={(value: number, name: string) => [`${fmt(value)} ${chlorine ? "mg/L" : "NTU"}`, name]} labelFormatter={(label) => `Dose : ${fmt(Number(label))} mg/L`} contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} />
          <Legend verticalAlign="top" />
          <ReferenceLine y={numeric(values.target)} stroke="var(--warn)" strokeDasharray="5 5" />
          {result.selectedDose !== undefined && <ReferenceLine x={result.selectedDose} stroke="var(--ok)" strokeDasharray="4 4" />}
          {chlorine && parseNum(values.breakpoint) !== null && <ReferenceLine x={numeric(values.breakpoint)} stroke="var(--warn)" label={{ value: "Repère opérateur", fill: "var(--muted-foreground)", fontSize: 11 }} />}
          <Line type="linear" dataKey="response" name={chlorine ? "Chlore libre" : "Turbidité décantée"} stroke="var(--primary)" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
          {chlorine && <Line type="linear" dataKey="total" name="Chlore total" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />}
        </LineChart></ResponsiveContainer></ClientOnly>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Points reliés sans lissage ; aucune prédiction entre les doses. Trait horizontal : objectif saisi. Trait vertical vert : dose candidate testée.</p>
    </section>}
    <div aria-live="polite">{result && <SheetView sheet={result} />}</div>
    <section className="border-t pt-6 text-sm">
      <h2 className="mb-3 font-display text-xl">Références & validation</h2>
      <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
        <li><a className="text-primary underline" href="https://www.who.int/publications/i/item/9789240045064" target="_blank" rel="noreferrer">OMS — Guidelines for drinking-water quality, 2022</a> : recommandations internationales, distinctes des exigences réglementaires nationales.</li>
        <li><a className="text-primary underline" href="https://www.astm.org/d2035-19.html" target="_blank" rel="noreferrer">ASTM D2035-19 — Coagulation–flocculation jar test</a> : cadre de comparaison des essais, sans dose optimale universelle ; consulter l'édition applicable et le texte intégral.</li>
        <li>La température, l'alcalinité et la qualité de l'eau modifient les résultats. Par eau froide, adapter le contact. Aucune courbe ne certifie la potabilité ; confirmer par analyses, contrôles sur station et exigences locales.</li>
      </ul>
    </section>
  </div>;
}