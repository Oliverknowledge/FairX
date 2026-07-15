import { describe, expect, it } from "vitest";
import {
  deriveAuthorityConfigV4Pda,
  deriveMarketV4Pda,
  V4_BOOTSTRAP_ADMIN,
  V4_PROGRAM_ID,
  V4_RUNTIME_STATUS,
} from "@/lib/v4/program";

describe("FairX Vault V4 deployment-candidate identity", () => {
  it("uses only the approved public identities", () => {
    expect(V4_PROGRAM_ID).toBe("2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p");
    expect(V4_BOOTSTRAP_ADMIN).toBe("ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq");
    expect(V4_RUNTIME_STATUS).toMatchObject({
      programId: V4_PROGRAM_ID,
      bootstrapAdmin: V4_BOOTSTRAP_ADMIN,
      identitySynchronized: true,
      deployed: true,
      signed: true,
      lifecycleVerified: true,
    });
  });

  it("derives V4 PDAs under the approved program ID", () => {
    expect(deriveAuthorityConfigV4Pda().toBase58()).toBe("H2VbKbeVnPXHppB7LoUeoMZjTJyzgpN1bGhCcAMzHjHG");
    expect(deriveMarketV4Pda(new Uint8Array(32)).toBase58()).toBe("56wKs2aVV4basQyZ9PWJ93k9UUim7Pkt91t4oRsBAo4H");
  });
});
