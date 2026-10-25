import "server-only";
import { randomUUID } from "node:crypto";
import { askJson } from "../ai/llm";
import { loadAgentSigner } from "../payments/client";
import { payUsdc } from "../payments/transfer";
import { DEVNET_SCALE, ITEMS, SUPPLIERS, itemById, supplierById } from "./catalog";
import { appendLedger, type LedgerEntry, type LedgerLine } from "./ledger";
import { getAccount, recordSpend, remaining } from "./account";

export interface Step {
  label: string;
  status: "ok" | "fail" | "info";
  detail?: string;
}

export interface OrderResult {
  steps: Step[];
  entry: LedgerEntry;
  explorerUrl?: string;
}

// Hard cap on test USDC this demo can spend per server run (scaled devnet amounts).
const DEMO_SPEND_CAP_USDC = 2;

// Quotes waiting for the buyer to confirm. Kept on globalThis so dev hot-reload doesn't drop them.
const g = globalThis as unknown as { __treunQuotes?: Map<string, LedgerEntry>; __treunSpent?: number };
const QUOTES = (g.__treunQuotes ??= new Map<string, LedgerEntry>());
g.__treunSpent ??= 0;

function line(itemId: string, qty: number): LedgerLine | null {
  const item = itemById(itemId);
  const q = Math.floor(Number(qty));
  if (!item || !(q > 0) || q > 1000) return null;
  const s = supplierById(item.supplierId)!;
  return { itemId: item.id, name: item.name, supplier: s.name, country: s.country, qty: q, unitPriceUsdc: item.unitPriceUsdc, lineTotalUsdc: item.unitPriceUsdc * q };
}

export const settlementFor = (totalUsdc: number) => Math.max(0.01, Math.round((totalUsdc / DEVNET_SCALE) * 100) / 100);

/** Licence + (optional) budget checks. Returns a refusal reason, or null if the quote can go ahead. */
function check(lines: LedgerLine[], budgetUsdc: number | null, steps: Step[]): string | null {
  if (!lines.length) return "No catalogue items matched the request.";
  const bad = [...new Set(lines.map((l) => SUPPLIERS.find((s) => s.name === l.supplier)!))].filter((s) => s.licence.status !== "valid");
  if (bad.length) {
    steps.push({ label: "Checked supplier licences", status: "fail", detail: bad.map((s) => `${s.name}: licence ${s.licence.ref} ${s.licence.status} (${s.licence.expires})`).join("; ") });
    return `Supplier licence not valid: ${bad.map((s) => s.name).join(", ")}.`;
  }
  steps.push({ label: "Checked supplier licences", status: "ok", detail: [...new Set(lines.map((l) => l.supplier))].join(", ") + ": all valid" });
  if (budgetUsdc === null) return null;
  const total = lines.reduce((a, l) => a + l.lineTotalUsdc, 0);
  if (total > budgetUsdc) {
    steps.push({ label: "Checked account budget", status: "fail", detail: `${total.toLocaleString()} USDC exceeds the ${budgetUsdc.toLocaleString()} USDC remaining on your account` });
    return `Over budget by ${(total - budgetUsdc).toLocaleString()} USDC.`;
  }
  steps.push({ label: "Checked account budget", status: "ok", detail: `${total.toLocaleString()} of ${budgetUsdc.toLocaleString()} USDC remaining` });
  return null;
}

/** Step 1: build and check a quote. Nothing is paid; passing quotes wait for the buyer to confirm. */
async function quote(request: string, checkBudget: boolean, lines: LedgerLine[], steps: Step[]): Promise<OrderResult> {
  const acct = await getAccount();
  const budgetUsdc = remaining(acct);
  const unit = acct.unit;
  const id = `TRN-${randomUUID().slice(0, 8).toUpperCase()}`;
  const totalUsdc = lines.reduce((a, l) => a + l.lineTotalUsdc, 0);
  const base = { id, time: new Date().toISOString(), unit, request, budgetUsdc, lines, totalUsdc };
  const reason = check(lines, checkBudget ? budgetUsdc : null, steps);
  if (reason) {
    steps.push({ label: "Order refused before payment", status: "fail", detail: reason });
    const entry: LedgerEntry = { ...base, settledUsdc: 0, status: "refused", reason };
    await appendLedger(entry);
    return { steps, entry };
  }
  const entry: LedgerEntry = { ...base, settledUsdc: settlementFor(totalUsdc), status: "quoted" };
  QUOTES.set(id, entry);
  steps.push({ label: "Quote ready: awaiting your confirmation", status: "info", detail: `Nothing has been paid. Confirm to pay ${totalUsdc.toLocaleString()} USDC.` });
  return { steps, entry };
}

