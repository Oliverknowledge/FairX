import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The submission docs hand judges a release reference. If it drifts behind what
 * production actually serves, judges review superseded code. This caught a real
 * stale reference (submission-v2.1.0 / af199af) after the sprint deploy.
 */
const RELEASE_TAG = "submission-v2.2.0";
const RELEASE_COMMIT = "9b87378c3cca65b43643634f0159ccda23805e27";
const SUPERSEDED = ["submission-v2.1.0", "af199afec6c22aa87ab0b7b803f96007df23fb62"];

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("submission release references", () => {
  it("cites the current tag and commit in SUBMISSION.md", () => {
    const doc = read("SUBMISSION.md");
    expect(doc).toContain(RELEASE_TAG);
    expect(doc).toContain(RELEASE_COMMIT);
  });

  it("never points judges at a superseded release", () => {
    for (const file of ["SUBMISSION.md", "README.md"]) {
      const doc = read(file);
      for (const stale of SUPERSEDED) {
        expect(doc, `${file} still cites superseded release ${stale}`).not.toContain(stale);
      }
    }
  });

  it("keeps the demo-video URL an explicit placeholder until it is published", () => {
    const doc = read("SUBMISSION.md");
    // Fails loudly once a real URL is pasted, as a reminder to drop this guard.
    expect(doc).toContain("<<PASTE YOUTUBE/LOOM URL HERE BEFORE SUBMITTING>>");
  });
});
