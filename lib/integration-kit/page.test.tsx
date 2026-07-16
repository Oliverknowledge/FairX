import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import IntegratePage from "@/app/integrate/page";

describe("IntegrationKit operator page", () => {
  it("presents FairX as a small infrastructure contract", () => {
    const html = renderToStaticMarkup(<IntegratePage />);
    expect(html).toContain("Integrate with confidence.");
    expect(html).toContain("Verified odds");
    expect(html).toContain("deterministic quote");
    expect(html).toContain("protected order");
    expect(html).toContain("submitProtectedOrder");
    expect(html).toContain("STALE_SEQUENCE_RETURNED");
    expect(html).toContain("Reference no-send adapter");
    expect(html).toContain("Conformance Lab");
    expect(html).toContain("Malformed");
    expect(html).toContain("Future sequence");
    expect(html).toContain("Operator reality");
    expect(html).toContain("Integration checklist");
  });
});
