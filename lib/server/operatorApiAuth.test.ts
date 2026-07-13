import { afterEach, describe, expect, it } from "vitest";
import { requireOperatorApiAuthorization } from "@/lib/server/operatorApiAuth";

const original = process.env.LINEGUARD_OPERATOR_API_TOKEN;

afterEach(() => {
  if (original === undefined) delete process.env.LINEGUARD_OPERATOR_API_TOKEN;
  else process.env.LINEGUARD_OPERATOR_API_TOKEN = original;
});

describe("operator mutation API authorization", () => {
  it("fails closed when the server token is absent", () => {
    delete process.env.LINEGUARD_OPERATOR_API_TOKEN;
    const response = requireOperatorApiAuthorization(new Request("http://localhost/api", { method: "POST" }));
    expect(response?.status).toBe(503);
  });

  it("rejects an invalid bearer token", () => {
    process.env.LINEGUARD_OPERATOR_API_TOKEN = "a".repeat(32);
    const response = requireOperatorApiAuthorization(new Request("http://localhost/api", { method: "POST", headers: { Authorization: `Bearer ${"b".repeat(32)}` } }));
    expect(response?.status).toBe(401);
  });

  it("permits only the exact server-side bearer token", () => {
    process.env.LINEGUARD_OPERATOR_API_TOKEN = "c".repeat(32);
    const response = requireOperatorApiAuthorization(new Request("http://localhost/api", { method: "POST", headers: { Authorization: `Bearer ${"c".repeat(32)}` } }));
    expect(response).toBeNull();
  });
});
