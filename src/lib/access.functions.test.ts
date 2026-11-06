import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
const privileged = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: privileged }));
import { getAccountStatus, listAccounts, listAccessAudit, setAccountAccess } from "./access.functions";
type Invocation = { context: { userId: string; supabase: { rpc: ReturnType<typeof vi.fn>; from?: ReturnType<typeof vi.fn> } }; data?: { userId?: string; blocked?: boolean; page?: number } };
const accessRow = (approved: boolean, blocked = false) => vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { approved, blocked } }) }) }) }));
const invoke = (fn: unknown, input: Invocation) => (fn as (input: Invocation) => Promise<unknown>)(input);
describe("autorisation des comptes", () => {
  it("un utilisateur ordinaire ne peut pas bloquer un compte", async () => {
    await expect(invoke(setAccountAccess, { context: { userId: "caller", supabase: { rpc: vi.fn().mockResolvedValue({ data: false }) } }, data: { userId: "target", blocked: true } })).rejects.toThrow("Accès réservé");
  });
  it("un utilisateur ordinaire ne peut pas lire la liste des comptes", async () => {
    await expect(invoke(listAccounts, { context: { userId: "caller", supabase: { rpc: vi.fn().mockResolvedValue({ data: false }) } }, data: { page: 1 } })).rejects.toThrow("Accès réservé");
  });
  it("l'historique est réservé à l'administrateur", async () => {
    await expect(invoke(listAccessAudit, { context: { userId: "caller", supabase: { rpc: vi.fn().mockResolvedValue({ data: false }) } }, data: { page: 1 } })).rejects.toThrow("Accès réservé");
  });
  it("l'administrateur ne peut pas bloquer son propre accès", async () => {
    await expect(invoke(setAccountAccess, { context: { userId: "caller", supabase: { rpc: vi.fn().mockResolvedValue({ data: true }) } }, data: { userId: "caller", blocked: true } })).rejects.toThrow("protégé");
  });
  it("une session rejetée reste non autorisée même avec une réponse de rôle positive", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: false }).mockResolvedValueOnce({ data: true });
    expect(await invoke(getAccountStatus, { context: { userId: "caller", supabase: { rpc, from: accessRow(true) } } })).toEqual({ allowed: false, admin: false, approved: true, blocked: false });
    expect(rpc).toHaveBeenNthCalledWith(1, "account_session_allowed");
  });
  it("une erreur de vérification n'accorde jamais l'accès", async () => {
    await expect(invoke(getAccountStatus, { context: { userId: "caller", supabase: { rpc: vi.fn().mockResolvedValue({ error: { message: "offline" } }) } } })).rejects.toThrow("indisponible");
  });
  it("un compte en attente ne reçoit aucun droit administrateur", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: false }).mockResolvedValueOnce({ data: false });
    expect(await invoke(getAccountStatus, { context: { userId: "pending", supabase: { rpc, from: accessRow(false) } } })).toEqual({ allowed: false, admin: false, approved: false, blocked: false });
  });
  it("un utilisateur ne peut pas approuver un autre compte", async () => {
    await expect(invoke(setAccountAccess, { context: { userId: "caller", supabase: { rpc: vi.fn().mockResolvedValue({ data: false }) } }, data: { userId: "target", blocked: false } })).rejects.toThrow("Accès réservé");
  });
});