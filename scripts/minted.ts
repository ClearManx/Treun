// Minesweeper · Minted: call the program's mint_code with no IDL, by copying the account layout
// of another team's SUCCESSFUL mint_code transaction and swapping in our own accounts.
//   Dry run:  npx tsx --conditions=react-server scripts/minted.ts
//   Send:     npx tsx --conditions=react-server scripts/minted.ts --send
import { createHash } from "node:crypto";
import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createTransactionMessage,
  getBase58Encoder,
  getBase64EncodedWireTransaction,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
} from "@solana/kit";
import { getAddressDecoder } from "@solana/kit";
import { loadAgentSigner } from "../lib/payments/client";

try { process.loadEnvFile(".env.local"); } catch {}

const RPC = "https://devnet.helius-rpc.com/?api-key=20933d58-7daa-4b04-af3b-32f24c16409e";
const PROGRAM = address("H2wWqEUUbQ3LJGWLAYyLK8vop4zxeX69r1cXeNpY4XXk");
const MEMO = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const SALT = "830797a34fd3";
const OUR_ID = "T-98b27127"; // NOT lowercased for this challenge
const SEND = process.argv.includes("--send");

const rpc = createSolanaRpc(RPC);
async function raw(method: string, params: unknown[]) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = (await r.json()) as { result?: any; error?: { message: string } };
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}
const pda = async (seed: string, id: string) => (await getProgramDerivedAddress({ programAddress: PROGRAM, seeds: [seed, id] }))[0];
const sha = (b: Buffer) => createHash("sha256").update(b).digest();

// ---- 1. Find a successful mint_code transaction to copy -----------------------------------
const sigs = (await raw("getSignaturesForAddress", [PROGRAM, { limit: 100 }])) as { signature: string; err: unknown }[];
let template: { accounts: { pubkey: string; signer: boolean; writable: boolean }[]; data: Uint8Array; theirId: string; memoFirst: boolean; signer: string } | null = null;
for (const s of sigs) {
  if (s.err) continue;
  const tx = await raw("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
  const logs: string[] = tx?.meta?.logMessages ?? [];
  if (!logs.some((l) => /MintCode/i.test(l))) continue;
  const keys: { pubkey: string; signer: boolean; writable: boolean }[] = tx.transaction.message.accountKeys;
  const ixs: any[] = tx.transaction.message.instructions;
  const ixIndex = ixs.findIndex((ix) => ix.programId === PROGRAM);
  const ix = ixs[ixIndex];
  const memoIndex = ixs.findIndex((x) => x.programId === MEMO);
  const data = new Uint8Array(getBase58Encoder().encode(ix.data));
  const len = new DataView(data.buffer).getUint32(8, true);
  const theirId = Buffer.from(data.slice(12, 12 + len)).toString("utf8");
  const meta = (k: string) => keys.find((x) => x.pubkey === k)!;
  template = {
    accounts: (ix.accounts as string[]).map((k) => ({ pubkey: k, signer: meta(k).signer, writable: meta(k).writable })),
    data,
    theirId,
    memoFirst: memoIndex >= 0 && memoIndex < ixIndex,
    signer: keys.find((k) => k.signer)!.pubkey,
  };
  console.log(`Template: ${s.signature} (team ${theirId})`);
  break;
}
if (!template) throw new Error("No successful mint_code transaction found to copy.");

// ---- 2. Map their accounts to ours ---------------------------------------------------------
const holdingsOf = async (id: string) => pda("holdings", id);
const registrarOf = async (id: string) => {
  const acc = await raw("getAccountInfo", [await holdingsOf(id), { encoding: "base64" }]);
  if (!acc?.value) throw new Error(`No holdings record for ${id}`);
  return getAddressDecoder().decode(Buffer.from(acc.value.data[0], "base64").subarray(8, 40));
};
const signer = await loadAgentSigner();
const map = new Map<string, string>([
  [template.signer, signer.address],
  [await pda("holdings", template.theirId), await pda("holdings", OUR_ID)],
  [await pda("deed", template.theirId), await pda("deed", OUR_ID)],
  [await pda("claim", template.theirId.toLowerCase()), await pda("claim", OUR_ID.toLowerCase())],
  [await registrarOf(template.theirId), await registrarOf(OUR_ID)],
]);
console.log("Our registrar key:", await registrarOf(OUR_ID));

const accounts = template.accounts.map((a) => {
  const mine = map.get(a.pubkey) ?? a.pubkey;
  const role = a.signer ? (a.writable ? AccountRole.WRITABLE_SIGNER : AccountRole.READONLY_SIGNER) : a.writable ? AccountRole.WRITABLE : AccountRole.READONLY;
  console.log(`  ${a.pubkey === mine ? "same" : "swap"}  ${a.pubkey} -> ${mine}  (${a.signer ? "signer " : ""}${a.writable ? "writable" : "readonly"})`);
  if (mine === signer.address) return { address: signer.address, role, signer } as any;
  return { address: mine as Address, role };
});

// ---- 3. Build data: discriminator + string(challenge_id) + memo_hash -----------------------
const memoHash = sha(Buffer.concat([Buffer.from(OUR_ID, "utf8"), Buffer.from(SALT, "utf8")]));
const idBytes = Buffer.from(OUR_ID, "utf8");
const lenBytes = Buffer.alloc(4);
lenBytes.writeUInt32LE(idBytes.length);
const data = new Uint8Array(Buffer.concat([Buffer.from(template.data.slice(0, 8)), lenBytes, idBytes, memoHash]));
console.log("memo_hash:", memoHash.toString("hex"));

const mintIx: Instruction = { programAddress: PROGRAM, accounts, data };
const memoIx: Instruction = { programAddress: address(MEMO), accounts: [], data: new Uint8Array(Buffer.from(memoHash.toString("hex"), "utf8")) };
const instructions = template.memoFirst ? [memoIx, mintIx] : [mintIx, memoIx];

if (!SEND) {
  console.log("\nDry run only. Re-run with --send to submit.");
  process.exit(0);
}
const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
const msg = pipe(
  createTransactionMessage({ version: 0 }),
  (m) => setTransactionMessageFeePayerSigner(signer, m),
  (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
  (m) => appendTransactionMessageInstructions(instructions, m),
);
const tx = await signTransactionMessageWithSigners(msg);
const sig = getSignatureFromTransaction(tx);
await rpc.sendTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64", preflightCommitment: "confirmed" }).send();
console.log("Sent:", sig);
for (let i = 0; i < 45; i++) {
  const { value } = await rpc.getSignatureStatuses([sig]).send();
  if (value[0]?.err) throw new Error(`Failed on chain: ${JSON.stringify(value[0].err)}`);
  if (value[0]?.confirmationStatus === "confirmed" || value[0]?.confirmationStatus === "finalized") {
    console.log(`Confirmed. https://explorer.solana.com/tx/${sig}?cluster=devnet`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
console.log("Not confirmed yet; check the explorer:", sig);
