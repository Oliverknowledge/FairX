import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import WalkthroughPage from "@/app/walkthrough/page";

describe("judge-first public surfaces", () => {
  it("explains the product and action in the homepage hero", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain("Impossible-to-exploit prediction markets.");
    expect(html).toContain("Polymarket");
    expect(html).toContain("Trade");
    expect(html).toContain("Verify Proof");
    expect(html).not.toContain("Runtime status");
  });

  it("uses only the simplified primary navigation", () => {
    const html = renderToStaticMarkup(<HomePage />);
    const primaryNavigation = html.match(/<nav[^>]*aria-label="Primary navigation"[\s\S]*?<\/nav>/)?.[0] ?? "";
    for (const label of ["Trade", "How It Works"]) expect(primaryNavigation).toContain(label);
    for (const label of ["Create Market", "Attack Lab", "Attack-lab", "Guard terminal", "Operator status"]) expect(primaryNavigation).not.toContain(label);
    expect(html).toContain("Verify Proof");
  });

  it("shows only the genuine canonical market on the homepage", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain("France vs Morocco");
    expect(html).toContain("Will France win?");
    expect(html).not.toContain("Create market");
    expect(html).not.toContain("Creator market");
  });

  it("answers 'why is this fair?' with Capture, Protect, Verify", () => {
    const html = renderToStaticMarkup(<WalkthroughPage />);
    for (const title of ["Why is this fair?", "Capture", "Protect", "Verify"]) expect(html).toContain(title);
  });
});
