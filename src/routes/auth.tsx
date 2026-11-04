import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import "@lovable.dev/cloud-auth-js/styles.css";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/head";
import { useAccount } from "@/components/AccountSession";

export const Route = createFileRoute("/auth")({ head: () => pageHead("Connexion aux comptes", "Connexion et création de compte AquaDosage, accès administrateur et récupération du mot de passe."), component: Auth });
function Auth() {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const account = useAccount(); const navigate = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMessage("Si ce compte existe, un lien de réinitialisation vous sera envoyé.");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        setMessage("Consultez votre e-mail et confirmez votre adresse avant de vous connecter.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setPassword("");
        await navigate({ to: "/" });
      }
    } catch { setMessage(mode === "login" ? "Connexion refusée : vérifiez vos identifiants, la confirmation de l'e-mail ou contactez l'administrateur si votre compte est bloqué." : "Impossible de traiter la demande. Vérifiez les informations et réessayez."); }
    finally { setBusy(false); }
  };
  const social = async (provider: "google" | "lovable") => {
    setBusy(true); setMessage("");
    try { const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin }); if (result.error) throw result.error; if (!result.redirected) await navigate({ to: "/" }); }
    catch { setMessage("Connexion indisponible ou compte bloqué. Réessayez ou contactez l'administrateur."); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-md px-6 py-12">
    <h1 className="font-display text-3xl">{account.signedIn ? "Votre compte" : mode === "signup" ? "Créer un compte" : mode === "reset" ? "Mot de passe oublié" : "Connexion"}</h1>
    {account.signedIn ? <div className="mt-6 space-y-4">{account.admin && <Button asChild><Link to="/admin">Administration</Link></Button>}<Button variant="outline" onClick={() => { void account.signOut(); }}>Déconnexion</Button></div> : <>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">Adresse e-mail<input aria-label="Adresse e-mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label>
        {mode !== "reset" && <label className="block text-sm font-medium">Mot de passe<input aria-label="Mot de passe" type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label>}
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Veuillez patienter…" : mode === "login" ? "Se connecter" : mode === "signup" ? "Créer le compte" : "Envoyer le lien"}</Button>
      </form>
      {mode !== "reset" && <div className="mt-4 grid gap-3"><Button variant="outline" disabled={busy} onClick={() => { void social("google"); }}>Continuer avec Google</Button><Button className="lovable-auth-button" disabled={busy} onClick={() => { void social("lovable"); }}>Continue with Lovable</Button></div>}
      <div className="mt-4 flex flex-wrap gap-2"><Button variant="link" className="px-0" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setMessage(""); }}>{mode === "signup" ? "Déjà inscrit ? Connexion" : "Créer un compte"}</Button><Button variant="link" onClick={() => { setMode(mode === "reset" ? "login" : "reset"); setMessage(""); }}>{mode === "reset" ? "Retour à la connexion" : "Mot de passe oublié"}</Button></div>
    </>}
    {message && <p role="status" className="mt-4 rounded-md border bg-muted p-3 text-sm">{message}</p>}
    <Button asChild variant="link" className="mt-4 px-0"><Link to="/">Retour aux calculateurs</Link></Button>
  </main>;
}