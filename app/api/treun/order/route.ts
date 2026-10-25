import { NextResponse } from "next/server";
import { runBasketOrder, runDirectOrder, runOrder } from "@/lib/treun/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST { request }                    -> Ask Treun (buyer agent), checked against the account budget
// POST { itemId, qty }                -> single item from its product page
// POST { basket: [{ itemId, qty }] }  -> basket checkout, checked against the account budget
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { request?: string; itemId?: string; qty?: number; basket?: { itemId: string; qty: number }[] };
    if (Array.isArray(body.basket)) {
      if (!body.basket.length) return NextResponse.json({ error: "Your basket is empty." }, { status: 400 });
      return NextResponse.json(await runBasketOrder(body.basket.slice(0, 50)));
    }
    if (body.itemId) {
      const qty = Number(body.qty);
      if (!(qty >= 1)) return NextResponse.json({ error: "Quantity must be at least 1." }, { status: 400 });
      return NextResponse.json(await runDirectOrder(String(body.itemId), qty));
    }
    const request = String(body.request ?? "").trim().slice(0, 600);
    if (!request) return NextResponse.json({ error: "Describe what the unit needs." }, { status: 400 });
    return NextResponse.json(await runOrder(request));
  } catch (e) {
    console.error("[treun] order failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
