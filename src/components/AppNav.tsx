import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AccountControls } from "@/components/AccountSession";
const links = [
  ["/", "Tableau de bord"], ["/chlore", "Chlore"], ["/sulfate", "Sulfate d'alumine"], ["/dilution", "Dilution"],
  ["/dimensionnement", "Dimensionnement"], ["/stock", "Stock"], ["/analyse", "Analyse"], ["/historique", "Historique"], ["/manuel", "Manuel"],
  ["/jar-test", "Jar-test"], ["/chloration", "Chloration"],
] as const;

export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link to="/" className="shrink-0 font-display text-xl text-primary">AquaDosage</Link>
        <button className="rounded-md border px-3 py-1 text-sm lg:hidden" onClick={() => setOpen(!open)}>Menu</button>
        <div className="hidden min-w-0 flex-wrap justify-end gap-1 lg:flex">
          {links.map(([to, l]) => (
            <Link key={to} to={to} activeOptions={{ exact: true }} className="rounded-md px-2.5 py-1.5 text-sm hover:bg-muted" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>{l}</Link>
          ))}
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl justify-end px-6 pb-2"><AccountControls /></div>
      {open && (
        <div className="grid border-t px-6 py-2 lg:hidden">
          {links.map(([to, l]) => (
            <Link key={to} to={to} onClick={() => setOpen(false)} activeOptions={{ exact: true }} className="rounded-md px-2 py-2 text-sm" activeProps={{ className: "text-primary font-semibold" }}>{l}</Link>
          ))}
        </div>
      )}
    </nav>
  );
}
