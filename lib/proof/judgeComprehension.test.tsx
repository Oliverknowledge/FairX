import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import PortfolioPage from "@/app/portfolio/page";

describe("V4 judge-first public surfaces", () => {
  it("explains the fixed-payout vault and replay action in the homepage hero", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain("FIXED PAYOUT · FULLY COLLATERALISED");
    expect(html).toContain("TxLINE supplies the source probability");
    expect(html).toContain("Run the France–Morocco replay");
    expect(html).toContain("Inspect the proof");
    expect(html).not.toContain("Polymarket");
  });

  it("uses only the reduced V4 primary navigation", () => {
    const html = renderToStaticMarkup(<HomePage />);
    const primaryNavigation = html.match(/<nav[^>]*aria-label="Primary navigation"[\s\S]*?<\/nav>/)?.[0] ?? "";
    for (const label of ["Home", "Replay market", "Positions", "Proof"]) expect(primaryNavigation).toContain(label);
    for (const label of ["Create Market", "Attack Lab", "Guard terminal", "Operator status", "How It Works"]) expect(primaryNavigation).not.toContain(label);
  });

  it("shows only the canonical France-Morocco V4 replay", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain("France 2–0 Morocco");
    expect(html).toContain("fixture 18209181");
    expect(html).toContain("SEQ 1114");
    expect(html).not.toContain("France vs Spain");
  });

  it("labels positions as deterministic outputs rather than deployed accounts", () => {
    const html = renderToStaticMarkup(<PortfolioPage />);
    expect(html).toContain("deterministic lifecycle outputs");
    expect(html).toContain("not connected-wallet or deployed accounts");
    expect(html).toContain("Stake returned atomically");
  });
});
