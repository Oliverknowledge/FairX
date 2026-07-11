import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { Keypair } from "@solana/web3.js";

const DEVNET_ORIGIN = "https://txline-dev.txodds.com";
const DEVNET_PROGRAM_ID = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";
const DEVNET_RPC = "https://api.devnet.solana.com";
const ENV_PATH = ".env.local";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function tokenFromResponse(contentType, body) {
  if (contentType.includes("application/json")) {
    const parsed = JSON.parse(body);
    const value = typeof parsed === "string" ? parsed : parsed?.token;
    if (typeof value === "string" && value.length > 0) return value;
  }
  if (body.trim().length > 0 && !body.includes("\n")) return body.trim();
  throw new Error("TxLINE activation returned an invalid API token response");
}

function quoted(value) {
  return JSON.stringify(value);
}

function upsertEnv(contents, key, value) {
  const line = `${key}=${quoted(value)}`;
  const rows = contents.split(/\r?\n/);
  const index = rows.findIndex((row) => row.startsWith(`${key}=`));
  if (index >= 0) rows[index] = line;
  else rows.push(line);
  return rows.join("\n").replace(/\n*$/, "\n");
}

async function persistServerCredentials(values) {
  let contents = "";
  try {
    contents = await readFile(ENV_PATH, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  for (const [key, value] of Object.entries(values)) {
    contents = upsertEnv(contents, key, value);
  }

  const temporary = `${ENV_PATH}.txline-tmp`;
  await writeFile(temporary, contents, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, ENV_PATH);
  await chmod(ENV_PATH, 0o600);
}

async function postGuestJwt() {
  const response = await fetch(`${DEVNET_ORIGIN}/auth/guest/start`, {
    method: "POST",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Guest JWT request failed with HTTP ${response.status}`);
  const parsed = await response.json();
  if (typeof parsed?.token !== "string" || parsed.token.split(".").length !== 3) {
    throw new Error("Guest JWT response was malformed");
  }
  return parsed.token;
}

function signActivationMessage(keypair, message) {
  const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
  const privateKey = createPrivateKey({
    key: Buffer.concat([pkcs8Prefix, Buffer.from(keypair.secretKey.subarray(0, 32))]),
    format: "der",
    type: "pkcs8",
  });
  const publicKey = createPublicKey({
    key: Buffer.concat([spkiPrefix, Buffer.from(keypair.publicKey.toBytes())]),
    format: "der",
    type: "spki",
  });
  const signature = sign(null, message, privateKey);
  if (!verify(null, message, publicKey, signature)) {
    throw new Error("Local activation-signature verification failed");
  }
  return signature.toString("base64");
}

async function activate(txSignature, jwt, walletSignature) {
  const response = await fetch(`${DEVNET_ORIGIN}/api/token/activate`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain",
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ txSig: txSignature, walletSignature, leagues: [] }),
    cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`TxLINE activation failed with HTTP ${response.status}: ${body.slice(0, 240)}`);
  }
  return tokenFromResponse(response.headers.get("content-type") ?? "", body);
}

async function verifyFixtures(jwt, apiToken) {
  const response = await fetch(`${DEVNET_ORIGIN}/api/fixtures/snapshot`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${jwt}`,
      "X-Api-Token": apiToken,
    },
    cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Authenticated fixtures request failed with HTTP ${response.status}`);
  const payload = JSON.parse(body);
  if (!Array.isArray(payload)) throw new Error("Fixtures response was not an array");
  return {
    fixtureCount: payload.length,
    responseHash: createHash("sha256").update(body).digest("hex"),
  };
}

async function main() {
  const txSignature = required("TXLINE_SUBSCRIPTION_TX");
  const secret = JSON.parse(required("LINEGUARD_OPERATOR_KEYPAIR"));
  const operator = Keypair.fromSecretKey(Uint8Array.from(secret));
  const jwt = await postGuestJwt();
  const message = Buffer.from(`${txSignature}::${jwt}`, "utf8");
  const walletSignature = signActivationMessage(operator, message);
  const apiToken = await activate(txSignature, jwt, walletSignature);
  const fixtureProbe = await verifyFixtures(jwt, apiToken);

  await persistServerCredentials({
    TXLINE_API_ORIGIN: DEVNET_ORIGIN,
    TXLINE_API_TOKEN: apiToken,
    TXLINE_JWT: jwt,
    TXLINE_NETWORK: "devnet",
    TXLINE_PROGRAM_ID: DEVNET_PROGRAM_ID,
    TXLINE_RPC_URL: DEVNET_RPC,
    TXLINE_SUBSCRIPTION_TX: txSignature,
  });

  console.log(JSON.stringify({
    activated: true,
    authenticated: true,
    network: "devnet",
    operator: operator.publicKey.toBase58(),
    fixtureCount: fixtureProbe.fixtureCount,
    fixturesResponseHash: fixtureProbe.responseHash,
    credentialsPersistedTo: ENV_PATH,
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({ activated: false, error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
