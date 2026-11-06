import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useAccount } from "@/components/AccountSession";
import { Button } from "@/components/ui/button";

export function ApprovedAccess({ children }: { children: ReactNode }) {
  const account = useAccount();
  if (account.checking) return <main className="mx-auto max-w-md px-6 py-12"><p role="status">Vérification de votre autorisation…</p></main>;
  if (!account.allowed) return <main className="mx-auto max-w-md px-6 py-12">
    <h1 className="font-display text-3xl">{account.signedIn ? "En attente d’approbation" : "Connexion requise"}</h1>
    <p role="status" className="my-6 text-muted-foreground">{account.signedIn ? "Votre compte n’a pas encore été approuvé par l’administrateur. L’accès au site reste fermé." : "Connectez-vous avec un compte approuvé par l’administrateur."}</p>
    <Button asChild><Link to="/auth">{account.signedIn ? "Votre compte" : "Se connecter / créer un compte"}</Link></Button>
    {account.signedIn && <Button variant="ghost" className="mt-3" onClick={() => { void account.signOut(); }}>Déconnexion</Button>}
  </main>;
  return children;
}