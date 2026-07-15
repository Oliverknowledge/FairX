import { describe, expect, it } from "vitest";
import {
  interpretV4DeploymentState,
  UPGRADEABLE_LOADER_ID,
  V4_BUFFER_EXPECTED_LAMPORTS,
  type RpcAccountView,
} from "@/lib/v4/deploymentStatus";

const meta = { checkedAt: "2026-07-15T00:00:00.000Z", rpcUrl: "https://api.devnet.solana.com" };
const absent: RpcAccountView = { exists: false, executable: false, owner: null, lamports: 0 };
const fundedBuffer: RpcAccountView = { exists: true, executable: false, owner: UPGRADEABLE_LOADER_ID, lamports: V4_BUFFER_EXPECTED_LAMPORTS };
const liveProgram: RpcAccountView = { exists: true, executable: true, owner: UPGRADEABLE_LOADER_ID, lamports: 1_141_440 };

describe("interpretV4DeploymentState", () => {
  it("reports BUFFER_FUNDED when only the loader-owned buffer exists", () => {
    const status = interpretV4DeploymentState(absent, fundedBuffer, meta);
    expect(status.phase).toBe("BUFFER_FUNDED");
    expect(status.deployed).toBe(false);
    expect(status.bufferFunded).toBe(true);
    expect(status.headline).toMatch(/not yet live/i);
  });

  it("reports DEPLOYED only when the program is executable and loader-owned", () => {
    const status = interpretV4DeploymentState(liveProgram, fundedBuffer, meta);
    expect(status.phase).toBe("DEPLOYED");
    expect(status.deployed).toBe(true);
  });

  it("does not treat a non-executable or wrong-owner program as deployed", () => {
    expect(interpretV4DeploymentState({ ...liveProgram, executable: false }, fundedBuffer, meta).deployed).toBe(false);
    expect(interpretV4DeploymentState({ ...liveProgram, owner: "SomeOtherOwner1111111111111111111111111111" }, fundedBuffer, meta).deployed).toBe(false);
  });

  it("reports NOT_STARTED when neither account is present", () => {
    expect(interpretV4DeploymentState(absent, absent, meta).phase).toBe("NOT_STARTED");
  });

  it("never marks an empty (zero-lamport) buffer as funded", () => {
    const status = interpretV4DeploymentState(absent, { ...fundedBuffer, lamports: 0 }, meta);
    expect(status.bufferFunded).toBe(false);
    expect(status.phase).toBe("NOT_STARTED");
  });
});
