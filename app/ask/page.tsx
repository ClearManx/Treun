"use client";

import Link from "next/link";
import { useState } from "react";
import { OrderResult, type Result } from "@/components/OrderResult";
import { BudgetCard, useAccount } from "@/components/AccountBudget";

const PRESETS = [
  { label: "Patrol kit", request: "Equip a 12-person patrol with handheld comms and individual first-aid kits.", budget: 7000 },
  { label: "Licence check", request: "Buy 2 portable generators from Northgate Surplus.", budget: 10000 },
  { label: "Over budget", request: "We need 4 portable satellite terminals and 6 reconnaissance drones.", budget: 5000 },
];

export default function AskPage() {
  const [request, setRequest] = useState(PRESETS[0].request);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const acct = useAccount(result?.entry.status);

  async function order() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/treun/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request }) });
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
      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">Ask Treun</span>
        <h1 className="page-title">Tell the buyer agent what your unit needs.</h1>
        <p className="lead">It picks items from verified suppliers, checks licences and your budget, and pays in USDC on Solana. Every step is shown, and every order goes on the <Link href="/treun/audit">audit ledger</Link>.</p>
      </div>

      <div className="cols">
        <section className="module">
          <div className="module-strip"><span>Buyer agent</span><span>3rd Recon Company</span></div>
          <div className="module-body">
            <div className="row">
              {PRESETS.map((p) => (
                <button key={p.label} className="chip" onClick={() => setRequest(p.request)} disabled={busy}>{p.label}</button>
              ))}
            </div>
            <label className="label" htmlFor="req">What does the unit need?</label>
            <textarea id="req" rows={4} value={request} onChange={(e) => setRequest(e.target.value)} />
            <BudgetCard acct={acct} />
            <button className="btn btn--primary" onClick={order} disabled={busy || !request.trim()}>{busy ? "Agent working…" : "Ask Treun for a quote ▸"}</button>
            {error && <div className="notice notice--fault">{error}</div>}
          </div>
        </section>

        <section className="module">
          <div className="module-strip"><span>Agent steps</span><span>{result ? result.entry.id : busy ? "working" : "idle"}</span></div>
          <div className="module-body">
            {!result && !busy && <div className="empty">Ask Treun to watch the agent work.</div>}
            {busy && <div className="notice">Searching suppliers, building a quote, checking licences and budget…</div>}
            {result && <OrderResult result={result} onUpdate={setResult} />}
          </div>
        </section>
      </div>
    </>
  );
}
