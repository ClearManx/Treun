import { NextResponse } from "next/server";
import { confirmQuote } from "@/lib/treun/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST { quoteId } -> pays a quote the buyer has explicitly confirmed.
export async function POST(req: Request) {
  try {
    const { quoteId } = (await req.json()) as { quoteId?: string };
    if (!quoteId) return NextResponse.json({ error: "Missing quoteId." }, { status: 400 });
    return NextResponse.json(await confirmQuote(String(quoteId)));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
