import { NextResponse } from "next/server";
import { readLedger } from "@/lib/treun/ledger";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ entries: await readLedger() });
}
