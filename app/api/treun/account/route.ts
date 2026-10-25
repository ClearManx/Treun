import { NextResponse } from "next/server";
import { allocate, getAccount } from "@/lib/treun/account";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getAccount());
}

// HQ admin allocates budget to the unit: POST { amountUsdc, note }
export async function POST(req: Request) {
  const { amountUsdc, note } = (await req.json()) as { amountUsdc?: number; note?: string };
  const amt = Number(amountUsdc);
  if (!(amt > 0) || amt > 1_000_000) return NextResponse.json({ error: "Enter an amount between 1 and 1,000,000 USDC." }, { status: 400 });
  return NextResponse.json(allocate(amt, "HQ Admin · Brigade J4 Finance", String(note ?? "Budget allocation").slice(0, 120)));
}
