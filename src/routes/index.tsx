import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pageHead } from "@/lib/head";
import { loadHistory, type Entry } from "@/lib/history";

export const Route = createFileRoute("/")({
  head: () => pageHead("Tableau de bord", "Calcul des dosages chimiques en traitement de l'eau potable : chlore, sulfate d'aluminium, dilution, stock et manuel technique."),
  component: Dashboard,
});

const modules = [
  { to: "/chlore", n: "01", t: "Dosage du chlore", d: "Débit d'injection, volume par lot, autonomie, contrôle de la pompe." },
  { to: "/sulfate", n: "02", t: "Sulfate d'aluminium", d: "Coagulant : injection, masse de produit, préparation de cuve." },
  { to: "/dilution", n: "03", t: "Préparation & dilution", d: "Solutions mères, C1V1 = C2V2, produit commercial vs actif." },
  { to: "/stock", n: "04", t: "Consommation & stock", d: "Autonomie, quantité à commander, coûts, prévisions." },
  { to: "/analyse", n: "05", t: "Vérification des paramètres", d: "Qualité de l'eau selon les valeurs guides OMS." },
  { to: "/historique", n: "06", t: "Historique & rapports", d: "Calculs enregistrés, export Excel, sauvegarde." },
  { to: "/manuel", n: "07", t: "Manuel technique", d: "Formules, définitions, exemples et recommandations." },
] as const;

function Dashboard() {
  const [hist, setHist] = useState<Entry[]>([]);
  useEffect(() => setHist(loadHistory()), []);
  return (
    <div>
      <section className="bg-hero text-primary-foreground">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-sm uppercase tracking-widest opacity-80">LABORATOIRE DE L'EAU - ENTREPRISE SANDANDRANO</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl">Manuel numérique de dosage</h1>
          <p className="mt-3 max-w-2xl opacity-90">
            Calculez, vérifiez et optimisez les dosages de chlore et de sulfate d'aluminium. Chaque résultat affiche ses formules, ses conversions d'unités et ses contrôles de cohérence.
          </p>
          <Link to="/chlore" className="mt-6 inline-block rounded-md bg-background px-5 py-2.5 font-semibold text-foreground hover:bg-background/90">Calculer un dosage de chlore</Link>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Link key={m.to} to={m.to} className="group rounded-xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50">
              <span className="font-display text-2xl text-primary/60">{m.n}</span>
              <h2 className="mt-1 text-lg font-semibold group-hover:text-primary">{m.t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{m.d}</p>
            </Link>
          ))}
        </div>
        <div className="mt-10 rounded-xl border bg-card p-5">
          <h2 className="font-display text-xl">Derniers calculs</h2>
          {hist.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Aucun calcul enregistré pour l'instant.</p> : (
            <ul className="mt-3 divide-y text-sm">
              {hist.slice(0, 5).map((e) => (
                <li key={e.id} className="flex justify-between gap-4 py-2">
                  <span>{e.sheet.title}</span>
                  <span className="text-right text-muted-foreground">{e.sheet.main?.value} · {new Date(e.date).toLocaleDateString("fr-FR")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Les résultats sont théoriques et ne garantissent pas la potabilité : confrontez-les aux mesures de terrain, aux essais (jar-test) et aux exigences sanitaires applicables.</p>
      </div>
    </div>
  );
}
