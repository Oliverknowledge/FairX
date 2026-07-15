import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import PortfolioPage from "@/app/portfolio/page";

describe("V4 judge-first public surfaces", () => {
  it("positions FairX as operator infrastructure and explains the sequence rule", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain("Return the stale order. Keep the market open.");
    expect(html).toContain("Solana infrastructure for prediction-market operators");
    expect(html).toContain("Genuine TxLINE historical replay");
    expect(html).toContain("Watch the protected market");
    expect(html).toContain("See operator integration");
    expect(html).toContain("0.008769297 SOL");
    expect(html).toContain("Verified does not mean trustless");
    expect(html).not.toContain("Polymarket");
  });

  it("uses only the reduced V4 primary navigation", () => {
    const html = renderToStaticMarkup(<HomePage />);
    const primaryNavigation = html.match(/<nav[^>]*aria-label="Primary navigation"[\s\S]*?<\/nav>/)?.[0] ?? "";
    for (const label of ["Replay", "For operators", "Proof"]) expect(primaryNavigation).toContain(label);
    expect(primaryNavigation).not.toContain("Positions");
    expect(primaryNavigation).not.toContain(">Home<");
    for (const label of ["Create Market", "Attack Lab", "Guard terminal", "Operator status", "How It Works"]) expect(primaryNavigation).not.toContain(label);
  });

  it("shows only the canonical France-Morocco V4 replay", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain("France vs Morocco");
    expect(html).toContain("QUOTE 738 · EVENT 739");
    expect(html).toContain("RPC verified 20/20");
    expect(html).not.toContain("France vs Spain");
  });

  it("labels positions as deterministic outputs rather than deployed accounts", () => {
    const html = renderToStaticMarkup(<PortfolioPage />);
    expect(html).toContain("deterministic reference outcomes");
    expect(html).toContain("not connected-wallet balances");
    expect(html).toContain("Principal returned · no position created");
    expect(html).toContain("Technical details");
  });
});
