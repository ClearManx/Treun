"use client";

import { Fragment, useState } from "react";
import { BudgetCard, useAccount } from "@/components/AccountBudget";
import { usd } from "@/components/OrderResult";

export default function AdminPage() {
  const [tick, setTick] = useState(0);
  const acct = useAccount(tick);
  const [amount, setAmount] = useState(5000);
  const [note, setNote] = useState("Additional operational allocation");
  const [error, setError] = useState<string | null>(null);

  async function allocate() {
    setError(null);
    const res = await fetch("/api/treun/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amountUsdc: amount, note }) });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
    else setTick((t) => t + 1);
  }

  return (
    <>
      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">HQ admin · Brigade J4 Finance</span>
        <h1 className="page-title">Allocate budget to units</h1>
        <p className="lead">HQ loads spending authority onto each unit&apos;s account. Units can then order up to that amount, with every payment checked against it.</p>
      </div>
      <div className="cols">
        <section className="module">
          <div className="module-strip"><span>New allocation</span><span>{acct?.unit ?? ""}</span></div>
          <div className="module-body">
            <label className="label" htmlFor="amt">Amount (USDC)</label>
            <input id="amt" type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <label className="label" htmlFor="note">Reference</label>
            <input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn btn--primary" onClick={allocate}>Allocate {usd(amount)} USDC ▸</button>
            {error && <div className="notice notice--fault">{error}</div>}
          </div>
        </section>
        <section className="stack">
          <BudgetCard acct={acct} />
          {acct && (
            <section className="module">
              <div className="module-strip"><span>Allocation history</span></div>
              <div className="module-body">
                <dl className="kv">
                  {acct.allocations.map((a, i) => (
                    <Fragment key={i}><dt>{new Date(a.time).toLocaleTimeString()}</dt><dd>+{usd(a.amountUsdc)} USDC · {a.note}</dd></Fragment>
                  ))}
                  <dt>Spent</dt><dd>−{usd(acct.spentUsdc)} USDC</dd>
                </dl>
              </div>
            </section>
          )}
        </section>
      </div>
    </>
  );
}
