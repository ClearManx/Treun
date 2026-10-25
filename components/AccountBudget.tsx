"use client";

import { useEffect, useState } from "react";
import { usd } from "./OrderResult";

export interface AccountView {
  unit: string;
  holder: string;
  budgetUsdc: number;
  spentUsdc: number;
  remainingUsdc: number;
  allocations: { amountUsdc: number; by: string; note: string; time: string }[];
}

export function useAccount(refreshKey: unknown = 0) {
  const [acct, setAcct] = useState<AccountView | null>(null);
  useEffect(() => {
    fetch("/api/treun/account", { cache: "no-store" }).then((r) => r.json()).then(setAcct).catch(() => setAcct(null));
  }, [refreshKey]);
  return acct;
}

/** Budget card: what HQ has loaded onto the unit's account, and what an order would leave. */
export function BudgetCard({ acct, orderTotal }: { acct: AccountView | null; orderTotal?: number }) {
  if (!acct) return <div className="budget-card"><span className="small muted">Loading account budget…</span></div>;
  const last = acct.allocations[acct.allocations.length - 1];
  const after = orderTotal !== undefined ? acct.remainingUsdc - orderTotal : null;
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / Math.max(1, acct.budgetUsdc)) * 100))}%`;
  return (
    <div className="budget-card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="label">{acct.unit} · account budget</span>
        <span className="small muted">Allocated by {last?.by ?? "HQ"}</span>
      </div>
      <div className="budget-num">{usd(acct.remainingUsdc)} <small>USDC available of {usd(acct.budgetUsdc)}</small></div>
      <div className="budget-bar" aria-hidden="true">
        <span className="budget-spent" style={{ width: pct(acct.spentUsdc) }} />
        {orderTotal !== undefined && <span className={`budget-order${after! < 0 ? " over" : ""}`} style={{ width: pct(Math.min(orderTotal, acct.remainingUsdc + Math.max(0, orderTotal - acct.remainingUsdc))) }} />}
      </div>
      {after !== null && (
        <div className={`small ${after < 0 ? "stock-bad" : ""}`}>
          This order: {usd(orderTotal!)} USDC · {after < 0 ? `over budget by ${usd(-after)} USDC` : `${usd(after)} USDC left afterwards`}
        </div>
      )}
      {last && <div className="small muted">Latest allocation: {usd(last.amountUsdc)} USDC, “{last.note}”</div>}
    </div>
  );
}
