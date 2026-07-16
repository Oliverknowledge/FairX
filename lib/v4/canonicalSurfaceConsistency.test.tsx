import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import PortfolioPage from "@/app/portfolio/page";
import ProofPage from "@/app/proof/page";
import IntegratePage from "@/app/integrate/page";
import { RUNTIME_STAGE_LABELS } from "@/lib/runtime/engine";
import { canonicalStaleCounterfactual, runCanonicalLifecycle } from "@/lib/v4/replay";

describe("canonical judge-facing contract", () => {
  it("pins the primary stale-sequence order and synchronized comparison", () => {
    const lifecycle = runCanonicalLifecycle();
    const stale = lifecycle.positions.find((position) => position.id === "stale-bot")!;
    const synchronized = lifecycle.positions.find((position) => position.id === "post-yes")!;
    const economics = canonicalStaleCounterfactual();

    expect(stale.ownerLabel).toBe("Stale-sequence trader");
    expect(stale.stakeLamports).toBe(10_000_000n);
    expect(stale.materialEventSequence).toBe(738);
    expect(stale.priceMicros).toBe(532_785n);
    expect(stale.status).toBe("REFUNDED");
    expect(stale.liabilityLamports).toBe(0n);
    expect(economics.staleLiabilityLamports).toBe(8_769_297n);

    expect(synchronized.stakeLamports).toBe(10_000_000n);
    expect(synchronized.materialEventSequence).toBe(739);
    expect(synchronized.priceMicros).toBe(874_793n);
    expect(synchronized.liabilityLamports).toBe(1_431_275n);
  });

  it("keeps the same primary numbers visible across the four major summaries", () => {
    const home = renderToStaticMarkup(<HomePage />);
    const positions = renderToStaticMarkup(<PortfolioPage />);
    const proof = renderToStaticMarkup(<ProofPage />);
    const integrate = renderToStaticMarkup(<IntegratePage />);

    expect(home).toContain("0.010000000 SOL returned");
    expect(home).toContain("0.008769297 SOL");
    expect(home).toContain("YES 53.28¢");
    expect(home).toContain("STALE_SEQUENCE_RETURNED");

    expect(positions).toContain("Stale-sequence trader");
    expect(positions).toContain("53.28%");
    expect(positions).toContain("sequence 738");

    expect(proof).toContain("0.010000000 SOL principal returned");
    expect(proof).toContain("0.008769297 SOL");
    expect(proof).toContain("0.001431275 SOL");
    expect(proof).toContain("24 finalized");

    expect(integrate).toContain("0.010000000 SOL");
    expect(integrate).toContain("0.008769297 SOL");
    expect(integrate).toContain("87.48%");
  });

  it("exposes exactly the seven runtime stages in order", () => {
    expect(RUNTIME_STAGE_LABELS).toEqual([
      "Market healthy",
      "TxLINE event advances sequence",
      "Stale order arrives",
      "Principal returned",
      "Quote recovering",
      "Synchronized retry accepted",
      "Settlement verified",
    ]);
  });
});
