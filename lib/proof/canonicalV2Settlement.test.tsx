import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CanonicalV2Settlement } from "@/components/fairx-proof/CanonicalV2Settlement";

describe("canonical resolved market evidence", () => {
  it("renders the complete settled state without a wallet", () => {
    const html = renderToStaticMarkup(<CanonicalV2Settlement />);
    for (const claim of ["Resolved: France won", "ValidateStatV2 passed", "2 of 3", "Claimed", "0.02 SOL", "Conservation verified", "No wallet is required"]) {
      expect(html).toContain(claim);
    }
  });

  it("keeps public proof visible for an unrelated wallet and exposes no claim control", () => {
    const html = renderToStaticMarkup(<CanonicalV2Settlement connectedWallet="11111111111111111111111111111111" />);
    expect(html).toContain("This wallet does not own the canonical position");
    expect(html).toContain("Resolved: France won");
    expect(html).not.toContain("Claim Devnet SOL");
  });
});
