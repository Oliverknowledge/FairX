import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProofPage from "@/app/proof/page";
import { runCanonicalLifecycle, V4_EVIDENCE, V4_PROGRAM_ID } from "@/lib/v4/replay";

describe("isolated V4 proof page", () => {
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

  it("renders every exact solvency transition", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    const lifecycle = runCanonicalLifecycle();
    for (const snapshot of lifecycle.snapshots) expect(html).toContain(snapshot.label);
    expect(html).toContain("Full solvency transition table");
    expect(html).toContain("0.199799428 SOL withdrawn");
  });

  it("labels all three evidence layers and separates model from on-chain proof", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    expect(html).toContain("Layer 01");
    expect(html).toContain("Layer 02");
    expect(html).toContain("Layer 03");
    expect(html).toContain("Current V4 evidence");
    expect(html).toContain("Deployed predecessor evidence");
    expect(html).toContain("fresh RPC checks of the finalized France–Morocco settlement lifecycle");
    expect(html).toContain("What the Solana program guarantees");
    expect(html).toContain("What FairX does not make trustless");
  });

  it("does not conflate V3 predecessor evidence with V4 deployment", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    // V4 is current; V3 remains a clearly separate historical predecessor.
    expect(html).toContain("Deployed predecessor evidence — LineGuard V3");
    expect(html).toContain("V3 is not evidence for V4");
    expect(html).toContain("6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe");
  });
});
