// Minesweeper · Presented: read our minted code from the deed record, then send 1 base unit of
// CRED to the presentation account with memo "<Challenge ID>:<code>".
//   Dry run:  npx tsx --conditions=react-server scripts/present.ts
//   Send:     npx tsx --conditions=react-server scripts/present.ts --send            (code as hex, default)
//             add --format=u64 or --format=ascii to try another code format
import {
  address,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Instruction,
} from "@solana/kit";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstruction, getTransferCheckedInstruction } from "@solana-program/token";
import { loadAgentSigner } from "../lib/payments/client";

try { process.loadEnvFile(".env.local"); } catch {}

const RPC = "https://devnet.helius-rpc.com/?api-key=20933d58-7daa-4b04-af3b-32f24c16409e";
const PROGRAM = address("H2wWqEUUbQ3LJGWLAYyLK8vop4zxeX69r1cXeNpY4XXk");
const CRED_MINT = address("AwPoLn4inVqixYn9Uab2JonLBqdKZDC6poXHtjWcBnG3");
const PRESENTATION = address("HdMsqBdAW8mbrhJzHztqr1XVP1km3fXWHm7u8DpJeD9e");
const MEMO = address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const ID = "T-98b27127";
const SEND = process.argv.includes("--send");
const FORMAT = (process.argv.find((a) => a.startsWith("--format="))?.split("=")[1] ?? "hex") as "hex" | "u64" | "ascii";

const rpc = createSolanaRpc(RPC);
async function acct(a: string) {
  const { value } = await rpc.getAccountInfo(address(a), { encoding: "base64" }).send();
  return value ? { owner: value.owner as string, data: Buffer.from((value.data as [string, string])[0], "base64") } : null;
}

// ---- Read the deed record ------------------------------------------------------------------
const [deed] = await getProgramDerivedAddress({ programAddress: PROGRAM, seeds: ["deed", ID] });
const d = await acct(deed);
if (!d) throw new Error(`No deed record at ${deed}. Run scripts/minted.ts first.`);
let o = 8; // Anchor discriminator
const len = d.data.readUInt32LE(o); o += 4;
const operative = d.data.subarray(o, o + len).toString("utf8"); o += len;
const codeBytes = d.data.subarray(o, o + 8); o += 8;
const issuedSlot = d.data.readBigUInt64LE(o); o += 8;
const presented = d.data[o] === 1;
const { value: slotNow } = { value: await rpc.getSlot({ commitment: "confirmed" }).send() };
const formats = {
  hex: codeBytes.toString("hex"),
  u64: codeBytes.readBigUInt64LE(0).toString(),
  ascii: codeBytes.toString("latin1"),
};
console.log(`Deed ${deed}: operative=${operative} presented=${presented}`);
console.log(`issued_slot=${issuedSlot}  now=${slotNow}  age=${Number(BigInt(slotNow) - issuedSlot)} slots (~${Math.round(Number(BigInt(slotNow) - issuedSlot) * 0.4 / 60)} min; window ~30 min)`);
console.log(`code as hex=${formats.hex}  u64=${formats.u64}  ascii=${JSON.stringify(formats.ascii)}`);
const memo = `${ID}:${formats[FORMAT]}`;
console.log(`Memo (${FORMAT}): ${memo}`);

// ---- Build transfer of 1 base unit to the presentation account + memo -----------------------
const signer = await loadAgentSigner();
const mint = await acct(CRED_MINT);
const tokenProgram = address(mint!.owner);
const decimals = mint!.data[44];
const [source] = await findAssociatedTokenPda({ owner: signer.address, mint: CRED_MINT, tokenProgram });
const pres = await acct(PRESENTATION);
const ixs: Instruction[] = [];
let destination = PRESENTATION;
if (pres && pres.owner === tokenProgram) {
  console.log("Presentation account is a CRED token account: sending directly.");
} else {
  const [ata] = await findAssociatedTokenPda({ owner: PRESENTATION, mint: CRED_MINT, tokenProgram });
  destination = ata;
  console.log("Presentation account is a wallet: sending to its CRED account", ata);
  ixs.push(getCreateAssociatedTokenIdempotentInstruction({ payer: signer, ata, owner: PRESENTATION, mint: CRED_MINT, tokenProgram }));
}
ixs.push(getTransferCheckedInstruction({ source, mint: CRED_MINT, destination, authority: signer, amount: 1n, decimals }, { programAddress: tokenProgram }));
ixs.push({ programAddress: MEMO, accounts: [], data: new Uint8Array(Buffer.from(memo, "utf8")) });

if (!SEND) {
  console.log("\nDry run only. Re-run with --send to present.");
  process.exit(0);
}
const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
const msg = pipe(
  createTransactionMessage({ version: 0 }),
  (m) => setTransactionMessageFeePayerSigner(signer, m),
  (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
  (m) => appendTransactionMessageInstructions(ixs, m),
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
