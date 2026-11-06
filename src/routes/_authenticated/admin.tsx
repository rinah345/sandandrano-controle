import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LockKeyhole, ShieldCheck, UnlockKeyhole, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useAccount } from "@/components/AccountSession";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/calc";
import { listAccounts, listAccessAudit, setAccountAccess } from "@/lib/access.functions";
import { pageHead } from "@/lib/head";
export const Route = createFileRoute("/_authenticated/admin")({ head: () => pageHead("Administration des comptes", "Gestion sécurisée des accès AquaDosage : activation, blocage des comptes et historique des modifications."), component: Admin });
function Admin() {
  const account = useAccount();
  return <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><PageHeader title="Administration · comptes" subtitle="Autorisations d'accès et journal des modifications." />{account.checking ? <p>Vérification des droits…</p> : account.admin ? <AdminWorkspace /> : <div className="border-t py-6"><p className="mb-4 text-muted-foreground">Accès réservé à l'administrateur.</p><Button asChild><Link to="/auth">Connexion</Link></Button></div>}</main>;
}
function AdminWorkspace() {
  const queryClient = useQueryClient(); const [page, setPage] = useState(1); const [auditPage, setAuditPage] = useState(1);
  const [pending, setPending] = useState<string | null>(null); const [message, setMessage] = useState("");
  const [retryBlock, setRetryBlock] = useState<string | null>(null);
  const fetchAccounts = useServerFn(listAccounts); const fetchAudit = useServerFn(listAccessAudit); const changeAccess = useServerFn(setAccountAccess);
  const accounts = useQuery({ queryKey: ["admin-accounts", page], queryFn: () => fetchAccounts({ data: { page } }) });
  const audit = useQuery({ queryKey: ["admin-audit", auditPage], queryFn: () => fetchAudit({ data: { page: auditPage } }) });
  const modify = async (id: string, blocked: boolean) => { setPending(id); setMessage(""); try { const result = await changeAccess({ data: { userId: id, blocked } }); setRetryBlock(result.warning ? id : null); setMessage(result.warning ?? (blocked ? "Compte bloqué. Sessions antérieures invalidées pour l'application." : "Compte réactivé. Une nouvelle connexion est nécessaire.")); await Promise.all([queryClient.invalidateQueries({ queryKey: ["admin-accounts"] }), queryClient.invalidateQueries({ queryKey: ["admin-audit"] })]); } catch (e) { setMessage(e instanceof Error ? e.message : "Modification impossible."); } finally { setPending(null); } };
  const date = (s: string) => new Date(s).toLocaleString("fr-FR");
  return <div className="space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3"><h2 className="font-display text-xl">Comptes utilisateurs</h2><Button variant="outline" size="sm" onClick={() => { void accounts.refetch(); void audit.refetch(); }}><RefreshCw />Actualiser</Button></div>
    {accounts.isPending ? <p>Chargement des comptes…</p> : accounts.isError ? <p role="alert" className="text-destructive">Impossible de charger les comptes. Actualisez la page.</p> : <>
      {accounts.data.users.length === 0 && <p className="text-muted-foreground">Aucun compte sur cette page.</p>}
      <div className="divide-y border-y">{accounts.data.users.map((user) => <div key={user.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="min-w-0 flex-1"><p className="break-all font-semibold">{user.email}</p><p className="mt-1 text-xs text-muted-foreground">Créé le {date(user.createdAt)} · {user.confirmed ? "E-mail confirmé" : "E-mail non confirmé"}</p></div>
        <span className={`rounded-md border px-3 py-1 text-sm ${user.blocked ? "border-destructive/30 bg-destructive/10 text-destructive" : user.approved ? "border-ok/30 bg-ok/10 text-ok" : "bg-muted text-muted-foreground"}`}>{user.blocked ? "Bloqué" : user.approved ? "Actif" : "En attente d’approbation"}</span>
        {user.admin ? <span className="flex items-center gap-2 text-sm text-primary"><ShieldCheck size={16} />Administrateur</span> : <Button variant={user.blocked || !user.approved ? "outline" : "destructive"} disabled={pending !== null || (!user.confirmed && !user.approved)} onClick={() => { void modify(user.id, user.approved && !user.blocked); }}>{user.blocked || !user.approved ? <UnlockKeyhole /> : <LockKeyhole />}{pending === user.id ? "En cours…" : !user.approved ? "Approuver" : user.blocked ? "Activer" : "Bloquer"}</Button>}
      </div>)}</div>
      <div className="flex items-center justify-end gap-3"><Button size="icon" variant="outline" aria-label="Comptes précédents" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft /></Button><span className="text-sm">Page {page}</span><Button size="icon" variant="outline" aria-label="Comptes suivants" disabled={!accounts.data.hasNext} onClick={() => setPage(page + 1)}><ChevronRight /></Button></div>
    </>}
    {message && <p role="status" className="rounded-md border bg-muted p-3 text-sm">{message}</p>}
    {retryBlock && <Button disabled={pending !== null} variant="destructive" onClick={() => { void modify(retryBlock, true); }}>Réessayer le blocage des connexions</Button>}
    <section className="border-t pt-6"><h2 className="mb-4 font-display text-2xl">Historique des autorisations</h2>{audit.isPending ? <p>Chargement du journal…</p> : audit.isError ? <p role="alert">Historique indisponible.</p> : <>
      {!audit.data.events.length && <p className="text-muted-foreground">Aucune modification enregistrée.</p>}
      <ul className="divide-y">{audit.data.events.map((event) => <li key={event.id} className="grid gap-2 py-4 text-sm sm:grid-cols-3"><span className="break-all font-medium">{event.target}</span><span className={event.blocked ? "text-destructive" : "text-ok"}>{event.blocked ? "Bloqué" : "Activé"} · {date(event.at)}</span><span className="break-all text-muted-foreground">Par {event.actor}</span></li>)}</ul>
      <div className="mt-3 flex items-center justify-end gap-3"><Button size="icon" variant="outline" aria-label="Journal précédent" disabled={auditPage === 1} onClick={() => setAuditPage(auditPage - 1)}><ChevronLeft /></Button><span className="text-sm">Page {auditPage}</span><Button size="icon" variant="outline" aria-label="Journal suivant" disabled={!audit.data.hasNext} onClick={() => setAuditPage(auditPage + 1)}><ChevronRight /></Button></div>
    </>}</section>
  </div>;
}