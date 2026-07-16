import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The submission docs hand judges a release reference. Pinning a commit hash here
 * is a trap: every deploy produces a new merge commit and silently invalidates it,
 * pointing judges at superseded code. That happened twice during the final sprint.
 *
 * The rule instead: cite the moving tag, and let /proof answer "what code is this?"
 * live from VERCEL_GIT_COMMIT_SHA. These tests enforce the rule rather than a
 * value, so they cannot themselves go stale on the next deploy.
 */

const RELEASE_TAG = "submission-final";
const SUPERSEDED_TAGS = ["submission-v1.0.0", "submission-v2.0.0", "submission-v2.1.0", "submission-v2.2.0"];
const DOCS = ["SUBMISSION.md", "README.md"];

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("submission release references", () => {
  it("cites the moving release tag", () => {
    for (const file of DOCS) expect(read(file)).toContain(RELEASE_TAG);
  });

  it("never points judges at a superseded tag", () => {
    for (const file of DOCS) {
      const doc = read(file);
      for (const stale of SUPERSEDED_TAGS) {
        expect(doc, `${file} still cites superseded release ${stale}`).not.toContain(stale);
      }
    }
  });

  it("pins no commit hash, because the next deploy would invalidate it", () => {
    // A bare 40-char hex string in these docs is a git SHA. Program IDs are base58
    // and the reproducible-build SBF hash is 64 hex, so neither collides with this.
    for (const file of DOCS) {
      const hits = read(file).match(/\b[0-9a-f]{40}\b/g) ?? [];
      expect(hits, `${file} pins commit hash(es): ${hits.join(", ")} — cite the tag; /proof shows the live commit`).toEqual([]);
    }
  });

  it("keeps the demo-video URL an explicit placeholder until it is published", () => {
    // Fails loudly once a real URL is pasted, as a reminder to drop this guard.
    expect(read("SUBMISSION.md")).toContain("<<PASTE YOUTUBE/LOOM URL HERE BEFORE SUBMITTING>>");
  });
});
