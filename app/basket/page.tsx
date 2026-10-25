"use client";

import Link from "next/link";
import { useState } from "react";
import { itemById, supplierById } from "@/lib/treun/catalog";
import { useBasket } from "@/components/Basket";
import { BudgetCard, useAccount } from "@/components/AccountBudget";
import { OrderResult, usd, type Result } from "@/components/OrderResult";
import { ProductArt } from "@/components/ProductArt";

export default function BasketPage() {
  const { lines, setQty, remove, clear } = useBasket();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const acct = useAccount(result?.entry.status);

  const rows = lines.map((l) => ({ ...l, item: itemById(l.itemId) })).filter((r) => r.item);
  const total = rows.reduce((a, r) => a + r.item!.unitPriceUsdc * r.qty, 0);

  async function quote() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/treun/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ basket: lines }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onUpdate(r: Result) {
    setResult(r);
    if (r.entry.status === "paid") clear();
  }

  return (
    <>
      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">Basket</span>
        <h1 className="page-title">Your basket</h1>
      </div>

      <div className="cols">
        <section className="module">
          <div className="module-strip"><span>Items</span><span>{rows.length} line{rows.length === 1 ? "" : "s"}</span></div>
          <div className="module-body">
            {rows.length === 0 && !result && (
              <div className="empty">Your basket is empty. <Link href="/catalogue">Browse the catalogue ▸</Link></div>
            )}
            {rows.map((r) => {
              const s = supplierById(r.item!.supplierId)!;
              return (
                <div key={r.itemId} className="basket-line">
                  <div className="basket-thumb"><ProductArt id={r.itemId} /></div>
                  <div className="stack" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                    <b>{r.item!.name}</b>
                    <span className="small muted">{s.flag} {s.name} · {usd(r.item!.unitPriceUsdc)} USDC each</span>
                    {s.licence.status !== "valid" && <span className="small stock-bad">✕ Supplier licence expired: this basket will be refused</span>}
                  </div>
                  <input type="number" min={1} max={1000} value={r.qty} onChange={(e) => setQty(r.itemId, Number(e.target.value))} className="basket-qty" aria-label={`Quantity of ${r.item!.name}`} />
                  <b className="basket-total">{usd(r.item!.unitPriceUsdc * r.qty)}</b>
                  <button className="btn-tool" onClick={() => remove(r.itemId)} aria-label={`Remove ${r.item!.name}`}>✕</button>
                </div>
              );
            })}
            {rows.length > 0 && (
              <div className="row" style={{ justifyContent: "space-between" }}>
                <button className="btn-tool" onClick={clear}>Empty basket</button>
                <span className="basket-grand">Total {usd(total)} USDC</span>
              </div>
            )}
          </div>
        </section>

        <section className="stack">
          <BudgetCard acct={acct} orderTotal={rows.length ? total : undefined} />
          {rows.length > 0 && !result && (
            <button className="btn btn--primary" onClick={quote} disabled={busy}>{busy ? "Checking…" : `Get quote for basket · ${usd(total)} USDC ▸`}</button>
          )}
          {error && <div className="notice notice--fault">{error}</div>}
          {result && (
            <section className="module">
              <div className="module-strip"><span>Order</span><span>{result.entry.id}</span></div>
              <div className="module-body"><OrderResult result={result} onUpdate={onUpdate} /></div>
            </section>
          )}
        </section>
      </div>
    </>
  );
}
