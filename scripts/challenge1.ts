// Operation · Found it: read our verification record, then send 1 base unit of CRED to our clearance account.
//   Dry run (reads only):  npx tsx --conditions=react-server scripts/challenge1.ts
//   Send for real:         npx tsx --conditions=react-server scripts/challenge1.ts --send
import {
  address,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createTransactionMessage,
  getAddressDecoder,
  getBase64EncodedWireTransaction,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Instruction,
} from "@solana/kit";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedInstruction,
} from "@solana-program/token";
import { loadAgentSigner } from "../lib/payments/client";
import { createHash } from "node:crypto";

const MEMO_PROGRAM = address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

try {
  process.loadEnvFile(".env.local");
} catch {}

const RPC = "https://devnet.helius-rpc.com/?api-key=20933d58-7daa-4b04-af3b-32f24c16409e";
const PROGRAM = address("H2wWqEUUbQ3LJGWLAYyLK8vop4zxeX69r1cXeNpY4XXk");
const CRED_MINT = address("AwPoLn4inVqixYn9Uab2JonLBqdKZDC6poXHtjWcBnG3");
const CHALLENGE_ID = (process.env.CHALLENGE_ID ?? "T-98b27127").toLowerCase();
const SEND = process.argv.includes("--send");

const rpc = createSolanaRpc(RPC);
const b64 = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));

async function account(addr: ReturnType<typeof address>) {
  const { value } = await rpc.getAccountInfo(addr, { encoding: "base64" }).send();
  return value ? { owner: value.owner as string, data: b64((value.data as [string, string])[0]), lamports: value.lamports } : null;
}

const signer = await loadAgentSigner();
console.log("Team wallet:", signer.address);
const me = await account(signer.address);
console.log("SOL balance:", me ? Number(me.lamports) / 1e9 : 0);

// Try every plausible way the salt could combine with "claim" and the Challenge ID.
const SALT = "830797a34fd3";
const saltBytes = Uint8Array.from(Buffer.from(SALT, "hex"));
const ids = [CHALLENGE_ID, CHALLENGE_ID.toUpperCase()];
const candidates: { label: string; seeds: (string | Uint8Array)[] }[] = [];
for (const id of ids) {
  candidates.push(
    { label: `claim|${id}`, seeds: ["claim", id] },
    { label: `claim|salt(str)|${id}`, seeds: ["claim", SALT, id] },
    { label: `claim|${id}|salt(str)`, seeds: ["claim", id, SALT] },
    { label: `claim|salt(hex)|${id}`, seeds: ["claim", saltBytes, id] },
    { label: `claim|${id}|salt(hex)`, seeds: ["claim", id, saltBytes] },
    { label: `claim|${id}${SALT}`, seeds: ["claim", id + SALT] },
    { label: `claim|${SALT}${id}`, seeds: ["claim", SALT + id] },
    { label: `claim${SALT}|${id}`, seeds: ["claim" + SALT, id] },
    { label: `claim|${id}:${SALT}`, seeds: ["claim", `${id}:${SALT}`] },
    { label: `claim|${SALT}:${id}`, seeds: ["claim", `${SALT}:${id}`] },
  );
}
let record: Awaited<ReturnType<typeof getProgramDerivedAddress>>[0] | null = null;
let rec: Awaited<ReturnType<typeof account>> = null;
for (const c of candidates) {
  const [pda] = await getProgramDerivedAddress({ programAddress: PROGRAM, seeds: c.seeds });
  const a = await account(pda);
  const ok = a && a.owner === PROGRAM;
  console.log(`${ok ? "FOUND" : "  -  "} ${c.label} -> ${pda}${a ? ` (owner ${a.owner}, ${a.data.length} bytes)` : ""}`);
  if (ok && !record) {
    record = pda;
    rec = a;
  }
}
if (!record || !rec) {
  console.error("No record found under any seed combination. The organisers may not have set up our puzzle yet.");
  process.exit(1);
}
console.log("Using record:", record);
const view = new DataView(rec.data.buffer, rec.data.byteOffset, rec.data.byteLength);
const nonce = view.getBigUint64(41, true);
const clearance = getAddressDecoder().decode(rec.data.slice(49, 81));
console.log("Record length:", rec.data.length, "| clearance nonce:", nonce.toString(), "| clearance account:", clearance);

// Challenge 2 (Operation · Exact): pay exactly 1000 + (nonce mod 9000) base units. Challenge 1: any amount (1).
const EXACT = process.argv.includes("--exact");
const AMOUNT = EXACT ? 1000n + (nonce % 9000n) : 1n;
console.log(EXACT ? `Exact clearance fee: 1000 + (${nonce} mod 9000) = ${AMOUNT} base units` : "Amount: 1 base unit");

const mint = await account(CRED_MINT);
if (!mint) throw new Error("CRED mint not found");
const tokenProgram = address(mint.owner);
const decimals = mint.data[44];
console.log("CRED token program:", tokenProgram, "| decimals:", decimals);

const [source] = await findAssociatedTokenPda({ owner: signer.address, mint: CRED_MINT, tokenProgram });
const src = await account(source);
if (!src) console.warn("We have no CRED token account yet: the organisers need to fund our wallet with CRED.");
else console.log("Our CRED balance (base units):", new DataView(src.data.buffer, src.data.byteOffset).getBigUint64(64, true).toString());

// Clearance account may be a token account already, or a wallet whose ATA we should pay.
const clr = await account(clearance);
const instructions: Instruction[] = [];
let destination = clearance;
if (clr && clr.owner === tokenProgram) {
  console.log("Clearance account is a CRED token account: sending directly to it.");
} else {
  const [ata] = await findAssociatedTokenPda({ owner: clearance, mint: CRED_MINT, tokenProgram });
  destination = ata;
  console.log("Clearance account is a wallet: sending to its CRED account", ata);
  instructions.push(getCreateAssociatedTokenIdempotentInstruction({ payer: signer, ata, owner: clearance, mint: CRED_MINT, tokenProgram }));
}
instructions.push(
  getTransferCheckedInstruction(
    { source, mint: CRED_MINT, destination, authority: signer, amount: AMOUNT, decimals },
    { programAddress: tokenProgram },
  ),
);

// Challenge 3 (Operation · Verified): same transaction carries an SPL Memo =
// first 16 hex chars of sha256(utf8(Challenge ID) || nonce as 8 little-endian bytes).
if (process.argv.includes("--memo")) {
  const idForMemo = process.argv.includes("--lower") ? CHALLENGE_ID : (process.env.CHALLENGE_ID ?? "T-98b27127");
  const nonceLE = Buffer.alloc(8);
  nonceLE.writeBigUInt64LE(nonce);
  const memo = createHash("sha256").update(Buffer.concat([Buffer.from(idForMemo, "utf8"), nonceLE])).digest("hex").slice(0, 16);
  console.log(`Memo: sha256("${idForMemo}" || ${nonceLE.toString("hex")}) [:16] = ${memo}`);
  instructions.push({ programAddress: MEMO_PROGRAM, accounts: [], data: new Uint8Array(Buffer.from(memo, "utf8")) });
}

if (!SEND) {
  console.log("\nDry run only. Re-run with --send to submit the transfer.");
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
