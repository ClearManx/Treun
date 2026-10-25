// READ-ONLY diagnostic: settles how the challenge records are addressed.
//   npx tsx scripts/findrecord.ts
// 1. Lists every 81-byte record owned by the challenge program and looks for our Challenge ID inside them.
// 2. Uses a known record (another team's, from the organiser's 13:57 setup) to test which seed recipe is right.
import { address, getAddressDecoder, getProgramDerivedAddress } from "@solana/kit";

const RPC = "https://devnet.helius-rpc.com/?api-key=20933d58-7daa-4b04-af3b-32f24c16409e";
const PROGRAM = address("H2wWqEUUbQ3LJGWLAYyLK8vop4zxeX69r1cXeNpY4XXk");
const SALT = "830797a34fd3";
const OUR_ID = "T-98b27127";
const KNOWN = { id: "T-371ebc3a", record: "9hw81GRPQ54oSiPDWRkecTBKcZ6EMb86y8YZPtfcte2e" };

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

// ---- 1. Scan all records ------------------------------------------------------------------
const accounts = (await rpc("getProgramAccounts", [PROGRAM, { encoding: "base64", filters: [{ dataSize: 81 }] }])) as { pubkey: string; account: { data: [string, string] } }[];
console.log(`\n${accounts.length} records of 81 bytes owned by the program:`);
let ours: string | null = null;
for (const a of accounts) {
  const bytes = Buffer.from(a.account.data[0], "base64");
  const ascii = bytes.toString("latin1").replace(/[^\x20-\x7e]/g, ".");
  const idMatch = /T-[0-9a-f]{8}/i.exec(ascii)?.[0] ?? "(no ID text)";
  const clearance = getAddressDecoder().decode(bytes.subarray(49, 81));
  const isOurs = ascii.toLowerCase().includes(OUR_ID.toLowerCase());
  if (isOurs) ours = a.pubkey;
  console.log(`${isOurs ? ">>> OURS" : "        "} ${a.pubkey}  id=${idMatch}  clearance=${clearance}`);
}
console.log(ours ? `\nOUR RECORD EXISTS: ${ours}` : `\nNo record contains ${OUR_ID}. The organisers have not created ours yet.`);

// ---- 2. Which seed recipe produces the known record? -------------------------------------
const saltHex = Uint8Array.from(Buffer.from(SALT, "hex"));
const recipes = (id: string): [string, (string | Uint8Array)[]][] => [
  ["claim + id", ["claim", id]],
  ["id only", [id]],
  ["claim + salt + id", ["claim", SALT, id]],
  ["claim + id + salt", ["claim", id, SALT]],
  ["claim + saltHex + id", ["claim", saltHex, id]],
  ["claim + id + saltHex", ["claim", id, saltHex]],
  ["salt + id", [SALT, id]],
  ["id + salt", [id, SALT]],
  ["operative + id", ["operative", id]],
  ["record + id", ["record", id]],
  ["verification + id", ["verification", id]],
];
console.log(`\nTesting recipes against known record ${KNOWN.record} (${KNOWN.id}):`);
let winner: string | null = null;
for (const id of [KNOWN.id.toLowerCase(), KNOWN.id]) {
  for (const [name, seeds] of recipes(id)) {
    const [pda] = await getProgramDerivedAddress({ programAddress: PROGRAM, seeds });
    if (pda === KNOWN.record) {
      winner = `${name} (id as "${id}")`;
      console.log(`  MATCH: ${winner}`);
    }
  }
}
if (!winner) console.log("  No recipe matched. That record may be a different account type; the scan above is the reliable answer.");
else {
  const lc = winner.includes(KNOWN.id.toLowerCase());
  const name = winner.split(" (")[0];
  const id = lc ? OUR_ID.toLowerCase() : OUR_ID;
  const seeds = recipes(id).find(([n]) => n === name)![1];
  const [pda] = await getProgramDerivedAddress({ programAddress: PROGRAM, seeds });
  console.log(`\nWith that recipe, our record address would be: ${pda}`);
}
