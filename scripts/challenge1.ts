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

const [record] = await getProgramDerivedAddress({ programAddress: PROGRAM, seeds: ["claim", CHALLENGE_ID] });
console.log("Record PDA:", record, `(seeds: "claim", "${CHALLENGE_ID}")`);
const rec = await account(record);
if (!rec) {
  console.error("No record at that address yet. The organisers may not have set up our puzzle (wallet registered late).");
  process.exit(1);
}
const view = new DataView(rec.data.buffer, rec.data.byteOffset, rec.data.byteLength);
const nonce = view.getBigUint64(41, true);
const clearance = getAddressDecoder().decode(rec.data.slice(49, 81));
console.log("Record length:", rec.data.length, "| clearance nonce:", nonce.toString(), "| clearance account:", clearance);

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
    { source, mint: CRED_MINT, destination, authority: signer, amount: 1n, decimals },
    { programAddress: tokenProgram },
  ),
);

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
