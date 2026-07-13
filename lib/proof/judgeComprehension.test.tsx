import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import MarketsPage from "@/app/markets/page";
import WalkthroughPage from "@/app/walkthrough/page";

describe("judge-first public surfaces", () => {
  it("explains the product and action in the homepage hero", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain("Refund the stale-price exploit. Keep the market.");
    expect(html).toContain("Inspect the market");
    expect(html).toContain("Run the verifier");
    expect(html).not.toContain("Runtime status");
  });

  it("uses only the simplified primary navigation", () => {
    const html = renderToStaticMarkup(<HomePage />);
    const primaryNavigation = html.match(/<nav[^>]*aria-label="Primary navigation"[\s\S]*?<\/nav>/)?.[0] ?? "";
    for (const label of ["Markets", "My Positions", "How It Works"]) expect(primaryNavigation).toContain(label);
    for (const label of ["Create Market", "Attack Lab", "Technical terminal", "Operator status"]) expect(primaryNavigation).not.toContain(label);
    expect(html).toContain("Verify Proof");
  });

  it("shows only the genuine canonical market", () => {
    const html = renderToStaticMarkup(<MarketsPage />);
    expect(html).toContain("France vs Morocco");
    expect(html).toContain("TxLINE historical");
    expect((html.match(/View market/g) ?? []).length).toBe(1);
    expect(html).not.toContain("Creator market");
  });

  it("keeps the full explanation on How It Works", () => {
    const html = renderToStaticMarkup(<WalkthroughPage />);
    for (const title of ["Match event occurs", "TxLINE evidence reports it", "Market price may lag", "A user submits an order", "LineGuard checks the edge", "Refund or accept", "The winner claims"]) expect(html).toContain(title);
  });
});
