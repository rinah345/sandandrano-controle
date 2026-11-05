import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getAccountStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: allowed, error } = await context.supabase.rpc("account_session_allowed");
  if (error) throw new Error("Vérification du compte indisponible.");
  const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (roleError) throw new Error("Vérification des droits indisponible.");
  return { allowed: allowed === true, admin: allowed === true && admin === true };
});

export const listAccounts = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: { page: number }) => z.object({ page: z.number().int().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: admin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !admin) throw new Error("Accès réservé à l'administrateur.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: data.page, perPage: 50 });
    if (usersError) throw new Error("Liste des comptes indisponible.");
    const ids = users.users.map((u) => u.id);
    const { data: states, error: statesError } = await supabaseAdmin.from("account_access").select("user_id,blocked,updated_at").in("user_id", ids);
    const { data: roles, error: rolesError } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin").in("user_id", ids);
    if (statesError || rolesError) throw new Error("Statuts indisponibles.");
    return { hasNext: users.users.length === 50, users: users.users.map((u) => ({ id: u.id, email: u.email ?? "—", createdAt: u.created_at, confirmed: !!u.email_confirmed_at, blocked: states?.find((s) => s.user_id === u.id)?.blocked ?? false, admin: roles?.some((r) => r.user_id === u.id) ?? false })) };
  });

export const setAccountAccess = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; blocked: boolean }) => z.object({ userId: z.string().uuid(), blocked: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: admin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !admin) throw new Error("Accès réservé à l'administrateur.");
    if (data.userId === context.userId) throw new Error("Votre accès administrateur est protégé.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error: roleError } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", data.userId).eq("role", "admin");
    if (roleError || roles?.length) throw new Error("Accès administrateur protégé.");
    // Fail closed: block app access first; on reactivation unban auth first.
    if (!data.blocked) {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "none" });
      if (banError) throw new Error("Réactivation impossible, compte maintenu bloqué.");
    }
    const { error: updateError } = await context.supabase.rpc("set_account_access", { target: data.userId, should_block: data.blocked });
    if (updateError) throw new Error("Modification non appliquée. Actualisez et réessayez.");
    if (data.blocked) {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "876000h" });
      if (banError) return { warning: "Accès à l'application bloqué ; refus de connexion à synchroniser. Cliquez de nouveau sur Bloquer." };
    }
    return { warning: null };
  });

export const listAccessAudit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: { page: number }) => z.object({ page: z.number().int().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: admin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !admin) throw new Error("Accès réservé à l'administrateur.");
    const { data: events, error: auditError } = await context.supabase.from("account_access_audit").select("id,target_id,actor_id,blocked,changed_at").order("changed_at", { ascending: false }).range((data.page - 1) * 50, data.page * 50 - 1);
    if (auditError) throw new Error("Historique indisponible.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = [...new Set((events ?? []).flatMap((e) => [e.target_id, e.actor_id]))];
    const names = new Map<string, string>();
    await Promise.all(ids.map(async (id) => { const { data: user } = await supabaseAdmin.auth.admin.getUserById(id); names.set(id, user.user?.email ?? "Compte supprimé"); }));
    return { hasNext: events?.length === 50, events: (events ?? []).map((e) => ({ id: e.id, target: names.get(e.target_id) ?? "—", actor: names.get(e.actor_id) ?? "—", blocked: e.blocked, at: e.changed_at })) };
  });