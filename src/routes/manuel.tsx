import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Card, PageHeader } from "@/components/calc";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/manuel")({
  head: () => pageHead("Manuel technique", "Formules de dosage, définitions, conversions d'unités, exemples résolus et recommandations pour les stations de traitement d'eau."),
  component: Manuel,
});

const F = ({ children }: { children: ReactNode }) => <div className="my-2 rounded-md bg-muted px-4 py-2 font-mono text-sm">{children}</div>;

function Manuel() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <PageHeader title="Manuel technique" subtitle="Formules, définitions, conversions et exemples utilisés par l'application." />
      <Card title="1. Définitions">
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          <li><b>Dose appliquée (D)</b> : quantité de produit actif injectée par litre d'eau (mg/L).</li>
          <li><b>Demande en chlore</b> : quantité de chlore consommée par les matières oxydables de l'eau pendant le temps de contact.</li>
          <li><b>Chlore résiduel libre</b> : chlore restant après satisfaction de la demande. D ≈ demande + résiduel.</li>
          <li><b>Solution mère (Cm)</b> : solution concentrée injectée par la pompe doseuse.</li>
          <li><b>Teneur / titre commercial</b> : part de substance active dans le produit vendu (%).</li>
        </ul>
      </Card>
      <Card title="2. Formules de dosage">
        <p className="text-sm">Traitement en continu (D, Cm en mg/L ; Qe, Qi en L/s) :</p>
        <F>Qi = D × Qe / Cm &nbsp;&nbsp;→&nbsp;&nbsp; Qi(mL/s) = D × Qe × 1000 / Cm</F>
        <p className="text-sm">Traitement par lot (Vi et Ve dans la même unité de volume) :</p>
        <F>Vi = D × Ve / Cm</F>
        <p className="text-sm">Masse de produit actif et commercial :</p>
        <F>m = D × Ve &nbsp;&nbsp;;&nbsp;&nbsp; m_com = m / (teneur / 100)</F>
        <p className="text-sm">Consommation, autonomie et dose réelle :</p>
        <F>V = Qi × t &nbsp;;&nbsp; T = V_stock / Qi &nbsp;;&nbsp; D_réelle = Q_pompe × Cm / Qe</F>
        <p className="text-sm">Dilution (concentrations sur la même base) :</p>
        <F>C1 × V1 = C2 × V2</F>
      </Card>
      <Card title="3. Conversions d'unités">
        <table className="w-full text-sm">
          <tbody className="divide-y">
            {[["1 g/L", "1 000 mg/L"], ["1 g/m³", "1 mg/L"], ["1 mg/m³", "0,001 mg/L"], ["1 % (m/v)", "10 g/L = 10 000 mg/L"], ["1 m³/h", "0,27778 L/s"], ["1 m³/jour", "0,011574 L/s"], ["1 L/s", "3 600 L/h = 3,6 m³/h"], ["1 mL/s", "3,6 L/h"], ["1 m³", "1 000 L"], ["1 kg", "1 000 000 mg"]].map(([a, b]) => (
              <tr key={a}><td className="py-1.5 font-medium">{a}</td><td className="py-1.5 text-right tabular-nums">{b}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="4. Exemple de vérification — chlore">
        <p className="text-sm">Débit d'eau 3,5 L/s ; solution mère 40 000 mg/L ; dose visée 30 mg/L.</p>
        <F>Qi = 30 × 3,5 / 40 000 = 0,002625 L/s</F>
        <p className="text-sm">Soit <b>2,625 mL/s</b>, <b>9,45 L/h</b> et <b>226,8 L</b> sur 24 h. L'application reproduit exactement ces valeurs (tests automatiques).</p>
      </Card>
      <Card title="5. Exemple — sulfate d'aluminium">
        <p className="text-sm">Débit 100 m³/h ; solution 100 g/L ; dose 30 mg/L (issue d'un jar-test).</p>
        <F>Qe = 27,778 L/s ; Qi = 30 × 27,778 / 100 000 = 0,0083333 L/s = 30 L/h</F>
        <p className="text-sm">Produit pur consommé : 30 mg/L × 2 400 m³/j = 72 kg/jour.</p>
      </Card>
      <Card title="6. Recommandations">
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          <li>Déterminer la dose de coagulant par jar-test et la réajuster quand la qualité de l'eau brute change.</li>
          <li>Mesurer régulièrement la concentration réelle des solutions chlorées : elles se dégradent avec le temps, la chaleur et la lumière.</li>
          <li>Étalonner la pompe doseuse (mesure au volume / temps) et comparer avec le débit calculé.</li>
          <li>Contrôler le chlore résiduel sur le réseau : la dose doit couvrir la demande en chlore.</li>
          <li>Les résultats sont théoriques et ne garantissent pas la potabilité ; ils doivent être confrontés aux analyses et aux exigences sanitaires applicables.</li>
        </ul>
      </Card>
      <section className="border-t pt-6">
        <h2 className="mb-3 font-display text-xl">7. Essais de traitement et références</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Jar-test : même eau, volume, mélange et décantation entre béchers. Comparer dose, turbidité et pH ; la dose candidate est la plus petite dose testée satisfaisant les critères d'exploitation saisis, pas une dose imposée par une norme.</li>
          <li>Chloration : mesurer le libre et le total au même temps de contact. Combiné = total − libre ; consommé apparent = dose − total sur eau sans chlore initial. Le breakpoint est un repère expérimental à confirmer, jamais une valeur automatiquement certifiée.</li>
          <li>Repère OMS : au moins 0,5 mg/L de chlore libre après au moins 30 minutes à pH &lt; 8 ; adapter le contact à la température et aux organismes cibles. Viser une faible turbidité, idéalement &lt; 1 NTU avant désinfection.</li>
          <li>CT = résiduel final × temps effectif : exposition indicative, sans déduire un pourcentage d'inactivation. L'hydraulique (T10), la température et les contrôles microbiologiques doivent être validés.</li>
          <li><a className="text-primary underline" href="https://www.who.int/publications/i/item/9789240045064" target="_blank" rel="noreferrer">OMS — Guidelines for drinking-water quality (2022)</a> ; <a className="text-primary underline" href="https://www.astm.org/d2035-19.html" target="_blank" rel="noreferrer">ASTM D2035-19 — Jar test</a>. Exigences nationales applicables à vérifier ; l'application ne certifie pas la conformité locale.</li>
        </ul>
      </section>
    </div>
  );
}
