import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// The app's own order log, kept in data/treun-ledger.json so it survives restarts.
// The authoritative record of each payment is its Solana transaction (signature).

export interface LedgerLine {
  itemId: string;
  name: string;
  supplier: string;
  country: string;
  qty: number;
  unitPriceUsdc: number;
  lineTotalUsdc: number;
}

export interface LedgerEntry {
  id: string;
  time: string;
  unit: string;
  request: string;
  lines: LedgerLine[];
  totalUsdc: number;
  budgetUsdc: number;
  settledUsdc: number;
  status: "quoted" | "paid" | "refused";
  reason?: string;
  signature?: string;
}

const FILE = path.join(process.cwd(), "data", "treun-ledger.json");

export async function readLedger(): Promise<LedgerEntry[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as LedgerEntry[];
  } catch {
    return [];
  }
}

export async function appendLedger(entry: LedgerEntry): Promise<void> {
  const all = await readLedger();
  all.unshift(entry);
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(all.slice(0, 200), null, 2));
}
