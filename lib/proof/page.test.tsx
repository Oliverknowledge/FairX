import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProofPage from "@/app/proof/page";

describe("proof page", () => {
  it("renders the six clickable config and settlement commitments", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    expect(html).toContain("Program deployed");
    expect(html).toContain("Market config committed");
    expect(html).toContain("Event hash committed");
    expect(html).toContain("YES attack refunded to trader");
    expect(html).toContain("NO safe trade finalized to vault");
    expect(html).toContain("Receipt verifies all hashes");
    expect((html.match(/<a /g) ?? []).length).toBeGreaterThanOrEqual(6);
  });
});
