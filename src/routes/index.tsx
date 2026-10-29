import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PARAMS, evaluate, score, type Status } from "@/lib/water";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AquaAnalyse — Traitement et qualité de l'eau" },
      { name: "description", content: "Saisissez les paramètres de l'eau et obtenez une analyse de qualité et des traitements recommandés." },
      { property: "og:title", content: "AquaAnalyse — Traitement et qualité de l'eau" },
      { property: "og:description", content: "Analyse des paramètres physico-chimiques et bactériologiques de l'eau." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const label: Record<Status, string> = { ok: "Conforme", warn: "Limite", bad: "Non conforme" };
const cls: Record<Status, string> = {
  ok: "bg-ok/15 text-ok border-ok/40",
  warn: "bg-warn/15 text-warn border-warn/40",
  bad: "bg-destructive/15 text-destructive border-destructive/40",
};

function Index() {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(PARAMS.map((p) => [p.key, p.defaultValue])),
  );
  const res = score(values);
  const issues = PARAMS.filter((p) => evaluate(p, values[p.key] ?? 0) !== "ok");
  const tone: Status = res.critical || res.pct < 50 ? "bad" : res.pct < 90 ? "warn" : "ok";

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-hero text-primary-foreground">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-sm uppercase tracking-widest opacity-80">LABORATOIRE DE L'EAU - ENTREPRISE SANDANDRANO</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl">AquaAnalyse</h1>
          <p className="mt-3 max-w-xl opacity-90">
            Saisissez vos mesures : l'application évalue la qualité selon les normes OMS et propose les traitements adéquats.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-4 font-display text-2xl">Paramètres de traitement</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {PARAMS.map((p) => {
              const s = evaluate(p, values[p.key] ?? 0);
              const norm = p.min !== undefined ? `${p.min} – ${p.max}` : `≤ ${p.max}`;
              return (
                <div key={p.key} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{p.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${cls[s]}`}>{label[s]}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      value={values[p.key]}
                      onChange={(e) => setValues({ ...values, [p.key]: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="w-24 text-sm text-muted-foreground">{p.unit}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Norme : {norm} {p.unit}</p>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="font-display text-xl">Qualité de l'eau</h2>
            <div className={`mt-4 rounded-lg border p-4 text-center ${cls[tone]}`}>
              <div className="text-5xl font-bold">{res.pct}%</div>
              <div className="mt-1 text-lg font-semibold">{res.quality}</div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${res.pct}%` }} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {PARAMS.length - issues.length} / {PARAMS.length} paramètres conformes
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="font-display text-xl">Analyse & traitements</h2>
            {issues.length === 0 ? (
              <p className="mt-3 text-sm text-ok">Tous les paramètres sont conformes. Maintenir la désinfection et le suivi.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {issues.map((p) => {
                  const s = evaluate(p, values[p.key] ?? 0);
                  return (
                    <li key={p.key} className={`rounded-lg border p-3 text-sm ${cls[s]}`}>
                      <div className="font-semibold">{p.name} : {values[p.key]} {p.unit}</div>
                      <div className="mt-1 text-foreground/80">{p.advice}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
