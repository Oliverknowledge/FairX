import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import PortfolioPage from "@/app/portfolio/page";

describe("V4 judge-first public surfaces", () => {
  it("positions FairX as operational market-integrity infrastructure", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain("The stale order stops. The market doesn’t.");
    expect(html).toContain("operational integrity layer");
    expect(html).toContain("Run integrity incident");
    expect(html).toContain("Recorded evidence + deterministic controls");
    expect(html).toContain("Market integrity panel");
    expect(html).toContain("Open proof summary");
    expect(html).not.toContain("Polymarket");
  });

  it("uses only the reduced V4 primary navigation", () => {
    const html = renderToStaticMarkup(<HomePage />);
    const primaryNavigation = html.match(/<nav[^>]*aria-label="Primary navigation"[\s\S]*?<\/nav>/)?.[0] ?? "";
    for (const label of ["Demo", "Integrate", "Proof"]) expect(primaryNavigation).toContain(label);
    expect(primaryNavigation).not.toContain("Positions");
    for (const label of ["Create Market", "Attack Lab", "Guard terminal", "Operator status", "Replay"]) expect(primaryNavigation).not.toContain(label);
  });

  it("separates canonical France-Morocco evidence from the reusable second scenario", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain("Recorded TxLINE evidence");
    expect(html).toContain("ARG–BRA");
    expect(html).toContain("Argentina–Brazil is a runtime reference and makes no on-chain settlement claim");
    expect(html).toContain("MARKET OPEN");
  });

  it("labels positions as deterministic outputs rather than deployed accounts", () => {
    const html = renderToStaticMarkup(<PortfolioPage />);
    expect(html).toContain("deterministic reference outcomes");
    expect(html).toContain("not connected-wallet balances");
    expect(html).toContain("Principal returned · no position created");
    expect(html).toContain("Technical details");
  });
});
