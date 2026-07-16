import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProofPage from "@/app/proof/page";
import { runCanonicalLifecycle, V4_EVIDENCE, V4_PROGRAM_ID } from "@/lib/v4/replay";

describe("isolated V4 proof page", () => {
  it("leads with a concise judge proof summary", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    expect(html).toContain("Canonical proof, in plain English.");
    expect(html).toContain("Verified 20/20 · every recorded liability reconciled");
    expect(html).toContain("ORDER PROTECTION PROOF");
    expect(html).toContain("SETTLEMENT + ACCOUNTING");
    expect(html).toContain("TXLINE VERIFICATION");
    expect(html).toContain("0.010000000 SOL returned");
    expect(html).toContain("View full technical evidence");
  });

  it("presents only the genuine France-Morocco proof chain", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    for (const title of ["Genuine historical source", "Objective stale-sequence return", "Fixed payouts", "Final—not mid-game—result", "Conservative collateral", "Exact final state"]) expect(html).toContain(title);
    expect(html).toContain("France 2–0 Morocco");
    expect(html).not.toContain("France–Spain");
  });

  it("surfaces exact TxLINE root and program identities", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    expect(html).toContain(V4_PROGRAM_ID);
    expect(html).toContain(V4_EVIDENCE.oddsRootPda);
    expect(html).toContain(V4_EVIDENCE.scoresRootPda);
    expect(html).toContain("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
  });

  it("explains quote provenance without forcing protocol jargon", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    expect(html).toContain("TxLINE evidence becomes one reproducible executable quote.");
    expect(html).toContain("TxLINE odds");
    expect(html).toContain("Deterministic probability");
    expect(html).toContain("Executable YES / NO");
    expect(html).toContain("QuoteGuard · verified 2/2");
    expect(html).toContain("Technical quote commitments");
    expect(html).toContain("it cannot choose an arbitrary V4 quote");
  });

  it("renders every exact solvency transition", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    const lifecycle = runCanonicalLifecycle();
    for (const snapshot of lifecycle.snapshots) expect(html).toContain(snapshot.label);
    expect(html).toContain("Full solvency transition table");
    expect(html).toContain("0.199799428 SOL withdrawn");
  });

  it("labels the current evidence layers and separates model from on-chain proof", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    expect(html).toContain("Layer 01");
    expect(html).toContain("Layer 02");
    expect(html).toContain("Current V4 evidence");
    expect(html).toContain("latest complete verified result renders immediately");
    expect(html).toContain("Re-verify from Solana");
    expect(html).toContain("Last independently rechecked from Solana");
    expect(html).toContain("What the Solana program guarantees");
    expect(html).toContain("What FairX does not make trustless");
  });

  it("keeps predecessor evidence out of the primary V4 proof journey", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    expect(html).not.toContain("Deployed predecessor evidence");
    expect(html).not.toContain("6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe");
    expect(html).toContain(V4_PROGRAM_ID);
  });
});
