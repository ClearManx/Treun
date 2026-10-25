"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { DEVNET_SCALE, itemById, supplierById } from "@/lib/treun/catalog";
import { ProductArt } from "@/components/ProductArt";
import { OrderResult, usd, type Result } from "@/components/OrderResult";
import { AddToBasket } from "@/components/Basket";

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const item = itemById(String(id));
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!item) {
    return (
      <div className="stack">
        <h1 className="page-title">Item not found</h1>
        <Link href="/catalogue" className="btn-tool">◂ Back to catalogue</Link>
      </div>
    );
  }
  const s = supplierById(item.supplierId)!;
  const ok = s.licence.status === "valid";
  const total = item.unitPriceUsdc * Math.max(1, qty);

  async function place() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/treun/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: item!.id, qty }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link href="/catalogue" className="small">◂ Back to catalogue</Link>
      <div className="cols">
        <section className="product product--large">
          <ProductArt id={item.id} />
          <span className="product-cat">{item.category}</span>
          <h1 className="page-title">{item.name}</h1>
          <span className="product-price">{usd(item.unitPriceUsdc)} <small>USDC each</small></span>
          <dl className="kv">
            <dt>Supplier</dt><dd>{s.flag} {s.name} · {s.country}</dd>
            <dt>Licence</dt><dd className={ok ? "stock-ok" : "stock-bad"}>{ok ? "✓ Verified" : "✕ Expired"} · {s.licence.ref} (until {s.licence.expires})</dd>
            <dt>Delivery</dt><dd>{item.leadTimeDays} days</dd>
            <dt>Cat. no.</dt><dd>{item.id}</dd>
          </dl>
        </section>

        <section className="module">
          <div className="module-strip"><span>Place order</span><span>3rd Recon Company</span></div>
          <div className="module-body">
            <label className="label" htmlFor="qty">Quantity</label>
            <input id="qty" type="number" min={1} max={1000} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} />
            <dl className="kv">
              <dt>Order total</dt><dd><b>{usd(total)} USDC</b></dd>
              <dt>Devnet settlement</dt><dd>{Math.max(0.01, Math.round((total / DEVNET_SCALE) * 100) / 100)} test USDC</dd>
            </dl>
            <button className="btn btn--primary" onClick={place} disabled={busy}>{busy ? "Checking…" : `Order now · ${usd(total)} USDC ▸`}</button>
            <AddToBasket itemId={item.id} qty={qty} className="btn btn--secondary" />
            {error && <div className="notice notice--fault">{error}</div>}
            {busy && <div className="notice">Checking the supplier licence. Nothing is paid until you confirm.</div>}
            <p className="small muted">Ordering several items? Add them to your basket to compare against your HQ budget.</p>
            {result && <OrderResult result={result} onUpdate={setResult} />}
            {result && <Link href="/treun/audit" className="small">See it on the audit ledger ▸</Link>}
          </div>
        </section>
      </div>
    </>
  );
}
