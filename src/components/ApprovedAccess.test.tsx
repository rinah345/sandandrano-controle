import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ signedIn: false, allowed: false, admin: false, checking: false, signOut: vi.fn() }));
vi.mock("@/components/AccountSession", () => ({ useAccount: () => state }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
import { ApprovedAccess } from "./ApprovedAccess";
afterEach(cleanup);
describe("site approval boundary", () => {
  it.each([
    { signedIn: false, allowed: false, checking: false },
    { signedIn: true, allowed: false, checking: false },
    { signedIn: true, allowed: true, checking: true },
  ])("never mounts private content without completed approval: %j", (value) => {
    Object.assign(state, value);
    const mounted = vi.fn();
    function PrivateContent() { mounted(); return <div>private</div>; }
    render(<ApprovedAccess><PrivateContent /></ApprovedAccess>);
    expect(mounted).not.toHaveBeenCalled();
  });
  it("mounts private content for an approved session", () => {
    Object.assign(state, { signedIn: true, allowed: true, checking: false });
    render(<ApprovedAccess><div data-testid="private" /></ApprovedAccess>);
    expect(screen.getByTestId("private")).toBeInTheDocument();
  });
});