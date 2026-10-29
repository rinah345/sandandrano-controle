import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/calc";
import { DosingCalculator } from "@/components/DosingCalculator";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/sulfate")({
  head: () => pageHead("Dosage du sulfate d'aluminium", "Calcul du débit d'injection du coagulant, de la masse de produit et de la préparation des cuves."),
  component: () => (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader title="Dosage du sulfate d'aluminium" subtitle="La dose optimale dépend de l'eau brute et doit être déterminée ou confirmée par jar-test (essai de coagulation-floculation)." />
      <DosingCalculator kind="sulfate" />
    </div>
  ),
});
