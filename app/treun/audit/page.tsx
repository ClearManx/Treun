"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Entry {
  id: string;
  time: string;
  unit: string;
  request: string;
  lines: { name: string; supplier: string; country: string; qty: number }[];
  totalUsdc: number;
  settledUsdc: number;
  status: "paid" | "refused";
  reason?: string;
  signature?: string;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  async function load() {
    const res = await fetch("/api/treun/ledger", { cache: "no-store" });
    setEntries(((await res.json()) as { entries: Entry[] }).entries);
  }
  useEffect(() => {
    load();
  }, []);

  const paid = entries?.filter((e) => e.status === "paid") ?? [];
  const refused = entries?.filter((e) => e.status === "refused") ?? [];
  const value = paid.reduce((a, e) => a + e.totalUsdc, 0);

  return (
    <>
      <div className="stack">
        <span className="eyebrow">Treun · audit ledger</span>
        <h1 className="display">Every order, every refusal, on the record.</h1>
        <p className="lead">Each paid order links to its Solana transaction, which neither buyer nor supplier can edit. Refused orders are logged too, so attempts to break the rules are visible.</p>
        <div className="row">
          <Link className="btn-tool" href="/treun">◂ Back to ordering</Link>
          <button className="btn-tool" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="cols">
        <section className="module"><div className="module-strip"><span>Paid orders</span></div><div className="module-body"><span className="metric">{paid.length}</span></div></section>
        <section className="module"><div className="module-strip"><span>Order value</span></div><div className="module-body"><span className="metric">{value.toLocaleString()} USDC</span></div></section>
        <section className="module"><div className="module-strip"><span>Refused</span></div><div className="module-body"><span className="metric">{refused.length}</span></div></section>
      </div>

      <section className="module">
        <div className="module-strip"><span>Ledger</span><span>newest first</span></div>
        <div className="module-body" style={{ overflowX: "auto" }}>
          {!entries && <div className="empty">Loading…</div>}
          {entries && entries.length === 0 && <div className="empty">No orders yet. Place one on the ordering page.</div>}
          {entries && entries.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr className="label" style={{ textAlign: "left" }}><th>Time</th><th>Order</th><th>Unit</th><th>Items</th><th>Suppliers</th><th style={{ textAlign: "right" }}>Value</th><th>Status</th><th>On-chain proof</th></tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} style={{ borderTop: "1px solid var(--hairline)", verticalAlign: "top" }}>
                    <td style={{ padding: "8px 6px", fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>{new Date(e.time).toLocaleTimeString()}</td>
                    <td style={{ fontFamily: "var(--mono)" }}>{e.id}</td>
                    <td>{e.unit}</td>
                    <td>{e.lines.map((l) => `${l.qty} × ${l.name}`).join(", ") || "—"}</td>
                    <td>{[...new Set(e.lines.map((l) => `${l.supplier} (${l.country})`))].join(", ") || "—"}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>{e.totalUsdc.toLocaleString()} USDC</td>
                    <td>
                      <span className={`tag ${e.status === "paid" ? "tag--ok" : "tag--fault"}`}>{e.status}</span>
                      {e.reason && <div className="small muted">{e.reason}</div>}
                    </td>
                    <td>
                      {e.signature ? (
                        <a href={`https://explorer.solana.com/tx/${e.signature}?cluster=devnet`} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--mono)" }}>
                          {e.signature.slice(0, 8)}…{e.signature.slice(-6)} ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
