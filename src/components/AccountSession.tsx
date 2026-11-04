import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getAccountStatus } from "@/lib/access.functions";
import { Button } from "@/components/ui/button";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
type Account = { signedIn: boolean; admin: boolean; checking: boolean; signOut: () => Promise<void> };
const AccountContext = createContext<Account>({ signedIn: false, admin: false, checking: true, signOut: async () => {} });
export const useAccount = () => useContext(AccountContext);
export function AccountSession({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const statusFn = useServerFn(getAccountStatus);
  const [state, setState] = useState({ signedIn: false, admin: false, checking: true });
  const [failure, setFailure] = useState(false);
  const signOut = async () => {
    await queryClient.cancelQueries(); queryClient.clear();
    await supabase.auth.signOut({ scope: "local" });
    setState({ signedIn: false, admin: false, checking: false });
    await router.navigate({ to: "/auth", replace: true });
  };
  useEffect(() => {
    let alive = true, running = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const check = async () => {
      if (running) return;
      running = true;
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        if (!data.session) { setState({ signedIn: false, admin: false, checking: false }); setFailure(false); return; }
        const status = await statusFn();
        if (!alive) return;
        if (!status.allowed) { await signOut(); return; }
        setFailure(false); setState({ signedIn: true, admin: status.admin, checking: false });
        if (!channel) {
          channel = supabase.channel(`account-access-${data.session.user.id}-${crypto.randomUUID()}`)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "account_access", filter: `user_id=eq.${data.session.user.id}` }, () => { void check(); }).subscribe();
        }
      } catch { if (alive) { setFailure(true); setState((old) => ({ ...old, checking: false })); } }
      finally { running = false; }
    };
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        if (channel) { void supabase.removeChannel(channel); channel = null; }
        setState({ signedIn: false, admin: false, checking: false });
        void router.invalidate();
      } else if (["SIGNED_IN", "USER_UPDATED", "TOKEN_REFRESHED"].includes(event)) { setTimeout(() => { void check(); }, 0); }
    });
    void check();
    const interval = setInterval(() => { void check(); }, 15000);
    const focus = () => { void check(); };
    window.addEventListener("focus", focus);
    return () => { alive = false; clearInterval(interval); listener.subscription.unsubscribe(); window.removeEventListener("focus", focus); if (channel) void supabase.removeChannel(channel); };
  }, [statusFn, queryClient, router]);
  return <AccountContext.Provider value={{ ...state, signOut }}>
    {failure ? <div className="mx-auto max-w-lg px-6 py-12"><h1 className="font-display text-2xl">Vérification du compte indisponible</h1><p className="my-4 text-muted-foreground">L’accès est suspendu pendant la vérification. Réessayez lorsque la connexion est rétablie.</p><Button onClick={() => window.location.reload()}>Réessayer</Button></div> : children}
  </AccountContext.Provider>;
}
export function AccountControls() {
  const account = useAccount();
  return <div className="flex flex-wrap gap-2">
    {account.admin && <Button asChild variant="outline" size="sm"><Link to="/admin"><ShieldCheck />Administration</Link></Button>}
    {account.signedIn ? <Button variant="ghost" size="sm" onClick={() => { void account.signOut(); }}><LogOut />Déconnexion</Button> : <Button asChild variant="outline" size="sm"><Link to="/auth"><UserRound />Connexion</Link></Button>}
  </div>;
}