import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { V3PredecessorEvidence } from "@/components/v4/V3PredecessorEvidence";

describe("V3 predecessor lazy verification", () => {
  it("renders an idle last-known summary and explicit verification action", () => {
    const html = renderToStaticMarkup(<V3PredecessorEvidence />);
    expect(html).toContain("not re-read on page load");
    expect(html).toContain("Last-known canonical summary:");
    expect(html).toContain("Verify predecessor evidence");
    expect(html).not.toContain("checking…");
  });

  it("does not contain an automatic effect-triggered verifier call", () => {
    const source = readFileSync("components/v4/V3PredecessorEvidence.tsx", "utf8");
    expect(source).not.toContain("useEffect");
    expect(source).toContain("/api/verify/v3-lifecycle?force=1");
  });
});
