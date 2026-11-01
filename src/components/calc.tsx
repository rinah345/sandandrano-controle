import type { ReactNode } from "react";
import { toast } from "sonner";
import type { Check, Sheet } from "@/lib/dosing";
import { addEntry, downloadCSV, sheetToRows } from "@/lib/history";

export function Field({ label, value, onChange, unit, units, onUnit, hint, optional }: {
  label: string; value: string; onChange: (v: string) => void; unit?: string | undefined; units?: string[] | undefined; onUnit?: ((u: string) => void) | undefined; hint?: string | undefined; optional?: boolean | undefined;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}{optional && <span className="ml-1 text-xs font-normal text-muted-foreground">(facultatif)</span>}</span>
      <div className="mt-1 flex gap-2">
        <input aria-label={label} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="—"
          className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring" />
        {units ? (
          <select aria-label={`Unité — ${label}`} value={unit} onChange={(e) => onUnit?.(e.target.value)} className="w-28 rounded-md border bg-background px-2 py-2 text-sm">
            {units.map((u) => <option key={u}>{u}</option>)}
          </select>
        ) : unit ? <span className="flex w-28 items-center text-sm text-muted-foreground">{unit}</span> : null}
      </div>
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border bg-card p-5 shadow-sm ${className}`}>
      {title && <h2 className="mb-4 font-display text-xl">{title}</h2>}
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-3xl md:text-4xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export function Actions({ onCalc, onReset }: { onCalc: () => void; onReset: () => void }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2 print:hidden">
      <button onClick={onCalc} className="rounded-md bg-primary px-6 py-2.5 font-semibold tracking-wide text-primary-foreground hover:bg-primary/90">CALCULER</button>
      <button onClick={onReset} className="rounded-md border px-4 py-2.5 hover:bg-muted">Réinitialiser</button>
    </div>
  );
}

const checkCls: Record<Check["level"], string> = {
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  warn: "border-warn/40 bg-warn/10 text-warn",
  info: "border-primary/30 bg-primary/5 text-primary",
  ok: "border-ok/40 bg-ok/10 text-ok",
};
const checkIcon: Record<Check["level"], string> = { error: "✕", warn: "⚠", info: "ℹ", ok: "✓" };

function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="divide-y text-sm">
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between gap-4 py-1.5">
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd className="text-right font-medium tabular-nums">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Sec({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{n}. {title}</h3>
      {children}
    </section>
  );
}

export function SheetView({ sheet, saved = false }: { sheet: Sheet; saved?: boolean }) {
  const errors = sheet.checks.filter((c) => c.level === "error");
  const save = () => { addEntry(sheet); toast.success("Calcul enregistré dans l'historique"); };
  const excel = () => downloadCSV(`${sheet.module}-${new Date().toISOString().slice(0, 10)}.csv`, sheetToRows(sheet));
  let n = 0;
  return (
    <div className="print-area space-y-5 rounded-xl border-2 border-primary/30 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Fiche de résultats</p>
          <h2 className="font-display text-2xl">{sheet.title}</h2>
        </div>
        {errors.length === 0 && (
          <div className="flex flex-wrap gap-2 text-sm print:hidden">
            {!saved && <button onClick={save} className="rounded-md border px-3 py-1.5 hover:bg-muted">Enregistrer le calcul</button>}
            <button onClick={() => window.print()} className="rounded-md border px-3 py-1.5 hover:bg-muted">Exporter en PDF</button>
            <button onClick={excel} className="rounded-md border px-3 py-1.5 hover:bg-muted">Exporter en Excel</button>
            <button onClick={() => window.print()} className="rounded-md border px-3 py-1.5 hover:bg-muted">Imprimer</button>
          </div>
        )}
      </div>

      {errors.length > 0 ? (
        <div className="space-y-2">
          <p className="font-semibold text-destructive">Calcul impossible — corrigez les points suivants :</p>
          {errors.map((c, i) => <div key={i} className={`rounded-md border p-3 text-sm ${checkCls.error}`}>✕ {c.msg}</div>)}
        </div>
      ) : (
        <>
          {sheet.main && (
            <div className="rounded-lg bg-hero p-5 text-primary-foreground">
              <div className="text-sm opacity-85">{sheet.main.label}</div>
              <div className="mt-1 font-display text-3xl tabular-nums">{sheet.main.value}</div>
            </div>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            <Sec n={++n} title="Données saisies"><Rows rows={sheet.inputs} /></Sec>
            <Sec n={++n} title="Unités converties"><Rows rows={sheet.conversions} /></Sec>
          </div>
          <Sec n={++n} title="Formules et calculs étape par étape">
            <ol className="space-y-2">
              {sheet.steps.map((st, i) => (
                <li key={i} className="rounded-md border bg-muted/40 p-3 text-sm">
                  <div className="font-semibold">{st.label}</div>
                  <div className="mt-1 font-mono text-xs">{st.formula}</div>
                  <div className="font-mono text-xs text-muted-foreground">{st.substitution}</div>
                  <div className="mt-1 font-semibold text-primary tabular-nums">= {st.result}</div>
                </li>
              ))}
            </ol>
          </Sec>
          <div className="grid gap-5 md:grid-cols-2">
            {sheet.results.length > 0 && <Sec n={++n} title="Résultats et conversions usuelles"><Rows rows={sheet.results} /></Sec>}
            {sheet.forecast.length > 0 && <Sec n={++n} title="Consommations prévisionnelles"><Rows rows={sheet.forecast} /></Sec>}
          </div>
          <Sec n={++n} title="Contrôles de cohérence">
            <div className="space-y-2">
              {sheet.checks.map((c, i) => <div key={i} className={`rounded-md border p-2.5 text-sm ${checkCls[c.level]}`}>{checkIcon[c.level]} {c.msg}</div>)}
            </div>
          </Sec>
          <Sec n={++n} title="Interprétation technique">
            <ul className="list-disc space-y-1 pl-5 text-sm">{sheet.interpretation.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </Sec>
          <Sec n={++n} title="Hypothèses, limites et vérifications recommandées">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{[...sheet.hypotheses, ...sheet.limits].map((t, i) => <li key={i}>{t}</li>)}</ul>
          </Sec>
        </>
      )}
    </div>
  );
}
