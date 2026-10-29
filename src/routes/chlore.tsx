import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/calc";
import { DosingCalculator } from "@/components/DosingCalculator";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/chlore")({
  head: () => pageHead("Calculateur de dosage du chlore", "Débit d'injection de solution chlorée, volume par lot, autonomie du stock et comparaison avec la pompe doseuse."),
  component: () => (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader title="Dosage du chlore" subtitle="Mode A : débit d'injection à partir du débit d'eau. Mode B : volume de solution mère pour une cuve ou un bassin. Toutes les unités sont converties avant calcul." />
      <DosingCalculator kind="chlore" />
    </div>
  ),
});