/** Step 2: the buyer confirmed. Re-check, pay on Solana devnet, record on the ledger. */
export async function confirmQuote(id: string): Promise<OrderResult> {
  const q = QUOTES.get(id);
  if (!q) throw new Error("Quote not found or already used. Please create a new quote.");
  QUOTES.delete(id);
  const steps: Step[] = [{ label: "Buyer confirmed the order", status: "ok", detail: id }];
  const refuse = async (reason: string): Promise<OrderResult> => {
    steps.push({ label: "Order refused before payment", status: "fail", detail: reason });
    const entry: LedgerEntry = { ...q, settledUsdc: 0, status: "refused", reason };
    await appendLedger(entry);
    return { steps, entry };
  };
  // Final safety net: never pay beyond what HQ has loaded onto the account.
  const left = remaining(await getAccount());
  const reason = check(q.lines, left, steps);
  if (reason) return refuse(reason);
  if ((g.__treunSpent ?? 0) + q.settledUsdc > DEMO_SPEND_CAP_USDC) return refuse("Demo spending cap reached for this session. Restart the app to reset.");
  const payTo = process.env.PAY_TO_ADDRESS;
  if (!payTo) return refuse("Supplier settlement wallet (PAY_TO_ADDRESS) is not configured.");
  try {
    const { signature } = await payUsdc(await loadAgentSigner(), { to: payTo, amountUsdc: q.settledUsdc, memo: `TREUN ${id} ${q.totalUsdc}USDC` });
    g.__treunSpent = (g.__treunSpent ?? 0) + q.settledUsdc;
    await recordSpend(q.totalUsdc);
    steps.push({ label: "Paid supplier in USDC on Solana", status: "ok", detail: `${q.settledUsdc} test USDC settled on devnet (order value ÷ ${DEVNET_SCALE.toLocaleString()}), memo ${id}` });
    const entry: LedgerEntry = { ...q, time: new Date().toISOString(), status: "paid", signature };
    await appendLedger(entry);
    steps.push({ label: "Recorded on ledger", status: "ok", detail: signature });
    return { steps, entry, explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet` };
  } catch (e) {
    return refuse(`Payment failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Ask Treun: the buyer agent turns a plain-language request into a quote. */
export async function runOrder(request: string): Promise<OrderResult> {
  const steps: Step[] = [];
  steps.push({ label: "Searched catalogue", status: "ok", detail: `${ITEMS.length} listings from ${SUPPLIERS.length} suppliers` });
  const catalogue = ITEMS.map((i) => {
    const s = supplierById(i.supplierId)!;
    return { itemId: i.id, name: i.name, category: i.category, unitPriceUsdc: i.unitPriceUsdc, supplier: s.name, country: s.country };
  });
  let plan: { lines: { itemId: string; qty: number }[]; rationale: string } = { lines: [], rationale: "" };
  try {
    plan = await askJson<{ lines: { itemId: string; qty: number }[]; rationale: string }>(
      `You are a procurement agent for a military unit. Pick catalogue items and quantities that fulfil the request. ` +
        `Use only itemIds from the catalogue. If the request names a specific supplier or item, you MUST use that exact item even if its licence looks invalid: ` +
        `licence and budget checks are done by the system after you, and a refusal is a valid outcome.\n\n` +
        `Request: ${request}\n\nCatalogue (JSON): ${JSON.stringify(catalogue)}\n\n` +
        `Reply JSON: {"lines":[{"itemId":string,"qty":integer}],"rationale":string}`,
    );
  } catch (e) {
    console.warn("[treun] agent planning failed, using keyword fallback:", e);
  }
  let lines = (plan.lines ?? []).map((l) => line(String(l.itemId), l.qty)).filter((l): l is LedgerLine => !!l);
  // Fallback: if the model picked nothing, match the request text against item and supplier names.
  if (!lines.length) {
    const text = request.toLowerCase();
    const qty = Number(/\b(\d{1,4})\b/.exec(text)?.[1] ?? 1);
    const hits = ITEMS.filter((i) => {
      const s = supplierById(i.supplierId)!;
      const words = i.name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 4);
      return text.includes(s.name.toLowerCase().split(" ")[0]) || words.some((w) => text.includes(w.replace(/s$/, "")));
    });
    lines = hits.map((i) => line(i.id, qty)).filter((l): l is LedgerLine => !!l);
    if (lines.length) plan.rationale = "Matched the request to catalogue items by name.";
  }
  const total = lines.reduce((a, l) => a + l.lineTotalUsdc, 0);
  steps.push({ label: "Built quote", status: lines.length ? "ok" : "fail", detail: lines.length ? `${lines.length} line(s), ${total.toLocaleString()} USDC. ${plan.rationale ?? ""}` : "No matching items" });
  return quote(request, true, lines, steps);
}

/** Direct order from a product page: one item, chosen quantity. Licence-checked; the account
 *  balance is still enforced at payment, but the item page doesn't compare against budget. */
export async function runDirectOrder(itemId: string, qty: number): Promise<OrderResult> {
  const steps: Step[] = [];
  const l = line(itemId, qty);
  steps.push({ label: "Built quote", status: l ? "ok" : "fail", detail: l ? `${l.qty} × ${l.name} = ${l.lineTotalUsdc.toLocaleString()} USDC` : "Unknown item or quantity" });
  return quote(l ? `Direct order: ${l.qty} × ${l.name}` : `Direct order: ${itemId}`, false, l ? [l] : [], steps);
}

/** Basket checkout: several items, checked against the account budget HQ has loaded. */
export async function runBasketOrder(items: { itemId: string; qty: number }[]): Promise<OrderResult> {
  const steps: Step[] = [];
  const lines = items.map((i) => line(String(i.itemId), i.qty)).filter((l): l is LedgerLine => !!l);
  const total = lines.reduce((a, l) => a + l.lineTotalUsdc, 0);
  steps.push({ label: "Built quote from basket", status: lines.length ? "ok" : "fail", detail: lines.length ? `${lines.length} line(s), ${total.toLocaleString()} USDC` : "Basket is empty" });
  return quote(`Basket order: ${lines.map((l) => `${l.qty} × ${l.name}`).join(", ")}`, true, lines, steps);
}
