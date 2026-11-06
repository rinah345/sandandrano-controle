import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader, SheetView } from "@/components/calc";
import { pageHead } from "@/lib/head";
import { download, downloadCSV, loadHistory, saveHistory, sheetToRows, type Entry } from "@/lib/history";

export const Route = createFileRoute("/_authenticated/historique")({
  head: () => pageHead("Historique des calculs", "Consultez, exportez et sauvegardez les calculs de dosage enregistrés."),
  component: Historique,
});

function Historique() {
  const [list, setList] = useState<Entry[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => setList(loadHistory()), []);
  const update = (l: Entry[]) => { setList(l); saveHistory(l); };

  const exportAll = () => downloadCSV("historique-dosages.csv", list.flatMap((e) => [[new Date(e.date).toLocaleString("fr-FR")], ...sheetToRows(e.sheet), [], []]));
  const backup = () => download("sauvegarde-aquadosage.json", new Blob([JSON.stringify(list, null, 2)], { type: "application/json" }));
  const restore = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data)) throw new Error();
      const ids = new Set(list.map((e) => e.id));
      update([...data.filter((e: Entry) => e?.id && e?.sheet && !ids.has(e.id)), ...list]);
      toast.success("Sauvegarde importée");
    } catch { toast.error("Fichier de sauvegarde invalide"); }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader title="Historique & rapports" subtitle="Les calculs sont enregistrés sur cet appareil. Exportez-les ou faites une sauvegarde pour les transférer." />
      <div className="mb-6 flex flex-wrap gap-2 text-sm print:hidden">
        <button disabled={!list.length} onClick={exportAll} className="rounded-md border px-3 py-1.5 hover:bg-muted disabled:opacity-50">Exporter tout en Excel</button>
        <button disabled={!list.length} onClick={backup} className="rounded-md border px-3 py-1.5 hover:bg-muted disabled:opacity-50">Sauvegarder (JSON)</button>
        <button onClick={() => file.current?.click()} className="rounded-md border px-3 py-1.5 hover:bg-muted">Importer une sauvegarde</button>
        <input ref={file} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        {list.length > 0 && <button onClick={() => confirm("Effacer tout l'historique ?") && update([])} className="rounded-md border border-destructive/40 px-3 py-1.5 text-destructive hover:bg-destructive/10">Tout effacer</button>}
      </div>
      {list.length === 0 ? <p className="text-muted-foreground">Aucun calcul enregistré. Utilisez « Enregistrer le calcul » sur une fiche de résultats.</p> : (
        <ul className="space-y-3">
          {list.map((e) => (
            <li key={e.id} className="rounded-xl border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <button onClick={() => setOpen(open === e.id ? null : e.id)} className="text-left">
                  <div className="font-semibold">{e.sheet.title}</div>
                  <div className="text-sm text-muted-foreground">{new Date(e.date).toLocaleString("fr-FR")} · {e.sheet.main?.label} : {e.sheet.main?.value}</div>
                </button>
                <button onClick={() => update(list.filter((x) => x.id !== e.id))} className="text-sm text-destructive print:hidden">Supprimer</button>
              </div>
              {open === e.id && <div className="border-t p-4"><SheetView sheet={e.sheet} saved /></div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
