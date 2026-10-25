"use client";

import { Fragment, useState } from "react";
import { complianceDoc, endUserDoc, openDoc, purchaseOrderDoc, rfqDoc, type DocOrder } from "@/lib/treun/documents";

export interface Step { label: string; status: "ok" | "fail" | "info"; detail?: string }
export interface Result {
  steps: Step[];
  explorerUrl?: string;
  entry: DocOrder;
}

export const usd = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

/** Agent steps, the quote, the confirm-before-paying flow and document export. */
export function OrderResult({ result, onUpdate }: { result: Result; onUpdate: (r: Result) => void }) {
  const [asking, setAsking] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const e = result.entry;

  async function confirm() {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/treun/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quoteId: e.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onUpdate({ ...data, steps: [...result.steps, ...data.steps] });
      setAsking(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPaying(false);
    }
  }

  const docs = [
    { label: "Request for Quotation (RFQ)", make: () => rfqDoc(e) },
    { label: "Compliance check record", make: () => complianceDoc(e) },
    { label: e.status === "paid" ? "Purchase order & payment receipt" : "Draft purchase order", make: () => purchaseOrderDoc(e), hide: e.status === "refused" },
    { label: "End-user undertaking (draft)", make: () => endUserDoc(e), hide: e.status === "refused" },
  ].filter((d) => !d.hide);

  return (
    <>
      <ol className="steps">
        {result.steps.map((s, i) => (
          <li key={i}>
            <span><span className={`led ${s.status === "ok" ? "led--ok" : s.status === "fail" ? "led--fault" : "led--signal"}`} /></span>
            <span><b>{s.label}</b>{s.detail && <><br /><span className="small muted" style={{ overflowWrap: "anywhere" }}>{s.detail}</span></>}</span>
          </li>
        ))}
      </ol>

      {e.lines.length > 0 && (
        <dl className="kv">
          {e.lines.map((l, i) => (
            <Fragment key={i}><dt>{l.qty} × {l.name}</dt><dd>{usd(l.lineTotalUsdc)} USDC · {l.supplier}</dd></Fragment>
          ))}
          <dt>Total</dt><dd><b>{usd(e.totalUsdc)} USDC</b></dd>
        </dl>
      )}

      {e.status === "quoted" && (
        <>
          <div className="notice">Quote {e.id} passed licence and budget checks. <b>Nothing has been paid yet.</b></div>
          <button className="confirm-btn" onClick={() => setAsking(true)}>Confirm and place order · {usd(e.totalUsdc)} USDC ▸</button>
        </>
      )}
      {e.status === "paid" && (
        <div className="notice notice--ok">
          Paid and recorded as {e.id}. Settled {e.settledUsdc} test USDC on Solana devnet.{" "}
          {result.explorerUrl && <a href={result.explorerUrl} target="_blank" rel="noreferrer">View transaction on Solana Explorer ↗</a>}
        </div>
      )}
      {e.status === "refused" && <div className="notice notice--fault">Refused before any payment: {e.reason}</div>}
      {error && <div className="notice notice--fault">{error}</div>}

      {e.lines.length > 0 && (
        <div className="docs">
          <button className="btn-tool docs-btn" onClick={() => setDocsOpen((v) => !v)}>⇩ Export documentation {docsOpen ? "▴" : "▾"}</button>
          {docsOpen && (
            <div className="docs-menu">
              {docs.map((d) => (
                <button key={d.label} onClick={() => openDoc(d.make())}>{d.label}</button>
              ))}
              <span className="small muted">Opens a printable page. Use Print → Save as PDF.</span>
            </div>
          )}
        </div>
      )}

      {asking && (
        <div className="modal-backdrop" role="presentation" onClick={() => !paying && setAsking(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(ev) => ev.stopPropagation()}>
            <h2 id="confirm-title">Place this order?</h2>
            <p>You are about to pay <b>{usd(e.totalUsdc)} USDC</b> to {[...new Set(e.lines.map((l) => l.supplier))].join(", ")} for:</p>
            <ul>{e.lines.map((l, i) => <li key={i}>{l.qty} × {l.name}</li>)}</ul>
            <p className="small muted">The payment settles on Solana and is recorded on the audit ledger. It can&apos;t be undone. (Demo: {e.settledUsdc} test USDC on devnet.)</p>
            <div className="modal-actions">
              <button className="btn-tool" onClick={() => setAsking(false)} disabled={paying}>Cancel</button>
              <button className="confirm-btn" onClick={confirm} disabled={paying}>{paying ? "Paying…" : "Yes, place order"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
