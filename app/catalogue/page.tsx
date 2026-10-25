"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DEVNET_SCALE, ITEMS, SUPPLIERS, supplierById } from "@/lib/treun/catalog";
import { ProductArt } from "@/components/ProductArt";
import { usd } from "@/components/OrderResult";
import { AddToBasket } from "@/components/Basket";

const CATEGORIES = ["All", ...Array.from(new Set(ITEMS.map((i) => i.category)))];
const COUNTRIES = ["All", ...Array.from(new Set(SUPPLIERS.map((s) => s.country)))];

export default function CataloguePage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [country, setCountry] = useState("All");
  const [sort, setSort] = useState("name");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = ITEMS.filter((i) => {
      const s = supplierById(i.supplierId)!;
      if (cat !== "All" && i.category !== cat) return false;
      if (country !== "All" && s.country !== country) return false;
      if (verifiedOnly && s.licence.status !== "valid") return false;
      if (needle && !`${i.name} ${s.name} ${i.category} ${i.id}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const by: Record<string, (a: (typeof ITEMS)[number], b: (typeof ITEMS)[number]) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      "price-asc": (a, b) => a.unitPriceUsdc - b.unitPriceUsdc,
      "price-desc": (a, b) => b.unitPriceUsdc - a.unitPriceUsdc,
      lead: (a, b) => a.leadTimeDays - b.leadTimeDays,
    };
    return [...list].sort(by[sort]);
  }, [q, cat, country, sort, verifiedOnly]);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">Catalogue</span>
          <h1 className="page-title">Order direct from verified suppliers</h1>
        </div>
        <Link href="/ask" className="btn-tool">Not sure what you need? Ask Treun ▸</Link>
      </div>

      <div className="filters">
        <input className="filter-search" placeholder="Search items or suppliers…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="row">
          {CATEGORIES.map((c) => (
            <button key={c} className={`chip${cat === c ? " chip--on" : ""}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <div className="row">
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="filter-select">
            {COUNTRIES.map((c) => <option key={c} value={c}>{c === "All" ? "All countries" : c}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="filter-select">
            <option value="name">Sort: name</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="lead">Fastest delivery</option>
          </select>
          <label className="small" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} style={{ width: "auto" }} />
            Verified licences only
          </label>
          <span className="small muted">{shown.length} of {ITEMS.length} shown</span>
        </div>
      </div>

      <div className="product-grid">
        {shown.length === 0 && <div className="empty">No items match these filters.</div>}
        {shown.map((i) => {
          const s = supplierById(i.supplierId)!;
          const ok = s.licence.status === "valid";
          return (
            <article key={i.id} className="product">
              <ProductArt id={i.id} />
              <span className="product-cat">{i.category}</span>
              <h3>{i.name}</h3>
              <span className="product-supplier">{s.flag} {s.name}</span>
              <span className="product-price">{usd(i.unitPriceUsdc)} <small>USDC</small></span>
              <span className="product-meta">
                <span className={ok ? "stock-ok" : "stock-bad"}>{ok ? "✓ Licence verified" : "✕ Licence expired"}</span>
                <span>Delivery in {i.leadTimeDays} days</span>
              </span>
              <Link href={`/order/${i.id}`} className="order-btn">Order ▸</Link>
              <AddToBasket itemId={i.id} />
              <span className="product-code">Cat. no. {i.id}</span>
            </article>
          );
        })}
      </div>
      <p className="small muted">Demo data: suppliers and products are fictional and licence checks are simulated. Payments are real transactions on Solana devnet with test USDC, scaled to order value ÷ {DEVNET_SCALE.toLocaleString()}.</p>
    </>
  );
}
