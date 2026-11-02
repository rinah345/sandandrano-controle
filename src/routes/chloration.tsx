import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/calc";
import { TreatmentTrials } from "@/components/TreatmentTrials";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/chloration")({
  head: () => pageHead("Courbe de chloration et essais de demande", "Courbe dose–résiduel libre et total, demande apparente, repère du breakpoint et exposition CT indicative avec recommandations OMS."),
  component: () => <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
    <div className="mb-3 flex flex-wrap gap-3 text-sm print:hidden"><Button asChild variant="link" className="px-0"><Link to="/chlore">Dosage sur station</Link></Button><Button asChild variant="link"><Link to="/jar-test">Jar-test sulfate</Link></Button></div>
    <PageHeader title="Courbe de chloration" subtitle="Essais dose–réponse : chlore libre et total après un contact contrôlé, demande apparente et exposition CT indicative. Références OMS." />
    <TreatmentTrials kind="chlore" />
  </main>,
});