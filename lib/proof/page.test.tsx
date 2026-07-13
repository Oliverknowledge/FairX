import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProofPage from "@/app/proof/page";
import { canonicalV2Lifecycle, verifyV2Lifecycle } from "@/lib/proof/v2Lifecycle";

describe("simplified proof page", () => {
  it("presents one seven-step v2 lifecycle in plain language", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    expect(html).toContain("ARCHIVED V2 RECORD VERIFIED");
    for (const title of ["Genuine TxLINE evidence", "Stale exploit refunded", "Fair position created", "Direct TxLINE CPI passed", "2-of-3 resolution reached", "User payout claimed", "Vault conservation verified"]) expect(html).toContain(title);
    expect(html).not.toContain("TxLINE subscription active");
  });

  it("keeps protocol internals inside technical details", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    expect(html).toContain("Technical details");
    expect(html.indexOf("Technical details")).toBeLessThan(html.indexOf(canonicalV2Lifecycle.program.programId));
    expect(html).toContain("The hashes differ because they commit different serializations");
  });

  it("surfaces the canonical transaction links", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    for (const key of ["staleRefund", "acceptedPosition", "txlineCpiProof", "secondApproval", "resolution", "claim"] as const) expect(html).toContain(canonicalV2Lifecycle.transactions[key].explorerUrl.replaceAll("&", "&amp;"));
  });

  it("keeps the canonical v2 fixture valid", () => {
    expect(verifyV2Lifecycle(canonicalV2Lifecycle).valid).toBe(true);
  });
});
