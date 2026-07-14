import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProofPage from "@/app/proof/page";
import { runCanonicalLifecycle, V4_EVIDENCE, V4_PROGRAM_ID } from "@/lib/v4/replay";

describe("isolated V4 proof page", () => {
  it("presents only the genuine France-Morocco proof chain", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    for (const title of ["Pre-goal StablePrice", "Confirmed goal", "Post-goal StablePrice", "Final—not mid-game—evidence", "Regulation-time period", "Strict stale invalidation", "Fixed payout"]) expect(html).toContain(title);
    expect(html).toContain("Sequence 1114, France 2–0 Morocco");
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
    expect(html).toContain("A = F + R + S");
    expect(html).toContain("0.199799 SOL");
  });

  it("is explicit that V4 has not been deployed or signed", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    expect(html).toContain("No V4 deployment or signed transaction exists in Phase B");
  });
});
