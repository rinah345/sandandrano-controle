import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/calc";
import { TreatmentTrials } from "@/components/TreatmentTrials";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/_authenticated/jar-test")({
  head: () => pageHead("Jar-test et courbe du sulfate d'aluminium", "Mesures en béchers, courbe dose–turbidité, abattement et sélection d'une dose candidate de coagulant, avec références OMS et ASTM D2035."),
  component: () => <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
    <div className="mb-3 flex flex-wrap gap-3 text-sm print:hidden"><Button asChild variant="link" className="px-0"><Link to="/sulfate">Dosage sur station</Link></Button><Button asChild variant="link"><Link to="/chloration">Essais de chloration</Link></Button></div>
    <PageHeader title="Jar-test · sulfate d'aluminium" subtitle="Coagulation–floculation : dose de coagulant, turbidité décantée et pH mesurés. Sélection expérimentale, à confirmer sur station." />
    <TreatmentTrials kind="sulfate" />
  </main>,
});